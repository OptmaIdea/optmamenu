import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

import { timezoneUtils } from '@/utils/timezoneUtils';
import { toast } from 'sonner';
import {
    Lock, History, Key, AlertCircle, CheckCircle, Save, Loader,
    RefreshCw, Smartphone, Eye, EyeOff, Settings, Filter,
    ShieldCheck, User, Store, BadgeCheck
} from 'lucide-react';
import type { SecurityLog } from '@/types';
import { useSecurityContext } from '@/hooks/useSecurityContext';

type StoreConfig = {
    pin_failed_attempts?: number;
    pin_blocked?: boolean;
    pin_blocked_at?: string | null;
    [key: string]: unknown;
};

type SecurityStore = {
    id: string;
    doc_type: string;
    document: string;
    stock_password_hash?: string;
    token_expiry_seconds?: number;
    max_token_attempts?: number;
    config?: StoreConfig;
};

type SecurityLogDetails = Record<string, unknown>;

function getErrorMessage(error: unknown, fallback = 'Erro inesperado'): string {
    return error instanceof Error ? error.message : fallback;
}

function formatSecurityRole(role: string | null): string {
    const labels: Record<string, string> = {
        owner: 'Proprietário',
        admin: 'Administrador',
        manager: 'Gerente',
        stock_operator: 'Operador de estoque',
        cashier: 'Caixa',
        sales: 'Vendas',
        staff: 'Equipe',
        viewer: 'Visualizador',
    };

    return role ? labels[role] ?? role : 'Não definido';
}

function formatSecurityStatus(status: string | null): string {
    const labels: Record<string, string> = {
        active: 'Ativo',
        inactive: 'Inativo',
        suspended: 'Suspenso',
        invited: 'Convidado',
    };

    return status ? labels[status] ?? status : 'Não definido';
}

