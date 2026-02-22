import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Save, Loader, MessageCircle, CheckCircle, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

export default function MessageSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [store, setStore] = useState<any>(null);

    useEffect(() => {
        fetchStore();
    }, []);

    const fetchStore = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('stores')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (error) throw error;
            setStore(data);
        } catch (error) {
            console.error('Error fetching store:', error);
            toast.error('Erro ao carregar configurações.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('stores')
                .update({
                    sms_gateway_token: store.sms_gateway_token,
                    config: store.config
                })
                .eq('id', store.id);

            if (error) throw error;
            toast.success('Configurações salvas com sucesso!');
        } catch (error: any) {
            console.error('Error saving settings:', error);
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><Loader className="animate-spin text-brand-green" /></div>;
    if (!store) return <div className="p-10 text-center">Loja não encontrada.</div>;

    const useSms = store.config?.use_sms_gateway === true;

    return (
        <div className="max-w-4xl mx-auto p-6 md:p-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 dark:text-white flex items-center gap-3">
                        <MessageCircle className="text-brand-green" size={32} />
                        Envio de Mensagens
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Configure as notificações automáticas por WhatsApp e SMS.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-brand-green text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-green-600 transition disabled:opacity-50 shadow-lg shadow-green-200 dark:shadow-none"
                >
                    {saving ? <Loader size={20} className="animate-spin" /> : <Save size={20} />}
                    Salvar Alterações
                </button>
            </div>

            <div className="space-y-8">
                {/* 1. CONSENTIMENTO */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                        <CheckCircle className="text-blue-500" size={24} /> Texto de Consentimento
                    </h2>
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 mb-4">
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                            Este é o texto que aparecerá ao lado da caixa de seleção no carrinho de compras. O cliente precisa aceitar para prosseguir.
                        </p>
                    </div>
                    <textarea
                        className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-green outline-none h-32 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition resize-none text-base"
                        value={store.config?.custom_consent_text || ''}
                        onChange={e => setStore({ ...store, config: { ...store.config, custom_consent_text: e.target.value } })}
                        placeholder="Ex: Concordo em receber mensagens automáticas via WhatsApp/SMS sobre o andamento do meu pedido."
                    />
                </div>

                {/* 2. SMS GATEWAY */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-start mb-6">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <Smartphone className="text-orange-500" size={24} /> Integração OptmaSMSGate
                        </h2>

                        {/* Toggle SMS */}
                        <label className="flex items-center gap-3 cursor-pointer bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition">
                            <input
                                type="checkbox"
                                checked={useSms}
                                onChange={(e) => setStore({ ...store, config: { ...store.config, use_sms_gateway: e.target.checked } })}
                                className="accent-brand-green w-5 h-5"
                            />
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                Ativar Envio de SMS
                            </span>
                        </label>
                    </div>

                    {useSms ? (
                        <div className="animate-fade-in-down">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-2xl">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Token de Integração (API Key)</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 border border-orange-200 dark:border-orange-800 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition font-mono text-sm"
                                        value={store.sms_gateway_token || ''}
                                        onChange={e => setStore({ ...store, sms_gateway_token: e.target.value })}
                                        placeholder="Cole seu token aqui"
                                    />
                                    <p className="text-xs text-orange-600 mt-2">
                                        Chave necessária para autenticar o envio de mensagens.
                                    </p>
                                </div>

                                <div className="flex flex-col justify-center items-start border-l border-orange-200 dark:border-orange-800 pl-6 border-dashed">
                                    <h3 className="font-bold text-orange-800 dark:text-orange-300 mb-2">Não tem um Gateway?</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                        Use o OptmaSMSGate para transformar seu Android em um servidor de SMS.
                                    </p>
                                    <a
                                        href="https://optmasmsgate.vercel.app/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-4 py-2 rounded-lg text-sm font-bold hover:bg-orange-200 dark:hover:bg-orange-900/60 transition flex items-center gap-2"
                                    >
                                        Acessar OptmaSMSGate <span className="text-xs">↗</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 text-center bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-100 dark:border-gray-700 text-gray-400">
                            <MessageCircle size={48} className="mx-auto mb-3 opacity-20" />
                            <p>O envio de SMS está desativado. Ative acima para configurar.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
