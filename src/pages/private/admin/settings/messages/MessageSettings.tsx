import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Save,
    Loader,
    MessageCircle,
    CheckCircle,
    Smartphone,
    MessageSquareText,
    Info,
    ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';
import { getActiveStoreId, setActiveStoreId } from '@/utils/activeStore';
import { useSecurityContext } from '@/hooks/useSecurityContext';

interface MessageSettingsProps {
    withoutHeader?: boolean;
    disabled?: boolean;
}

type StoreMessageSettings = {
    id: string;
    name?: string | null;
    sms_gateway_token?: string | null;
    config?: Record<string, any> | null;
};

type MessageSettingsForm = {
    custom_consent_text: string;
    use_sms_gateway: boolean;
    sms_gateway_token: string;
    default_whatsapp_message: string;
    order_confirmation_message: string;
    order_ready_message: string;
    delivery_update_message: string;
    birthday_message_template: string;
    manual_message_signature: string;
};

const DEFAULT_MESSAGE_SETTINGS: MessageSettingsForm = {
    custom_consent_text:
        'Concordo em receber mensagens pelo WhatsApp/SMS sobre o andamento do meu pedido e comunicações da loja.',
    use_sms_gateway: false,
    sms_gateway_token: '',
    default_whatsapp_message:
        'Olá! Tudo bem? Estamos entrando em contato pela loja para falar sobre seu pedido.',
    order_confirmation_message:
        'Olá, {cliente}! Recebemos seu pedido {pedido}. Em breve confirmaremos o preparo.',
    order_ready_message:
        'Olá, {cliente}! Seu pedido {pedido} está pronto para retirada.',
    delivery_update_message:
        'Olá, {cliente}! Seu pedido {pedido} saiu para entrega.',
    birthday_message_template:
        'Feliz aniversário, {cliente}! A equipe da loja deseja um dia especial para você. 🎉',
    manual_message_signature: 'Equipe da loja',
};

function normalizeMessageSettings(store?: StoreMessageSettings | null): MessageSettingsForm {
    const config = store?.config ?? {};

    return {
        ...DEFAULT_MESSAGE_SETTINGS,
        custom_consent_text:
            typeof config.custom_consent_text === 'string'
                ? config.custom_consent_text
                : DEFAULT_MESSAGE_SETTINGS.custom_consent_text,
        use_sms_gateway: config.use_sms_gateway === true,
        sms_gateway_token: store?.sms_gateway_token ?? '',
        default_whatsapp_message:
            typeof config.default_whatsapp_message === 'string'
                ? config.default_whatsapp_message
                : DEFAULT_MESSAGE_SETTINGS.default_whatsapp_message,
        order_confirmation_message:
            typeof config.order_confirmation_message === 'string'
                ? config.order_confirmation_message
                : DEFAULT_MESSAGE_SETTINGS.order_confirmation_message,
        order_ready_message:
            typeof config.order_ready_message === 'string'
                ? config.order_ready_message
                : DEFAULT_MESSAGE_SETTINGS.order_ready_message,
        delivery_update_message:
            typeof config.delivery_update_message === 'string'
                ? config.delivery_update_message
                : DEFAULT_MESSAGE_SETTINGS.delivery_update_message,
        birthday_message_template:
            typeof config.birthday_message_template === 'string'
                ? config.birthday_message_template
                : DEFAULT_MESSAGE_SETTINGS.birthday_message_template,
        manual_message_signature:
            typeof config.manual_message_signature === 'string'
                ? config.manual_message_signature
                : DEFAULT_MESSAGE_SETTINGS.manual_message_signature,
    };
}