export default function Security() {
    const [activeTab, setActiveTab] = useState('context');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);
    const {
        securityContext,
        loading: loadingSecurityContext,
        refresh: refreshSecurityContext,
        primaryStoreId,
        primaryStoreSlug,
        currentRole,
        isOwner,
        isAdminLike,
        hasPin,
    } = useSecurityContext();

    const primaryMembership = securityContext?.primary_membership ?? null;

    const [logFilters, setLogFilters] = useState({
        dateFrom: '',
        dateTo: '',
        user: '',
        action: '',
        outcome: ''
    });

    // Store Data
    const [store, setStore] = useState<SecurityStore | null>(null);

    // Password Change State (login)
    const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
    const [showPassword, setShowPassword] = useState({ new: false, confirm: false });

    // PIN State
    const [pinData, setPinData] = useState('');
    const [showPin, setShowPin] = useState(false);

    // Advanced Settings
    const [tokenExpiry, setTokenExpiry] = useState(15);
    const [maxAttempts, setMaxAttempts] = useState(3);

    // Logs State
    const [logs, setLogs] = useState<SecurityLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [tableMissing, setTableMissing] = useState(false);

    // Store master password
    const [masterPasswordData, setMasterPasswordData] = useState({
        loginPassword: '',
        newMaster: '',
        confirmMaster: ''
    });
    const [showMasterPassword, setShowMasterPassword] = useState({
        login: false,
        newMaster: false,
        confirmMaster: false
    });

    // PIN auth modal
    const [pinAuthModal, setPinAuthModal] = useState({
        isOpen: false,
        pin: '',
        showPin: false,
        action: null as 'save_pin' | 'unblock' | 'save_advanced' | null,
        error: ''
    });

    // Logs
    const fetchLogs = useCallback(async () => {
        if (!store?.id) return;

        setLoadingLogs(true);
        setTableMissing(false);

        try {
            const { data, error } = await supabase.rpc('get_store_security_logs', {
                p_store_id: store.id,
                p_limit: 200,
                p_date_from: logFilters.dateFrom || null,
                p_date_to: logFilters.dateTo || null,
                p_user: logFilters.user.trim() || null,
                p_action: logFilters.action.trim() || null,
                p_outcome: logFilters.outcome || null
            });

            if (error) {
                console.error('Logs fetch error:', error);
                if (
                    error.code === 'PGRST205' ||
                    error.message?.includes('store_security_logs') ||
                    error.message?.includes('get_store_security_logs')
                ) {
                    setTableMissing(true);
                }
                setLogs([]);
            } else {
                setLogs((data ?? []) as SecurityLog[]);
            }
        } catch (error: unknown) {
            console.error(error);
            setLogs([]);
        } finally {
            setLoadingLogs(false);
        }
    }, [
        store?.id,
        logFilters.dateFrom,
        logFilters.dateTo,
        logFilters.user,
        logFilters.action,
        logFilters.outcome
    ]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (store?.id) {
            fetchLogs();
        }
    }, [store?.id, fetchLogs]);

    useEffect(() => {
        const today = new Date();
        const from = new Date();
        from.setDate(today.getDate() - 6);

        const toInput = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        setLogFilters(prev => ({
            ...prev,
            dateFrom: prev.dateFrom || toInput(from),
            dateTo: prev.dateTo || toInput(today)
        }));
    }, []);

    useEffect(() => {
        setPinData(hasPin ? '******' : '');
    }, [hasPin]);

    // Initial data
    const fetchInitialData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

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

            const { data: adminDataRaw, error: adminError } = await supabase.rpc(
                'get_store_config_admin',
                { p_store_id: userStore.id }
            );

            if (adminError) throw adminError;

            const adminStore = Array.isArray(adminDataRaw)
                ? adminDataRaw[0]
                : adminDataRaw;

            const { data: storeSettings, error: storeSettingsError } = await supabase
                .from('stores')
                .select('token_expiry_seconds, max_token_attempts')
                .eq('id', userStore.id)
                .single();

            if (storeSettingsError) {
                console.error('Erro ao buscar configurações avançadas da loja:', storeSettingsError);
            }

            if (adminStore) {
                const mergedStore = {
                    ...adminStore,
                    id: adminStore.id || userStore.id,
                    token_expiry_seconds:
                        storeSettings?.token_expiry_seconds ??
                        adminStore.token_expiry_seconds ??
                        15,
                    max_token_attempts:
                        storeSettings?.max_token_attempts ??
                        adminStore.max_token_attempts ??
                        3,
                };

                setStore(mergedStore);
                /* setPinData(hasPin ? '******' : ''); */
                setTokenExpiry(mergedStore.token_expiry_seconds ?? 15);
                setMaxAttempts(mergedStore.max_token_attempts ?? 3);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const logAction = useCallback(async (
        action: string,
        details: SecurityLogDetails = {},
        outcome: 'success' | 'failure' = 'success'
    ) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!store?.id || !user) return;

            const { error } = await supabase.rpc('insert_security_log', {
                p_store_id: store.id,
                p_user_id: user.id,
                p_user_email: user.email,
                p_action: action,
                p_details: details,
                p_outcome: outcome
            });

            if (error) throw error;
            await fetchLogs();
        } catch (e) {
            console.error('Failed to log security action:', e);
        }
    }, [store?.id, fetchLogs]);

    // Login password
    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');

        if (passwordData.new.length < 6) {
            setMessage('Erro: A nova senha deve ter pelo menos 6 caracteres.');
            return;
        }
        if (passwordData.new !== passwordData.confirm) {
            setMessage('Erro: As senhas não conferem.');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: passwordData.new });
            if (error) throw error;

            setMessage('Senha de login alterada com sucesso!');
            setPasswordData({ current: '', new: '', confirm: '' });
            await logAction('Alteração de Senha de Login', {}, 'success');
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error, 'Erro ao alterar senha.');
            setMessage('Erro ao alterar senha: ' + errorMessage);
            await logAction('Alteração de Senha de Login', { error: errorMessage }, 'failure');
        } finally {
            setSaving(false);
        }
    };

    // Store master password
    const handleMasterPasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');

        if (!store?.id) {
            setMessage('Erro: Loja não encontrada.');
            return;
        }

        if (masterPasswordData.newMaster.trim().length < 6) {
            setMessage('Erro: A nova senha master deve ter pelo menos 6 caracteres.');
            return;
        }

        if (masterPasswordData.newMaster !== masterPasswordData.confirmMaster) {
            setMessage('Erro: A confirmação da nova senha master não confere.');
            return;
        }

        const confirmed = window.confirm(
            'Deseja redefinir a senha master da loja?\n\nEssa senha será usada em operações sensíveis, como cancelamento de entrada.'
        );
        if (!confirmed) return;

        setSaving(true);
        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;
            if (!user?.email) throw new Error('Usuário autenticado sem e-mail.');

            const { error: reauthError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: masterPasswordData.loginPassword
            });

            if (reauthError) {
                throw new Error('Senha do usuário inválida.');
            }

            const { error: rpcError } = await supabase.rpc('reset_store_master_password', {
                p_store_id: store.id,
                p_new_password: masterPasswordData.newMaster
            });

            if (rpcError) throw rpcError;

            await fetchInitialData();

            setMessage('Senha master redefinida com sucesso!');
            setMasterPasswordData({
                loginPassword: '',
                newMaster: '',
                confirmMaster: ''
            });

            await logAction('Redefinição de Senha Master', {}, 'success');
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error, 'Erro ao redefinir senha master.');
            console.error('Master password reset error:', error);
            setMessage('Erro ao redefinir senha master: ' + errorMessage);
            await logAction('Redefinição de Senha Master', { error: errorMessage }, 'failure');
        } finally {
            setSaving(false);
        }
    };

    // PIN validation
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

    const savePinDirectly = async () => {
        const wasExistingPin = hasPin;

        const { error } = await supabase.rpc('set_user_pin', {
            p_pin: pinData,
        });

        if (error) throw error;

        setMessage(wasExistingPin ? 'PIN alterado com sucesso!' : 'PIN cadastrado com sucesso!');
        await logAction(wasExistingPin ? 'Alteração de PIN' : 'Criação de PIN', {}, 'success');

        setPinData('******');

        await refreshSecurityContext();
    };

    const handlePinSave = async () => {
        if (!store) return;
        setMessage('');

        if (pinData === '******') {
            toast.info('Nenhuma alteração no PIN.');
            return;
        }

        const pinError = validateStockPin(pinData, store.document);
        if (pinError) {
            setMessage(`Erro no PIN: ${pinError}`);
            return;
        }

        if (!hasPin) {
            setSaving(true);
            try {
                await savePinDirectly();
            } catch (error: unknown) {
                const errorMessage = getErrorMessage(error, 'Erro ao cadastrar PIN.');
                setMessage('Erro ao cadastrar PIN: ' + errorMessage);
                await logAction('Tentativa de Criação de PIN', { error: errorMessage }, 'failure');
            } finally {
                setSaving(false);
            }
            return;
        }

        setPinAuthModal({ isOpen: true, pin: '', showPin: false, action: 'save_pin', error: '' });
    };

    const handleUnblock = () => {
        if (!store) return;
        setPinAuthModal({ isOpen: true, pin: '', showPin: false, action: 'unblock', error: '' });
    };

    const handleAdvancedSave = async () => {
        if (!store) return;
        setMessage('');
        setPinAuthModal({ isOpen: true, pin: '', showPin: false, action: 'save_advanced', error: '' });
    };

    const verifySecurityPin = async (plainPin: string): Promise<boolean> => {
        if (!hasPin) {
            toast.error('Nenhum PIN cadastrado. Configure um PIN primeiro.');
            return false;
        }

        const { data, error } = await supabase.rpc('validate_user_pin', {
            p_pin: plainPin,
        });

        if (error) {
            console.error('Erro ao validar PIN:', error);
            return false;
        }

        return Boolean(data);
    };

    const handlePinAuthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setPinAuthModal(prev => ({ ...prev, error: '' }));

        try {
            const isValid = await verifySecurityPin(pinAuthModal.pin);
            if (!isValid) {
                setPinAuthModal(prev => ({ ...prev, error: 'PIN incorreto.' }));
                setSaving(false);
                return;
            }

            if (pinAuthModal.action === 'save_pin') {
                await savePinDirectly();

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
                await fetchInitialData();
                await logAction(
                    'Alteração de Configurações de Token',
                    { token_expiry: tokenExpiry, max_attempts: maxAttempts },
                    'success'
                );
            }

            setPinAuthModal({ isOpen: false, pin: '', showPin: false, action: null, error: '' });
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error, 'Erro ao executar ação protegida.');
            setMessage('Erro: ' + errorMessage);
            await logAction(
                pinAuthModal.action === 'unblock'
                    ? 'Tentativa de Desbloqueio'
                    : pinAuthModal.action === 'save_pin'
                        ? 'Tentativa de Gravação PIN'
                        : 'Tentativa de Alteração de Configurações',
                { error: errorMessage },
                'failure'
            );
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'context', label: 'Contexto de Acesso', icon: ShieldCheck },
        { id: 'logs', label: 'Histórico e Atividades', icon: History },
        { id: 'login', label: 'Senha do Usuário', icon: Key },
        { id: 'pin', label: 'PIN de Segurança', icon: Smartphone },
        { id: 'advanced', label: 'Configurações Avançadas', icon: Settings },
    ];

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const createdAt = log.created_at ? new Date(log.created_at) : null;

            if (logFilters.dateFrom) {
                const from = new Date(`${logFilters.dateFrom}T00:00:00`);
                if (!createdAt || createdAt < from) return false;
            }

            if (logFilters.dateTo) {
                const to = new Date(`${logFilters.dateTo}T23:59:59`);
                if (!createdAt || createdAt > to) return false;
            }

            if (logFilters.user.trim()) {
                const userValue = (log.user_email || '').toLowerCase();
                if (!userValue.includes(logFilters.user.trim().toLowerCase())) return false;
            }

            if (logFilters.action.trim()) {
                const actionValue = (log.action || '').toLowerCase();
                if (!actionValue.includes(logFilters.action.trim().toLowerCase())) return false;
            }

            if (logFilters.outcome.trim()) {
                if ((log.outcome || '') !== logFilters.outcome) return false;
            }

            return true;
        });
    }, [logs, logFilters]);

    const resetLogFilters = () => {
        const today = new Date();
        const from = new Date();
        from.setDate(today.getDate() - 6);

        const toInput = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        setLogFilters({
            dateFrom: toInput(from),
            dateTo: toInput(today),
            user: '',
            action: '',
            outcome: ''
        });
    };

    if (loading) {
        return (
            <div className="p-8 flex justify-center">
                <Loader className="animate-spin text-brand-green" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-black text-gray-800 dark:text-gray-100 mb-2">Senhas e Acesso</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
                Gerencie suas credenciais de acesso e segurança da loja.
            </p>

            {message && (
                <div
                    className={`p-4 rounded-xl mb-6 flex items-center gap-3 shadow-sm border ${message.includes('Erro')
                        ? 'bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
                        : 'bg-green-50 border-green-100 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
                        }`}
                >
                    {message.includes('Erro') ? <AlertCircle size={24} /> : <CheckCircle size={24} />}
                    <span className="font-medium">{message}</span>
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
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
                    {pinAuthModal.isOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                            <div className="bg-white dark:bg-gray-900 w-full max-w-md p-6 rounded-2xl shadow-xl animate-zoomIn">
                                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                    <Lock size={20} className="text-red-500" />
                                    Autorização com PIN de Segurança
                                </h3>
                                <p className="text-gray-500 mb-4">
                                    Digite o PIN de segurança para{' '}
                                    {pinAuthModal.action === 'save_pin'
                                        ? 'alterar/cadastrar o PIN'
                                        : pinAuthModal.action === 'unblock'
                                            ? 'desbloquear o PIN'
                                            : 'salvar as configurações avançadas'}
                                    .
                                </p>

                                <form onSubmit={handlePinAuthSubmit}>
                                    <div className="relative mb-4">
                                        <input
                                            type={pinAuthModal.showPin ? 'text' : 'password'}
                                            placeholder="PIN de 6 dígitos"
                                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white pr-10 font-mono tracking-widest"
                                            value={pinAuthModal.pin}
                                            onChange={e =>
                                                setPinAuthModal({
                                                    ...pinAuthModal,
                                                    pin: e.target.value.replace(/\D/g, '').slice(0, 6)
                                                })
                                            }
                                            maxLength={6}
                                            autoFocus
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setPinAuthModal({ ...pinAuthModal, showPin: !pinAuthModal.showPin })
                                            }
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                            tabIndex={-1}
                                        >
                                            {pinAuthModal.showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>

                                    {pinAuthModal.error && (
                                        <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                                            {pinAuthModal.error}
                                        </p>
                                    )}

                                    <div className="flex gap-2 justify-end">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setPinAuthModal({
                                                    isOpen: false,
                                                    pin: '',
                                                    showPin: false,
                                                    action: null,
                                                    error: ''
                                                })
                                            }
                                            className="px-4 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-bold"
                                            disabled={saving}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={saving || pinAuthModal.pin.length !== 6}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            {saving && <Loader size={16} className="animate-spin" />}
                                            Confirmar
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* CONTEXTO DE ACESSO */}
                    <div className={activeTab === 'context' ? 'block animate-fadeIn' : 'hidden'}>
                        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                                    Contexto de Segurança do Usuário
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Visualize a loja atual, papel, status, PIN e permissões vinculadas ao usuário logado.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={refreshSecurityContext}
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                            >
                                <RefreshCw size={16} className={loadingSecurityContext ? 'animate-spin' : ''} />
                                Atualizar
                            </button>
                        </div>

                        {loadingSecurityContext ? (
                            <div className="flex min-h-40 items-center justify-center rounded-xl border border-gray-100 dark:border-gray-700">
                                <Loader className="animate-spin text-brand-green" />
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                            <User size={20} />
                                        </div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                                            Usuário
                                        </p>
                                        <p className="mt-1 break-all text-sm font-bold text-gray-800 dark:text-white">
                                            {securityContext?.profile?.name || securityContext?.email || 'Usuário'}
                                        </p>
                                        <p className="mt-1 break-all text-xs text-gray-500">
                                            {securityContext?.email || 'E-mail não identificado'}
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                            <Store size={20} />
                                        </div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                                            Loja atual
                                        </p>
                                        <p className="mt-1 text-sm font-bold text-gray-800 dark:text-white">
                                            {primaryMembership?.store_name || 'Não definida'}
                                        </p>
                                        <p className="mt-1 text-xs text-gray-500">
                                            {primaryStoreSlug ? `/${primaryStoreSlug}` : 'Slug não definido'}
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                            <ShieldCheck size={20} />
                                        </div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                                            Papel atual
                                        </p>
                                        <p className="mt-1 text-sm font-bold text-gray-800 dark:text-white">
                                            {formatSecurityRole(currentRole)}
                                        </p>
                                        <p className="mt-1 text-xs text-gray-500">
                                            {formatSecurityStatus(primaryMembership?.status ?? null)}
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                            <Key size={20} />
                                        </div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                                            PIN
                                        </p>
                                        <p className="mt-1 text-sm font-bold text-gray-800 dark:text-white">
                                            {hasPin ? 'Configurado' : 'Não configurado'}
                                        </p>
                                        <p className="mt-1 text-xs text-gray-500">
                                            PIN individual do usuário
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-700">
                                        <h4 className="mb-3 flex items-center gap-2 font-bold text-gray-800 dark:text-white">
                                            <BadgeCheck size={18} className="text-brand-green" />
                                            Resumo operacional
                                        </h4>

                                        <div className="space-y-2 text-sm">
                                            <InfoLine label="Store ID" value={primaryStoreId || 'Não definido'} />
                                            <InfoLine label="É proprietário?" value={isOwner ? 'Sim' : 'Não'} />
                                            <InfoLine label="Perfil administrativo?" value={isAdminLike ? 'Sim' : 'Não'} />
                                            <InfoLine label="Global admin" value={securityContext?.is_global_admin ? 'Sim' : 'Não'} />
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-700">
                                        <h4 className="mb-3 flex items-center gap-2 font-bold text-gray-800 dark:text-white">
                                            <Lock size={18} className="text-brand-green" />
                                            Ações sensíveis
                                        </h4>

                                        {primaryMembership?.sensitive_actions &&
                                            Object.keys(primaryMembership.sensitive_actions).length > 0 ? (
                                            <pre className="max-h-44 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                                                {JSON.stringify(primaryMembership.sensitive_actions, null, 2)}
                                            </pre>
                                        ) : (
                                            <p className="text-sm text-gray-500">
                                                Nenhuma ação sensível específica registrada ainda.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-700">
                                    <h4 className="mb-3 font-bold text-gray-800 dark:text-white">
                                        Lojas vinculadas
                                    </h4>

                                    {securityContext?.memberships?.length ? (
                                        <div className="space-y-2">
                                            {securityContext.memberships.map((membership) => (
                                                <div
                                                    key={membership.member_id}
                                                    className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40 md:flex-row md:items-center md:justify-between"
                                                >
                                                    <div>
                                                        <p className="font-bold text-gray-800 dark:text-white">
                                                            {membership.store_name}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            /{membership.store_slug}
                                                        </p>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2 text-xs">
                                                        <span className="rounded-full bg-green-100 px-2 py-1 font-bold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                                            {formatSecurityRole(membership.role)}
                                                        </span>
                                                        <span className="rounded-full bg-gray-100 px-2 py-1 font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                                            {formatSecurityStatus(membership.status)}
                                                        </span>
                                                        {membership.is_primary_owner && (
                                                            <span className="rounded-full bg-amber-100 px-2 py-1 font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                                                Titular
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500">
                                            Nenhuma loja vinculada encontrada.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* LOGS */}
                    <div className={activeTab === 'logs' ? 'block animate-fadeIn' : 'hidden'}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                                Registro de Atividades
                            </h3>
                            <button
                                onClick={fetchLogs}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
                                title="Atualizar"
                            >
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



                        <div className="mb-4 flex flex-col gap-3">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                                <input
                                    type="date"
                                    value={logFilters.dateFrom}
                                    onChange={e => setLogFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                />
                                <input
                                    type="date"
                                    value={logFilters.dateTo}
                                    onChange={e => setLogFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                />
                                <input
                                    type="text"
                                    placeholder="Filtrar por usuário"
                                    value={logFilters.user}
                                    onChange={e => setLogFilters(prev => ({ ...prev, user: e.target.value }))}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                />
                                <input
                                    type="text"
                                    placeholder="Filtrar por ação"
                                    value={logFilters.action}
                                    onChange={e => setLogFilters(prev => ({ ...prev, action: e.target.value }))}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                />
                                <select
                                    value={logFilters.outcome}
                                    onChange={e => setLogFilters(prev => ({ ...prev, outcome: e.target.value }))}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                >
                                    <option value="">Todos os resultados</option>
                                    <option value="success">Sucesso</option>
                                    <option value="failure">Falha</option>
                                </select>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={resetLogFilters}
                                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                                >
                                    <Filter size={16} />
                                    Limpar filtros
                                </button>
                            </div>
                        </div>


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
                                    {filteredLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-gray-400">
                                                {loadingLogs ? 'Carregando...' : 'Nenhuma atividade encontrada para os filtros aplicados.'}
                                                {!loadingLogs && (
                                                    <p className="text-xs mt-2 text-yellow-500">
                                                        Se atividades não aparecem após ações, verifique se a tabela
                                                        {' '}store_security_logs existe no banco de dados.
                                                    </p>
                                                )}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredLogs.map(log => (
                                            <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                <td className="p-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                    {timezoneUtils.formatBrazilDateTime(log.created_at)}
                                                </td>
                                                <td className="p-3 font-medium text-gray-700 dark:text-gray-300">
                                                    {log.user_email}
                                                </td>
                                                <td className="p-3 text-gray-800 dark:text-gray-200">
                                                    {log.action}
                                                </td>
                                                <td className="p-3">
                                                    {log.outcome === 'success' ? (
                                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">
                                                            Sucesso
                                                        </span>
                                                    ) : (
                                                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">
                                                            Falha
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* LOGIN PASSWORD */}
                    <div className={activeTab === 'login' ? 'block animate-fadeIn' : 'hidden'}>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
                            Alterar Senha do Sistema
                        </h3>

                        <form onSubmit={handlePasswordChange} className="max-w-md space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    Nova Senha
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword.new ? 'text' : 'password'}
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
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                    Confirmar Nova Senha
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword.confirm ? 'text' : 'password'}
                                        value={passwordData.confirm}
                                        onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                                    >
                                        {showPassword.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={saving || !passwordData.new}
                                    className="flex items-center gap-2 bg-brand-green text-white px-6 py-3 rounded-lg font-bold hover:brightness-90 transition disabled:opacity-50 dark:bg-green-600 dark:hover:bg-green-700"
                                >
                                    {saving ? <Loader size={20} className="animate-spin" /> : <Save size={20} />}
                                    Atualizar Senha
                                </button>
                            </div>
                        </form>

                        <div className="mt-8 border-t border-gray-100 pt-8 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">
                                Redefinir Senha Master da Loja
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                Essa senha é usada em operações sensíveis, como cancelamento de entrada confirmada.
                            </p>

                            <form onSubmit={handleMasterPasswordReset} className="max-w-md space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        Senha do usuário
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showMasterPassword.login ? 'text' : 'password'}
                                            value={masterPasswordData.loginPassword}
                                            onChange={e =>
                                                setMasterPasswordData({
                                                    ...masterPasswordData,
                                                    loginPassword: e.target.value
                                                })
                                            }
                                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10"
                                            placeholder="Digite sua senha do login"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowMasterPassword(prev => ({ ...prev, login: !prev.login }))
                                            }
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                                        >
                                            {showMasterPassword.login ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        Nova senha master
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showMasterPassword.newMaster ? 'text' : 'password'}
                                            value={masterPasswordData.newMaster}
                                            onChange={e =>
                                                setMasterPasswordData({
                                                    ...masterPasswordData,
                                                    newMaster: e.target.value
                                                })
                                            }
                                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10"
                                            placeholder="Mínimo 6 caracteres"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowMasterPassword(prev => ({
                                                    ...prev,
                                                    newMaster: !prev.newMaster
                                                }))
                                            }
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                                        >
                                            {showMasterPassword.newMaster ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        Confirmar nova senha master
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showMasterPassword.confirmMaster ? 'text' : 'password'}
                                            value={masterPasswordData.confirmMaster}
                                            onChange={e =>
                                                setMasterPasswordData({
                                                    ...masterPasswordData,
                                                    confirmMaster: e.target.value
                                                })
                                            }
                                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10"
                                            placeholder="Repita a nova senha"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowMasterPassword(prev => ({
                                                    ...prev,
                                                    confirmMaster: !prev.confirmMaster
                                                }))
                                            }
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                                        >
                                            {showMasterPassword.confirmMaster ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                                    Essa senha será exigida em operações críticas da loja. Guarde-a em local seguro.
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={
                                            saving ||
                                            !masterPasswordData.loginPassword.trim() ||
                                            !masterPasswordData.newMaster.trim() ||
                                            !masterPasswordData.confirmMaster.trim()
                                        }
                                        className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
                                    >
                                        {saving && <Loader size={16} className="animate-spin" />}
                                        <Lock size={16} />
                                        Redefinir Senha Master
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* PIN */}
                    <div className={activeTab === 'pin' ? 'block animate-fadeIn' : 'hidden'}>
                        <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-6 rounded-xl">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600">
                                    <Lock size={24} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">
                                        PIN de Segurança
                                    </h3>
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
                                                        type={showPin ? 'text' : 'password'}
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
                                                            setShowPin(!showPin);
                                                            if (pinData.length > 0 && !showPin) {
                                                                logAction('Visualização de PIN', { field: 'pin_input' }, 'success').catch(console.error);
                                                            }
                                                        }}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                                                        title={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                                                    >
                                                        {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                                                    </button>
                                                </div>
                                                <div className="text-xs text-gray-400 md:max-w-50">
                                                    {store?.stock_password_hash ? (
                                                        <span className="text-yellow-600 dark:text-yellow-500 block mb-1">
                                                            O PIN atual está oculto por segurança. Digite um novo para alterar.
                                                        </span>
                                                    ) : (
                                                        <span className="block mb-1">Defina um PIN de 6 números.</span>
                                                    )}
                                                    <span className="opacity-75">
                                                        * 6 números
                                                        <br />
                                                        * Sem sequências
                                                        <br />
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

                    {/* ADVANCED */}
                    <div className={activeTab === 'advanced' ? 'block animate-fadeIn' : 'hidden'}>
                        <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 p-6 rounded-xl">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600">
                                    <Settings size={24} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">
                                        Configurações do Token de Ação Sensível
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                                        Ajuste o tempo de expiração e o número máximo de tentativas do token usado em ações sensíveis da loja.
                                        <br />
                                        As alterações exigem o PIN de segurança.
                                    </p>

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

                                    <div className="mt-6 pt-4 border-t border-purple-200 gap-3 dark:border-purple-800/30 flex justify-end">
                                        {!hasPin && (
                                            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                                                Configure o PIN de segurança antes de alterar as configurações avançadas.
                                            </div>
                                        )}
                                        <button
                                            onClick={handleAdvancedSave}
                                            disabled={saving || !hasPin}
                                            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Save size={18} />
                                            {saving ? 'Salvando...' : 'Salvar configurações'}
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

    function InfoLine({ label, value }: { label: string; value: string }) {
        return (
            <div className="flex flex-col gap-1 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/40 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-400">
                    {label}
                </span>
                <span className="break-all text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {value}
                </span>
            </div>
        );
    }
}
