import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Save, Loader, MessageCircle, CheckCircle, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';

type StoreMessageSettings = {
    id: string;
    sms_gateway_token?: string | null;
    config?: Record<string, any> | null;
};

export default function MessageSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [store, setStore] = useState<StoreMessageSettings | null>(null);

    useEffect(() => {
        fetchStore();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchStore = async () => {
        try {
            setLoading(true);

            const { data: { user }, error: userErr } = await supabase.auth.getUser();
            if (userErr) throw userErr;
            if (!user) return;

            // Primeiro busca a loja do usuário via RPC
            const { data: storeData, error: storeError } = await supabase.rpc(
                'get_user_store_by_id',
                { p_user_id: user.id }
            );
            if (storeError || !storeData) throw storeError;

            const store = Array.isArray(storeData) ? storeData[0] : storeData;
            setStore(store ?? null);
        } catch (error) {
            console.error('Error fetching store:', error);
            toast.error('Erro ao carregar configurações.');
        } finally {
            setLoading(false);
        }
    };

    const useSms = useMemo(() => store?.config?.use_sms_gateway === true, [store]);

    const handleSave = async () => {
        if (!store?.id) {
            toast.error('Loja não encontrada.');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase.rpc('update_store_message_settings_admin', {
                p_store_id: store.id,
                p_sms_gateway_token: store.sms_gateway_token ?? '',
                p_config: store.config ?? {},
            });

            if (error) throw error;

            toast.success('Configurações salvas com sucesso!');
        } catch (error: any) {
            console.error('Error saving settings:', error);
            toast.error('Erro ao salvar: ' + (error?.message ?? 'Erro desconhecido'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-10 flex justify-center">
                <Loader className="animate-spin text-brand-green" />
            </div>
        );
    }

    if (!store) return <div className="p-10 text-center">Loja não encontrada.</div>;

    return (
        <PageContainer
            title="Envio de Mensagens"
            subtitle="Configure as notificações automáticas por WhatsApp e SMS."
            category="Configurações"
            icon={<MessageCircle className="text-[#21A896]" size={28} />}
            action={
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-[#21A896] hover:bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition disabled:opacity-50 shadow-sm cursor-pointer text-sm"
                >
                    {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>Salvar Alterações</span>
                </button>
            }
            flat
        >

            <div className="space-y-8">
                {/* 1. CONSENTIMENTO */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                        <CheckCircle className="text-blue-500" size={24} /> Texto de Consentimento
                    </h2>

                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 mb-4">
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                            Este é o texto que aparecerá ao lado da caixa de seleção no carrinho de compras.
                            O cliente precisa aceitar para prosseguir.
                        </p>
                    </div>

                    <textarea
                        className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-green outline-none h-32 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition resize-none text-base"
                        value={store.config?.custom_consent_text || ''}
                        onChange={(e) =>
                            setStore((prev) =>
                                prev
                                    ? { ...prev, config: { ...(prev.config ?? {}), custom_consent_text: e.target.value } }
                                    : prev
                            )
                        }
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
                                onChange={(e) =>
                                    setStore((prev) =>
                                        prev
                                            ? { ...prev, config: { ...(prev.config ?? {}), use_sms_gateway: e.target.checked } }
                                            : prev
                                    )
                                }
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
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        Token de Integração (API Key)
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full p-3 border border-orange-200 dark:border-orange-800 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition font-mono text-sm"
                                        value={store.sms_gateway_token || ''}
                                        onChange={(e) => setStore((prev) => (prev ? { ...prev, sms_gateway_token: e.target.value } : prev))}
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
        </PageContainer>
    );
}