export default function MessageSettings({ withoutHeader = false, disabled = false }: MessageSettingsProps) {
    const { securityContext, loading: loadingSecurityContext } = useSecurityContext();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [store, setStore] = useState<StoreMessageSettings | null>(null);
    const [form, setForm] = useState<MessageSettingsForm>(DEFAULT_MESSAGE_SETTINGS);

    const activeStoreId = useMemo(() => {
        return getActiveStoreId() ?? securityContext?.primary_membership?.store_id ?? null;
    }, [securityContext?.primary_membership?.store_id]);

    useEffect(() => {
        if (loadingSecurityContext) return;
        fetchStore();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingSecurityContext, activeStoreId]);

    const fetchStore = async () => {
        try {
            setLoading(true);

            const resolvedStoreId = activeStoreId;

            if (!resolvedStoreId) {
                setStore(null);
                toast.error('Nenhuma loja ativa selecionada.');
                return;
            }

            if (!getActiveStoreId()) {
                setActiveStoreId(resolvedStoreId);
            }

            const { data, error } = await supabase
                .rpc('get_store_settings_center', {
                    p_store_id: resolvedStoreId,
                })
                .maybeSingle();

            if (error) throw error;
            if (!data) throw new Error('Configurações da loja não encontradas.');

            const loadedStore = Array.isArray(data) ? data[0] : data;
            setStore(loadedStore as StoreMessageSettings);
            setForm(normalizeMessageSettings(loadedStore as StoreMessageSettings));
        } catch (error) {
            console.error('Error fetching message settings:', error);
            toast.error('Erro ao carregar configurações de mensagens.');
        } finally {
            setLoading(false);
        }
    };

    const updateField = <K extends keyof MessageSettingsForm>(field: K, value: MessageSettingsForm[K]) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        if (disabled) {
            toast.error('Você não tem permissão para executar esta alteração.');
            return;
        }

        if (!store?.id) {
            toast.error('Loja não encontrada.');
            return;
        }

        setSaving(true);
        try {
            const nextConfig = {
                ...(store.config ?? {}),
                custom_consent_text: form.custom_consent_text,
                use_sms_gateway: form.use_sms_gateway,
                default_whatsapp_message: form.default_whatsapp_message,
                order_confirmation_message: form.order_confirmation_message,
                order_ready_message: form.order_ready_message,
                delivery_update_message: form.delivery_update_message,
                birthday_message_template: form.birthday_message_template,
                manual_message_signature: form.manual_message_signature,
            };

            const { data, error } = await supabase
                .from('stores')
                .update({
                    sms_gateway_token: form.use_sms_gateway ? form.sms_gateway_token : '',
                    config: nextConfig,
                })
                .eq('id', store.id)
                .select('id, name, sms_gateway_token, config')
                .single();

            if (error) throw error;

            const updatedStore = data as StoreMessageSettings;
            setStore(updatedStore);
            setForm(normalizeMessageSettings(updatedStore));
            toast.success('Configurações de mensagens salvas com sucesso!');
        } catch (error: any) {
            console.error('Error saving message settings:', error);
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

    if (!store) {
        return <div className="p-10 text-center text-gray-500">Loja não encontrada.</div>;
    }

    const content = (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                        <Info className="text-blue-500 mt-0.5" size={20} />
                        <div>
                            <h3 className="font-bold text-blue-900 dark:text-blue-200">Central manual por enquanto</h3>
                            <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                                Estas configurações padronizam textos e consentimento. O envio automático, confirmação de entrega/lido e status reais dependem de integração oficial futura ou marcação manual.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                        <ShieldCheck className="text-brand-green mt-0.5" size={20} />
                        <div>
                            <h3 className="font-bold text-green-900 dark:text-green-200">LGPD e consentimento</h3>
                            <p className="text-sm text-green-800 dark:text-green-300 mt-1">
                                Mantenha mensagens objetivas e alinhadas ao consentimento aceito pelo cliente.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <section className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-5 flex items-center gap-2">
                    <CheckCircle className="text-blue-500" size={22} /> Texto de Consentimento
                </h2>

                <textarea
                    className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-green outline-none h-32 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition resize-none text-base disabled:opacity-60 disabled:cursor-not-allowed"
                    value={form.custom_consent_text}
                    onChange={(e) => updateField('custom_consent_text', e.target.value)}
                    disabled={disabled}
                    placeholder="Ex: Concordo em receber mensagens automáticas via WhatsApp/SMS sobre o andamento do meu pedido."
                />
            </section>

            <section className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-5 flex items-center gap-2">
                    <MessageSquareText className="text-brand-green" size={22} /> Textos padrão
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <MessageTextarea
                        label="Mensagem manual padrão"
                        value={form.default_whatsapp_message}
                        disabled={disabled}
                        onChange={(value) => updateField('default_whatsapp_message', value)}
                    />
                    <MessageTextarea
                        label="Confirmação de pedido"
                        value={form.order_confirmation_message}
                        disabled={disabled}
                        onChange={(value) => updateField('order_confirmation_message', value)}
                    />
                    <MessageTextarea
                        label="Pedido pronto para retirada"
                        value={form.order_ready_message}
                        disabled={disabled}
                        onChange={(value) => updateField('order_ready_message', value)}
                    />
                    <MessageTextarea
                        label="Atualização de entrega"
                        value={form.delivery_update_message}
                        disabled={disabled}
                        onChange={(value) => updateField('delivery_update_message', value)}
                    />
                    <MessageTextarea
                        label="Aniversariantes"
                        value={form.birthday_message_template}
                        disabled={disabled}
                        onChange={(value) => updateField('birthday_message_template', value)}
                    />
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Assinatura das mensagens
                        </label>
                        <input
                            type="text"
                            className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-green outline-none bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                            value={form.manual_message_signature}
                            disabled={disabled}
                            onChange={(e) => updateField('manual_message_signature', e.target.value)}
                            placeholder="Ex: Equipe Gelinhares"
                        />
                        <p className="text-xs text-gray-400 mt-2">
                            Variáveis aceitas nos textos: {'{cliente}'} e {'{pedido}'}.
                        </p>
                    </div>
                </div>
            </section>

            <section className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <Smartphone className="text-orange-500" size={22} /> Integração OptmaSMSGate
                    </h2>

                    <label className={`flex items-center gap-3 bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-lg ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600'} transition`}>
                        <input
                            type="checkbox"
                            checked={form.use_sms_gateway}
                            onChange={(e) => updateField('use_sms_gateway', e.target.checked)}
                            disabled={disabled}
                            className="accent-brand-green w-5 h-5"
                        />
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                            Ativar envio de SMS
                        </span>
                    </label>
                </div>

                {form.use_sms_gateway ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-2xl">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                Token de Integração (API Key)
                            </label>
                            <input
                                type="text"
                                className="w-full p-3 border border-orange-200 dark:border-orange-800 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition font-mono text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                value={form.sms_gateway_token}
                                onChange={(e) => updateField('sms_gateway_token', e.target.value)}
                                disabled={disabled}
                                placeholder="Cole seu token aqui"
                            />
                            <p className="text-xs text-orange-600 mt-2">
                                Chave necessária para autenticar o envio de mensagens via OptmaSMSGate.
                            </p>
                        </div>

                        <div className="flex flex-col justify-center items-start md:border-l border-orange-200 dark:border-orange-800 md:pl-6 border-dashed">
                            <h3 className="font-bold text-orange-800 dark:text-orange-300 mb-2">Não tem um Gateway?</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                Use o OptmaSMSGate para transformar um Android em servidor de SMS local.
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
                ) : (
                    <div className="p-8 text-center bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-100 dark:border-gray-700 text-gray-400">
                        <MessageCircle size={48} className="mx-auto mb-3 opacity-20" />
                        <p>O envio de SMS está desativado. Ative acima para configurar.</p>
                    </div>
                )}
            </section>

            {!disabled && (
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-[#21A896] hover:bg-green-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition disabled:opacity-50 shadow-sm cursor-pointer text-sm"
                    >
                        {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                        <span>Salvar Configurações</span>
                    </button>
                </div>
            )}
        </div>
    );

    if (withoutHeader) return content;

    return (
        <PageContainer
            title="Configurações de Mensagens"
            subtitle="Padronize consentimento, textos de WhatsApp/SMS e integração OptmaSMSGate."
            category="Configurações"
            icon={<MessageCircle className="text-[#21A896]" size={28} />}
            flat
        >
            {content}
        </PageContainer>
    );
}

interface MessageTextareaProps {
    label: string;
    value: string;
    disabled: boolean;
    onChange: (value: string) => void;
}

function MessageTextarea({ label, value, disabled, onChange }: MessageTextareaProps) {
    return (
        <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                {label}
            </label>
            <textarea
                className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-green outline-none h-28 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition resize-none text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
}
