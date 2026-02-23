import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { toast } from 'sonner';
import { timezoneUtils } from '@/utils/timezoneUtils';
import {
    Lock, History, Key, AlertCircle, CheckCircle, Save, Loader,
    RefreshCw, Smartphone, Eye, EyeOff, Settings
} from 'lucide-react';
import type { SecurityLog } from '@/types';

export default function Security() {
    const [activeTab, setActiveTab] = useState('logs');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);

    // Store Data
    const [store, setStore] = useState<{
        id: string;
        doc_type: string;
        document: string;
        stock_password_hash?: string;
        token_expiry_seconds?: number;
        max_token_attempts?: number;
        config?: any;
    } | null>(null);

    // Password Change State (login)
    const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
    const [showPassword, setShowPassword] = useState({ new: false, confirm: false });

    // PIN State (campo de entrada)
    const [pinData, setPinData] = useState('');
    const [showPin, setShowPin] = useState(false);

    // 🔹 Configurações Avançadas
    const [tokenExpiry, setTokenExpiry] = useState(15);
    const [maxAttempts, setMaxAttempts] = useState(3);

    // Logs State
    const [logs, setLogs] = useState<SecurityLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [tableMissing, setTableMissing] = useState(false);

    // --- MODAL DE REAUTENTICAÇÃO (AGORA COM PIN) ---
    const [pinAuthModal, setPinAuthModal] = useState({
        isOpen: false,
        pin: '',
        showPin: false,
        action: null as 'save_pin' | 'unblock' | 'save_advanced' | null,
        error: ''
    });

    useEffect(() => {
        fetchInitialData();
        fetchLogs();
    }, []);

    // --- DADOS INICIAIS ---
    const fetchInitialData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1️⃣ Buscar a store do usuário
            const { data: storeDataRaw, error: storeError } = await supabase.rpc(
                'get_user_store_by_id',
                { p_user_id: user.id }
            );

            if (storeError) throw storeError;
            if (!storeDataRaw) return;

            const userStore = Array.isArray(storeDataRaw)
                ? storeDataRaw[0]
                : storeDataRaw;

            if (!userStore?.id) return;

            // 2️⃣ Buscar config administrativa completa
            const { data: adminDataRaw, error: adminError } = await supabase.rpc(
                'get_store_config_admin',
                { p_store_id: userStore.id }
            );

            if (adminError) throw adminError;

            const adminStore = Array.isArray(adminDataRaw)
                ? adminDataRaw[0]
                : adminDataRaw;

            if (adminStore) {
                setStore(adminStore);
                setPinData(adminStore.stock_password_hash ? '******' : '');
                setTokenExpiry(adminStore.token_expiry_seconds ?? 15);
                setMaxAttempts(adminStore.max_token_attempts ?? 3);
            }

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };
    // --- LOGS ---
    const fetchLogs = async () => {
        setLoadingLogs(true);
        setTableMissing(false);
        try {
            const { data, error } = await supabase
                .from('store_security_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                console.error('Logs fetch error:', error);
                if (error.code === 'PGRST205' || error.message?.includes('store_security_logs')) {
                    setTableMissing(true);
                }
            } else {
                setLogs(data || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingLogs(false);
        }
    };

    const logAction = async (action: string, details: any = {}, outcome: 'success' | 'failure' = 'success') => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!store?.id || !user) return;

            const { error } = await supabase.from('store_security_logs').insert([{
                store_id: store.id,
                user_id: user.id,
                user_email: user.email,
                action,
                details,
                outcome
            }]);

            if (error) throw error;
            fetchLogs();
        } catch (e) {
            console.error("Failed to log security action:", e);
        }
    };

    // --- SENHA LOGIN ---
    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');

        if (passwordData.new.length < 6) return setMessage('Erro: A nova senha deve ter pelo menos 6 caracteres.');
        if (passwordData.new !== passwordData.confirm) return setMessage('Erro: As senhas não conferem.');

        setSaving(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: passwordData.new });
            if (error) throw error;

            setMessage('Senha de login alterada com sucesso!');
            setPasswordData({ current: '', new: '', confirm: '' });
            await logAction('Alteração de Senha de Login', {}, 'success');
        } catch (error: any) {
            setMessage('Erro ao alterar senha: ' + error.message);
            await logAction('Alteração de Senha de Login', { error: error.message }, 'failure');
        } finally {
            setSaving(false);
        }
    };

    // --- PIN ESTOQUE (validação e salvamento) ---
    const validateStockPin = (pin: string, document: string): string | null => {
        if (!/^\d{6}$/.test(pin)) return 'O PIN deve ter exatamente 6 dígitos numéricos.';
        if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) return 'O PIN não pode ser uma sequência simples.';
        if (/^(\d)\1+$/.test(pin)) return 'O PIN não pode ter todos os números iguais.';
        const cleanDoc = document?.replace(/\D/g, '') || '';
        if (cleanDoc.includes(pin)) return 'O PIN não pode ser parte do seu CPF/CNPJ.';
        const digits = pin.split('').map(Number);
        let isArithmetic = true;
        const diff = digits[1] - digits[0];
        for (let i = 1; i < digits.length - 1; i++) {
            if (digits[i + 1] - digits[i] !== diff) {
                isArithmetic = false;
                break;
            }
        }
        if (isArithmetic) return 'O PIN não pode ser uma sequência muito simples (progressão aritmética).';
        const p1 = parseInt(pin.substring(0, 2));
        const p2 = parseInt(pin.substring(2, 4));
        const p3 = parseInt(pin.substring(4, 6));
        if ((p2 - p1 === p3 - p2) && (p2 - p1 !== 0)) {
            return 'O PIN contém uma sequência previsível de pares numéricos.';
        }
        if (pin.substring(0, 3) === pin.substring(3, 6)) return 'O PIN não pode repetir a mesma sequência (ex: 123123).';
        if (p1 === p2 && p2 === p3) return 'O PIN não pode repetir os mesmos pares (ex: 101010).';
        return null;
    };

    const handlePinSave = async () => {
        if (!store) return;
        setMessage('');

        // Se for a máscara, não faz nada
        if (pinData === '******') {
            toast.info('Nenhuma alteração no PIN.');
            return;
        }

        const pinError = validateStockPin(pinData, store.document);
        if (pinError) {
            setMessage(`Erro no PIN: ${pinError}`);
            return;
        }
        // Abre modal para confirmar com o PIN ATUAL
        setPinAuthModal({ isOpen: true, pin: '', showPin: false, action: 'save_pin', error: '' });
    };

    const handleUnblock = () => {
        if (!store) return;
        setPinAuthModal({ isOpen: true, pin: '', showPin: false, action: 'unblock', error: '' });
    };

    // --- CONFIGURAÇÕES AVANÇADAS ---
    const handleAdvancedSave = async () => {
        if (!store) return;
        setMessage('');
        setPinAuthModal({ isOpen: true, pin: '', showPin: false, action: 'save_advanced', error: '' });
    };

    // --- VERIFICADOR DE PIN (reutiliza lógica do useStorePassword) ---
    const verifyStockPin = async (plainPin: string): Promise<boolean> => {
        const hash = store?.stock_password_hash;
        if (!hash) {
            // Nenhum PIN cadastrado – permite ação? Melhor bloquear.
            toast.error('Nenhum PIN cadastrado. Configure um PIN primeiro.');
            return false;
        }

        // Se começa com "$2", é bcrypt
        if (hash.startsWith('$2')) {
            try {
                return await bcrypt.compare(plainPin, hash);
            } catch {
                return false;
            }
        }
        // Fallback para texto puro (legado)
        return plainPin === hash;
    };

    // --- SUBMISSÃO DO MODAL DE PIN ---
    const handlePinAuthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setPinAuthModal(prev => ({ ...prev, error: '' }));

        try {
            const isValid = await verifyStockPin(pinAuthModal.pin);
            if (!isValid) {
                setPinAuthModal(prev => ({ ...prev, error: 'PIN incorreto.' }));
                setSaving(false);
                return;
            }

            // --- AÇÕES AUTORIZADAS ---
            if (pinAuthModal.action === 'save_pin') {
                if (!store) return;

                // 🔐 Gerar hash bcrypt do novo PIN
                const salt = await bcrypt.genSalt(10);
                const hashedPin = await bcrypt.hash(pinData, salt);

                const { error: updateError } = await supabase
                    .from('stores')
                    .update({ stock_password_hash: hashedPin })
                    .eq('id', store.id);
                if (updateError) throw updateError;

                setStore({ ...store, stock_password_hash: hashedPin });
                setMessage('PIN de estoque salvo com sucesso!');
                await logAction(store.stock_password_hash ? 'Alteração de PIN' : 'Criação de PIN', {}, 'success');
                setPinData('******'); // restaura máscara após salvar

            } else if (pinAuthModal.action === 'unblock') {
                if (!store) return;
                const newConfig = { ...store.config, pin_failed_attempts: 0, pin_blocked: false, pin_blocked_at: null };
                const { error: updateError } = await supabase
                    .from('stores')
                    .update({ config: newConfig })
                    .eq('id', store.id);
                if (updateError) throw updateError;

                setStore({ ...store, config: newConfig });
                setMessage('PIN desbloqueado com sucesso!');
                await logAction('Desbloqueio de PIN', {}, 'success');

            } else if (pinAuthModal.action === 'save_advanced') {
                if (!store) return;
                const { error: updateError } = await supabase
                    .from('stores')
                    .update({
                        token_expiry_seconds: tokenExpiry,
                        max_token_attempts: maxAttempts
                    })
                    .eq('id', store.id);
                if (updateError) throw updateError;

                setStore({ ...store, token_expiry_seconds: tokenExpiry, max_token_attempts: maxAttempts });
                setMessage('Configurações avançadas salvas com sucesso!');
                await logAction('Alteração de Configurações de Token',
                    { token_expiry: tokenExpiry, max_attempts: maxAttempts }, 'success');
            }

            // Fecha o modal
            setPinAuthModal({ isOpen: false, pin: '', showPin: false, action: null, error: '' });
        } catch (error: any) {
            setMessage('Erro: ' + error.message);
            await logAction(
                pinAuthModal.action === 'unblock' ? 'Tentativa de Desbloqueio'
                    : pinAuthModal.action === 'save_pin' ? 'Tentativa de Gravação PIN'
                        : 'Tentativa de Alteração de Configurações',
                { error: error.message }, 'failure'
            );
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'logs', label: 'Histórico e Atividades', icon: History },
        { id: 'login', label: 'Senha do Usuário', icon: Key },
        { id: 'pin', label: 'PIN de Segurança', icon: Smartphone },
        { id: 'advanced', label: 'Configurações Avançadas', icon: Settings },
    ];

    if (loading) return <div className="p-8 flex justify-center"><Loader className="animate-spin text-brand-green" /></div>;

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-black text-gray-800 dark:text-gray-100 mb-2">Senhas e Acesso</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8">Gerencie suas credenciais de acesso e segurança da loja.</p>

            {message && (
                <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 shadow-sm border ${message.includes('Erro') ? 'bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300' : 'bg-green-50 border-green-100 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'}`}>
                    {message.includes('Erro') ? <AlertCircle size={24} /> : <CheckCircle size={24} />}
                    <span className="font-medium">{message}</span>
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                {/* Tabs Header */}
                <div className="flex border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-4 font-bold text-sm whitespace-nowrap transition-colors border-b-2 ${activeTab === tab.id
                                ? 'border-green-600 text-green-600 bg-green-50/50 dark:bg-green-900/10'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-6 md:p-8">
                    {/* --- MODAL DE AUTENTICAÇÃO COM PIN --- */}
                    {pinAuthModal.isOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                            <div className="bg-white dark:bg-gray-900 w-full max-w-md p-6 rounded-2xl shadow-xl animate-zoomIn">
                                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                    <Lock size={20} className="text-red-500" />
                                    Autorização com PIN de Estoque
                                </h3>
                                <p className="text-gray-500 mb-4">
                                    Digite o PIN de estoque para {pinAuthModal.action === 'save_pin' ? 'alterar/cadastrar o PIN' :
                                        pinAuthModal.action === 'unblock' ? 'desbloquear o PIN' :
                                            'salvar as configurações avançadas'}.
                                </p>
                                <form onSubmit={handlePinAuthSubmit}>
                                    <div className="relative mb-4">
                                        <input
                                            type={pinAuthModal.showPin ? "text" : "password"}
                                            placeholder="PIN de 6 dígitos"
                                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white pr-10 font-mono tracking-widest"
                                            value={pinAuthModal.pin}
                                            onChange={e => setPinAuthModal({ ...pinAuthModal, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                                            maxLength={6}
                                            autoFocus
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setPinAuthModal({ ...pinAuthModal, showPin: !pinAuthModal.showPin })}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                            tabIndex={-1}
                                        >
                                            {pinAuthModal.showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    {pinAuthModal.error && (
                                        <p className="text-sm text-red-600 dark:text-red-400 mb-4">{pinAuthModal.error}</p>
                                    )}
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setPinAuthModal({ isOpen: false, pin: '', showPin: false, action: null, error: '' })}
                                            className="px-4 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-bold"
                                            disabled={saving}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={saving || pinAuthModal.pin.length !== 6}
                                            className="px-4 py-2 bg-brand-green text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {saving && <Loader size={16} className="animate-spin" />}
                                            Confirmar
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* --- ABA: LOGS --- */}
                    <div className={activeTab === 'logs' ? 'block animate-fadeIn' : 'hidden'}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Registro de Atividades</h3>
                            <button onClick={fetchLogs} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500" title="Atualizar">
                                <RefreshCw size={16} className={loadingLogs ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        {tableMissing && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-xl mb-6">
                                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200 font-bold mb-2">
                                    <AlertCircle size={20} />
                                    Configuração Necessária
                                </div>
                                <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                                    A tabela de logs de segurança ainda não foi criada no banco de dados.
                                    Para ativar o histórico, execute o seguinte comando SQL no seu painel Supabase:
                                </p>
                                <pre className="bg-yellow-100 dark:bg-black/30 p-3 rounded-lg text-xs overflow-x-auto select-all font-mono text-yellow-900 dark:text-yellow-100 border border-yellow-200 dark:border-yellow-800">
                                    {`create table if not exists public.store_security_logs (
  id uuid default gen_random_uuid() primary key,
  store_id uuid,
  user_id uuid,
  user_email text,
  action text not null,
  details jsonb default '{}'::jsonb,
  outcome text check (outcome in ('success', 'failure')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);`}
                                </pre>
                            </div>
                        )}

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                                    <tr>
                                        <th className="p-3 rounded-l-lg">Data/Hora</th>
                                        <th className="p-3">Usuário</th>
                                        <th className="p-3">Ação</th>
                                        <th className="p-3 rounded-r-lg">Resultado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {logs.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-gray-400">
                                                {loadingLogs ? 'Carregando...' : 'Nenhuma atividade registrada recentemente.'}
                                                {!loadingLogs && <p className="text-xs mt-2 text-yellow-500">Se atividades não aparecem após ações, verifique se a tabela 'store_security_logs' existe no banco de dados.</p>}
                                            </td>
                                        </tr>
                                    ) : (
                                        logs.map(log => (
                                            <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                <td className="p-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                    {timezoneUtils.formatBrazilDateTime(log.created_at)}
                                                </td>
                                                <td className="p-3 font-medium text-gray-700 dark:text-gray-300">{log.user_email}</td>
                                                <td className="p-3 text-gray-800 dark:text-gray-200">{log.action}</td>
                                                <td className="p-3">
                                                    {log.outcome === 'success' ? (
                                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">Sucesso</span>
                                                    ) : (
                                                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Falha</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* --- ABA: LOGIN PASSWORD --- */}
                    <div className={activeTab === 'login' ? 'block animate-fadeIn' : 'hidden'}>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Alterar Senha do Sistema</h3>
                        <form onSubmit={handlePasswordChange} className="max-w-md space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nova Senha</label>
                                <div className="relative">
                                    <input
                                        type={showPassword.new ? "text" : "password"}
                                        value={passwordData.new}
                                        onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword({ ...showPassword, new: !showPassword.new })}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                                        tabIndex={-1}
                                    >
                                        {showPassword.new ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Confirmar Nova Senha</label>
                                <div className="relative">
                                    <input
                                        type={showPassword.confirm ? "text" : "password"}
                                        value={passwordData.confirm}
                                        onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPassword.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={saving || !passwordData.new}
                                    className="flex items-center gap-2 bg-brand-green text-white px-6 py-3 rounded-lg font-bold hover:brightness-90 transition disabled:opacity-50"
                                >
                                    {saving ? <Loader size={20} className="animate-spin" /> : <Save size={20} />}
                                    Atualizar Senha
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* --- ABA: STOCK PIN --- */}
                    <div className={activeTab === 'pin' ? 'block animate-fadeIn' : 'hidden'}>
                        <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-6 rounded-xl">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600">
                                    <Lock size={24} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">PIN de Segurança</h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                                        Este PIN é utilizado para autorizar funções específicas do sistema, que exigem segurança.
                                        Mantenha-o seguro.
                                    </p>

                                    {store?.config?.pin_blocked ? (
                                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-red-200 dark:border-red-900/50">
                                            <div className="flex items-center gap-2 text-red-600 font-bold mb-2">
                                                <AlertCircle size={20} />
                                                PIN BLOQUEADO
                                            </div>
                                            <p className="text-sm text-gray-500 mb-4">
                                                O acesso foi bloqueado após muitas tentativas incorretas.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleUnblock}
                                                className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition w-full md:w-auto"
                                            >
                                                Desbloquear Agora
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                                {store?.stock_password_hash ? 'Alterar PIN Atual' : 'Cadastrar Novo PIN'}
                                            </label>
                                            <div className="flex flex-col md:flex-row gap-4 items-center">
                                                <div className="relative flex-1">
                                                    <input
                                                        type={showPin ? "text" : "password"}
                                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white tracking-[0.5em] text-center font-bold text-xl pr-10"
                                                        value={pinData}
                                                        onChange={e => setPinData(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                        onFocus={() => {
                                                            if (pinData === '******') setPinData('');
                                                        }}
                                                        onBlur={() => {
                                                            if (!pinData && store?.stock_password_hash) setPinData('******');
                                                        }}
                                                        placeholder="******"
                                                        maxLength={6}
                                                        inputMode="numeric"
                                                        autoComplete="off"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            // Alterna a visibilidade
                                                            setShowPin(!showPin);
                                                            // Registra log apenas se houver PIN digitado e estiver revelando
                                                            if (pinData.length > 0 && !showPin) {
                                                                logAction('Visualização de PIN', { field: 'pin_input' }, 'success').catch(console.error);
                                                            }
                                                        }}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                                                        title={showPin ? "Ocultar PIN" : "Mostrar PIN"}
                                                    >
                                                        {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                                                    </button>
                                                </div>
                                                <div className="text-xs text-gray-400 md:max-w-[200px]">
                                                    {store?.stock_password_hash ? (
                                                        <span className="text-yellow-600 dark:text-yellow-500 block mb-1">
                                                            O PIN atual está oculto por segurança. Digite um novo para alterar.
                                                        </span>
                                                    ) : (
                                                        <span className="block mb-1">Defina um PIN de 6 números.</span>
                                                    )}
                                                    <span className="opacity-75">
                                                        * 6 números<br />
                                                        * Sem sequências<br />
                                                        * Sem repetições
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                                                <button
                                                    onClick={handlePinSave}
                                                    disabled={saving || !pinData || pinData.length !== 6}
                                                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {saving ? 'Salvando...' : 'Salvar PIN'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- 🔹 NOVA ABA: CONFIGURAÇÕES AVANÇADAS --- */}
                    <div className={activeTab === 'advanced' ? 'block animate-fadeIn' : 'hidden'}>
                        <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 p-6 rounded-xl">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600">
                                    <Settings size={24} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">
                                        Configurações do Token de Exclusão
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                                        Ajuste o tempo de expiração e o número máximo de tentativas do token usado para excluir/descontinuar produtos.
                                        <br />As alterações exigem o PIN de segurança.
                                    </p>

                                    {/* Slider: Tempo de expiração */}
                                    <div className="mb-6">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                                ⏳ Tempo de expiração do token
                                            </label>
                                            <span className="text-sm font-mono bg-purple-100 dark:bg-purple-900/30 px-3 py-1 rounded-full text-purple-800 dark:text-purple-300">
                                                {tokenExpiry} segundos
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="15"
                                            max="60"
                                            step="1"
                                            value={tokenExpiry}
                                            onChange={(e) => setTokenExpiry(Number(e.target.value))}
                                            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                        />
                                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                                            <span>15s</span>
                                            <span>15s (padrão)</span>
                                            <span>60s</span>
                                        </div>
                                    </div>

                                    {/* Slider: Máximo de tentativas */}
                                    <div className="mb-6">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                                🔁 Máximo de tentativas por token
                                            </label>
                                            <span className="text-sm font-mono bg-purple-100 dark:bg-purple-900/30 px-3 py-1 rounded-full text-purple-800 dark:text-purple-300">
                                                {maxAttempts} {maxAttempts === 1 ? 'tentativa' : 'tentativas'}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="3"
                                            max="7"
                                            step="1"
                                            value={maxAttempts}
                                            onChange={(e) => setMaxAttempts(Number(e.target.value))}
                                            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                        />
                                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                                            <span>3</span>
                                            <span>5</span>
                                            <span>7</span>
                                        </div>
                                    </div>

                                    {/* Botão Salvar */}
                                    <div className="mt-6 pt-4 border-t border-purple-200 dark:border-purple-800/30 flex justify-end">
                                        <button
                                            type="button"
                                            onClick={handleAdvancedSave}
                                            disabled={saving || !store?.stock_password_hash}
                                            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            title={!store?.stock_password_hash ? "Configure um PIN de segurança primeiro" : ""}
                                        >
                                            {saving ? <Loader size={20} className="animate-spin" /> : <Save size={20} />}
                                            Salvar configurações
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}