import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import {
    AlertTriangle,
    CheckCircle,
    Info,
    Loader,
    MessageCircle,
    MessageSquareText,
    RotateCcw,
    Save,
    ShieldCheck,
    Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';
import { getActiveStoreId, setActiveStoreId } from '@/utils/activeStore';
import { useSecurityContext } from '@/hooks/useSecurityContext';
import { usePermissions } from '@/hooks/usePermissions';

interface MessageSettingsProps {
    withoutHeader?: boolean;
    disabled?: boolean;
}

type StoreMessageSettings = {
    id?: string | null;
    name?: string | null;
    sms_gateway_token?: string | null;
    config?: Record<string, any> | null;
};

type MessageRiskLevel = 'low' | 'medium' | 'high';

type MessageTemplateKey =
    | 'whatsapp_initial_message'
    | 'manual_service_message'
    | 'order_received'
    | 'order_accepted'
    | 'order_preparing'
    | 'order_out_for_delivery'
    | 'order_ready_for_pickup'
    | 'order_cancelled'
    | 'payment_instructions'
    | 'pickup_instructions'
    | 'delivery_instructions'
    | 'post_purchase_thanks'
    | 'review_request'
    | 'loyalty_points';

type MessageTemplate = {
    key: MessageTemplateKey;
    group: 'Atendimento' | 'Pedido' | 'Instruções' | 'Relacionamento';
    label: string;
    description: string;
    risk: MessageRiskLevel;
    maxLength: number;
    defaultValue: string;
    marketingWarning?: boolean;
};

type MessageSettingsData = {
    version: number;
    consent: {
        customer_message_consent_text: string;
    };
    operational: Record<MessageTemplateKey, string>;
    sms: {
        use_sms_gateway: boolean;
    };
    metadata?: Record<string, unknown>;
};

type MessageSettingsForm = {
    customer_message_consent_text: string;
    sms_gateway_token: string;
    use_sms_gateway: boolean;
    templates: Record<MessageTemplateKey, string>;
};

const VARIABLES = [
    '{cliente_nome}',
    '{loja_nome}',
    '{pedido_codigo}',
    '{valor_total}',
    '{tempo_estimado}',
    '{endereco}',
    '{link_pedido}',
    '{forma_pagamento}',
    '{tipo_entrega}',
];

const PREVIEW_VALUES: Record<string, string> = {
    '{cliente_nome}': 'Maria',
    '{loja_nome}': 'Gelinhares',
    '{pedido_codigo}': 'PED-1024',
    '{valor_total}': 'R$ 32,00',
    '{tempo_estimado}': '30 minutos',
    '{endereco}': 'Rua das Flores, 123',
    '{link_pedido}': 'https://optmamenu.app/pedido/PED-1024',
    '{forma_pagamento}': 'Pix',
    '{tipo_entrega}': 'entrega',
};

const MESSAGE_TEMPLATES: MessageTemplate[] = [
    {
        key: 'whatsapp_initial_message',
        group: 'Atendimento',
        label: 'Mensagem inicial do WhatsApp',
        description: 'Texto usado para iniciar a conversa manual com o cliente pelo WhatsApp.',
        risk: 'low',
        maxLength: 220,
        defaultValue: 'Olá! Quero finalizar meu pedido com a {loja_nome}.',
    },
    {
        key: 'manual_service_message',
        group: 'Atendimento',
        label: 'Mensagem padrão de atendimento',
        description: 'Texto-base para atendimento manual, dúvidas ou retorno ao cliente.',
        risk: 'low',
        maxLength: 280,
        defaultValue: 'Olá, {cliente_nome}! Tudo bem? Estamos entrando em contato pela {loja_nome} para falar sobre seu atendimento.',
    },
    {
        key: 'order_received',
        group: 'Pedido',
        label: 'Pedido recebido',
        description: 'Mensagem para informar que o pedido chegou para análise da loja.',
        risk: 'low',
        maxLength: 240,
        defaultValue: 'Olá, {cliente_nome}! Recebemos seu pedido {pedido_codigo}. Em breve a {loja_nome} confirmará o preparo.',
    },
    {
        key: 'order_accepted',
        group: 'Pedido',
        label: 'Pedido aceito',
        description: 'Mensagem para confirmar que a loja aceitou o pedido.',
        risk: 'medium',
        maxLength: 240,
        defaultValue: 'Seu pedido {pedido_codigo} foi aceito pela {loja_nome}. Tempo estimado: {tempo_estimado}.',
    },
    {
        key: 'order_preparing',
        group: 'Pedido',
        label: 'Pedido em preparo',
        description: 'Mensagem para informar que o pedido entrou em preparo.',
        risk: 'low',
        maxLength: 220,
        defaultValue: 'Olá, {cliente_nome}! Seu pedido {pedido_codigo} está em preparo.',
    },
    {
        key: 'order_out_for_delivery',
        group: 'Pedido',
        label: 'Saiu para entrega',
        description: 'Mensagem para avisar que o pedido foi enviado para entrega.',
        risk: 'medium',
        maxLength: 260,
        defaultValue: 'Olá, {cliente_nome}! Seu pedido {pedido_codigo} saiu para entrega no endereço informado.',
    },
    {
        key: 'order_ready_for_pickup',
        group: 'Pedido',
        label: 'Pronto para retirada',
        description: 'Mensagem para avisar que o pedido pode ser retirado.',
        risk: 'low',
        maxLength: 240,
        defaultValue: 'Olá, {cliente_nome}! Seu pedido {pedido_codigo} está pronto para retirada na {loja_nome}.',
    },
    {
        key: 'order_cancelled',
        group: 'Pedido',
        label: 'Pedido cancelado',
        description: 'Mensagem sensível. Deve ser clara, respeitosa e sem tom de culpa.',
        risk: 'high',
        maxLength: 260,
        defaultValue: 'Olá, {cliente_nome}. Seu pedido {pedido_codigo} foi cancelado. Em caso de dúvida, fale com a loja pelo WhatsApp.',
    },
    {
        key: 'payment_instructions',
        group: 'Instruções',
        label: 'Instruções de pagamento',
        description: 'Orientação padrão sobre pagamento. Evite prometer aprovação automática.',
        risk: 'medium',
        maxLength: 320,
        defaultValue: 'Para confirmar seu pedido, siga as instruções de pagamento enviadas pela {loja_nome}. Após o pagamento, envie o comprovante se solicitado.',
    },
    {
        key: 'pickup_instructions',
        group: 'Instruções',
        label: 'Instruções de retirada',
        description: 'Orientação para clientes que escolhem retirada no balcão.',
        risk: 'low',
        maxLength: 300,
        defaultValue: 'A retirada é feita no balcão da {loja_nome}. Aguarde a confirmação de que o pedido está pronto antes de buscar.',
    },
    {
        key: 'delivery_instructions',
        group: 'Instruções',
        label: 'Instruções de entrega',
        description: 'Orientação para entrega, endereço e prazo.',
        risk: 'medium',
        maxLength: 320,
        defaultValue: 'Confira se o endereço está correto: {endereco}. A loja confirmará o prazo antes da entrega.',
    },
    {
        key: 'post_purchase_thanks',
        group: 'Relacionamento',
        label: 'Agradecimento pós-compra',
        description: 'Mensagem leve de agradecimento após a compra.',
        risk: 'low',
        maxLength: 220,
        defaultValue: 'Obrigado pela compra, {cliente_nome}! A {loja_nome} agradece a preferência.',
    },
    {
        key: 'review_request',
        group: 'Relacionamento',
        label: 'Pedido de avaliação',
        description: 'Use com moderação. Avaliações repetidas podem incomodar o cliente.',
        risk: 'medium',
        maxLength: 260,
        marketingWarning: true,
        defaultValue: 'Se puder, avalie sua experiência com a {loja_nome}. Sua opinião ajuda nosso atendimento a melhorar.',
    },
    {
        key: 'loyalty_points',
        group: 'Relacionamento',
        label: 'Fidelidade e pontos',
        description: 'Mensagem informativa sobre pontos/benefícios, sem virar campanha promocional.',
        risk: 'medium',
        maxLength: 260,
        marketingWarning: true,
        defaultValue: 'Você acumulou pontos nessa compra. Consulte seus benefícios com a {loja_nome}.',
    },
];

const DEFAULT_TEMPLATES = MESSAGE_TEMPLATES.reduce((acc, template) => {
    acc[template.key] = template.defaultValue;
    return acc;
}, {} as Record<MessageTemplateKey, string>);

const DEFAULT_MESSAGE_SETTINGS: MessageSettingsData = {
    version: 1,
    consent: {
        customer_message_consent_text:
            'Concordo em receber mensagens da loja sobre meu pedido, atendimento e informações necessárias para a compra.',
    },
    operational: DEFAULT_TEMPLATES,
    sms: {
        use_sms_gateway: false,
    },
};

function mergeTemplates(settings?: Partial<Record<MessageTemplateKey, string>> | null): Record<MessageTemplateKey, string> {
    return {
        ...DEFAULT_TEMPLATES,
        ...(settings ?? {}),
    };
}

function getMessageSettingsFromStore(store?: StoreMessageSettings | null): MessageSettingsData {
    const config = store?.config ?? {};
    const nestedSettings = config.message_settings as Partial<MessageSettingsData> | undefined;

    return {
        ...DEFAULT_MESSAGE_SETTINGS,
        ...(nestedSettings ?? {}),
        consent: {
            ...DEFAULT_MESSAGE_SETTINGS.consent,
            ...(nestedSettings?.consent ?? {}),
            customer_message_consent_text:
                nestedSettings?.consent?.customer_message_consent_text ??
                config.custom_consent_text ??
                DEFAULT_MESSAGE_SETTINGS.consent.customer_message_consent_text,
        },
        operational: mergeTemplates({
            ...(nestedSettings?.operational ?? {}),
            ...(config.default_whatsapp_message ? { manual_service_message: config.default_whatsapp_message } : {}),
            ...(config.order_confirmation_message ? { order_received: config.order_confirmation_message } : {}),
            ...(config.order_ready_message ? { order_ready_for_pickup: config.order_ready_message } : {}),
            ...(config.delivery_update_message ? { order_out_for_delivery: config.delivery_update_message } : {}),
            ...(config.birthday_message_template ? { loyalty_points: config.birthday_message_template } : {}),
        }),
        sms: {
            ...DEFAULT_MESSAGE_SETTINGS.sms,
            ...(nestedSettings?.sms ?? {}),
            use_sms_gateway: nestedSettings?.sms?.use_sms_gateway ?? config.use_sms_gateway === true,
        },
    };
}

function normalizeMessageSettings(store?: StoreMessageSettings | null): MessageSettingsForm {
    const settings = getMessageSettingsFromStore(store);

    return {
        customer_message_consent_text: settings.consent.customer_message_consent_text,
        use_sms_gateway: settings.sms.use_sms_gateway === true,
        sms_gateway_token: store?.sms_gateway_token ?? '',
        templates: mergeTemplates(settings.operational),
    };
}

function renderPreview(value: string): string {
    return VARIABLES.reduce((message, variable) => {
        return message.replaceAll(variable, PREVIEW_VALUES[variable] ?? variable);
    }, value || '');
}

function getRiskLabel(risk: MessageRiskLevel): string {
    if (risk === 'high') return 'Risco alto';
    if (risk === 'medium') return 'Atenção';
    return 'Operacional';
}

function getRiskClasses(risk: MessageRiskLevel): string {
    if (risk === 'high') return 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-200 dark:border-red-900/40';
    if (risk === 'medium') return 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-900/40';
    return 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-200 dark:border-green-900/40';
}

export default function MessageSettings({ withoutHeader = false, disabled = false }: MessageSettingsProps) {
    const { securityContext, loading: loadingSecurityContext } = useSecurityContext();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [store, setStore] = useState<StoreMessageSettings | null>(null);
    const [form, setForm] = useState<MessageSettingsForm>(() => normalizeMessageSettings(null));
    const [activeGroup, setActiveGroup] = useState<MessageTemplate['group']>('Atendimento');
    const [activeTemplateKey, setActiveTemplateKey] = useState<MessageTemplateKey>('whatsapp_initial_message');

    const activeStoreId = useMemo(() => {
        return getActiveStoreId() ?? securityContext?.primary_membership?.store_id ?? null;
    }, [securityContext?.primary_membership?.store_id]);

    const { allowedPermissions, loading: loadingPermissions } = usePermissions(activeStoreId);

    const activeMembership = useMemo(() => {
        const memberships = securityContext?.memberships ?? [];

        if (activeStoreId) {
            const membership = memberships.find((item) => item.store_id === activeStoreId);
            if (membership) return membership;
        }

        return securityContext?.primary_membership ?? null;
    }, [activeStoreId, securityContext?.memberships, securityContext?.primary_membership]);

    const isOwner = activeMembership?.role === 'owner';
    const canManageMessages = isOwner || allowedPermissions.includes('settings.messages.manage');
    const effectiveDisabled = disabled || !canManageMessages;

    const groupedTemplates = useMemo(() => {
        return MESSAGE_TEMPLATES.reduce((acc, template) => {
            if (!acc[template.group]) acc[template.group] = [];
            acc[template.group].push(template);
            return acc;
        }, {} as Record<MessageTemplate['group'], MessageTemplate[]>);
    }, []);

    const activeTemplate = MESSAGE_TEMPLATES.find((template) => template.key === activeTemplateKey) ?? MESSAGE_TEMPLATES[0];
    const activeMessage = form.templates[activeTemplate.key] ?? '';
    const activePreview = renderPreview(activeMessage);

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

            const { data: storeRow, error: storeRowError } = await supabase
                .from('stores')
                .select('id, name, sms_gateway_token, config')
                .eq('id', resolvedStoreId)
                .maybeSingle();

            if (storeRowError) {
                console.warn('Falha ao carregar mensagens direto de stores; tentando fallback RPC:', storeRowError);
            }

            if (storeRow) {
                const normalizedStore = {
                    ...(storeRow as StoreMessageSettings),
                    id: (storeRow as StoreMessageSettings)?.id ?? resolvedStoreId,
                };

                setStore(normalizedStore);
                setForm(normalizeMessageSettings(normalizedStore));
                return;
            }

            const { data, error } = await supabase
                .rpc('get_store_settings_center', {
                    p_store_id: resolvedStoreId,
                })
                .maybeSingle();

            if (error) throw error;
            if (!data) throw new Error('Configurações da loja não encontradas.');

            const loadedStore = Array.isArray(data) ? data[0] : data;
            const normalizedStore = {
                ...(loadedStore as StoreMessageSettings),
                id: (loadedStore as StoreMessageSettings)?.id ?? resolvedStoreId,
            };

            setStore(normalizedStore);
            setForm(normalizeMessageSettings(normalizedStore));
        } catch (error) {
            console.error('Error fetching message settings:', error);
            toast.error('Erro ao carregar configurações de mensagens.');
        } finally {
            setLoading(false);
        }
    };

    const updateTemplate = (key: MessageTemplateKey, value: string) => {
        setForm((prev) => ({
            ...prev,
            templates: {
                ...prev.templates,
                [key]: value,
            },
        }));
    };

    const appendVariable = (variable: string) => {
        if (effectiveDisabled) return;
        updateTemplate(activeTemplate.key, `${activeMessage}${activeMessage.endsWith(' ') || !activeMessage ? '' : ' '}${variable}`);
    };

    const restoreTemplateDefault = () => {
        if (effectiveDisabled) return;
        updateTemplate(activeTemplate.key, activeTemplate.defaultValue);
    };

    const restoreAllDefaults = () => {
        if (effectiveDisabled) return;
        setForm((prev) => ({
            ...prev,
            customer_message_consent_text: DEFAULT_MESSAGE_SETTINGS.consent.customer_message_consent_text,
            templates: { ...DEFAULT_TEMPLATES },
        }));
    };

    const handleSave = async () => {
        if (effectiveDisabled) {
            toast.error('Você não tem permissão para executar esta alteração.');
            return;
        }

        const targetStoreId = store?.id ?? activeStoreId;

        if (!targetStoreId) {
            toast.error('Loja ativa não encontrada. Recarregue a página e tente novamente.');
            return;
        }

        setSaving(true);
        try {
            const nextMessageSettings: MessageSettingsData = {
                version: 1,
                consent: {
                    customer_message_consent_text: form.customer_message_consent_text,
                },
                operational: mergeTemplates(form.templates),
                sms: {
                    use_sms_gateway: form.use_sms_gateway,
                },
                metadata: {
                    updated_at: new Date().toISOString(),
                    source: 'settings.messages',
                },
            };

            const nextConfig = {
                ...(store?.config ?? {}),
                message_settings: nextMessageSettings,
                custom_consent_text: form.customer_message_consent_text,
            };

            const { data, error } = await supabase
                .from('stores')
                .update({
                    sms_gateway_token: form.use_sms_gateway ? form.sms_gateway_token : '',
                    config: nextConfig,
                })
                .eq('id', targetStoreId)
                .select('id, name, sms_gateway_token, config')
                .single();

            if (error) throw error;

            const updatedStore = {
                ...(data as StoreMessageSettings),
                id: (data as StoreMessageSettings)?.id ?? targetStoreId,
            };
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

    if (loading || loadingPermissions) {
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
            {effectiveDisabled && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                    Você pode visualizar estas configurações, mas não tem permissão para alterá-las.
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <InfoCard
                    icon={<Info className="text-blue-500 mt-0.5" size={20} />}
                    className="lg:col-span-1 bg-blue-50 border-blue-100 text-blue-900 dark:bg-blue-900/10 dark:border-blue-900/30 dark:text-blue-200"
                    title="Atendimento claro e humano"
                    description="Use mensagens curtas, respeitosas e alinhadas ao pedido do cliente. O objetivo é ajudar, não pressionar."
                />
                <InfoCard
                    icon={<ShieldCheck className="text-brand-green mt-0.5" size={20} />}
                    className="lg:col-span-1 bg-green-50 border-green-100 text-green-900 dark:bg-green-900/10 dark:border-green-900/30 dark:text-green-200"
                    title="LGPD e consentimento"
                    description="Promoções e relacionamento devem respeitar consentimento. O lojista é responsável pelo conteúdo e finalidade da mensagem."
                />
                <InfoCard
                    icon={<AlertTriangle className="text-amber-500 mt-0.5" size={20} />}
                    className="lg:col-span-1 bg-amber-50 border-amber-100 text-amber-900 dark:bg-amber-900/10 dark:border-amber-900/30 dark:text-amber-200"
                    title="WhatsApp manual"
                    description="O OptmaMenu prepara textos e pode apoiar o atendimento. Envio automático e status entregue/lido dependem de integração oficial futura."
                />
            </div>

            <section className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                    <CheckCircle className="text-blue-500" size={22} /> Texto de consentimento
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Texto exibido ao cliente para explicar o uso de mensagens no atendimento e acompanhamento do pedido.
                </p>

                <textarea
                    className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-green outline-none h-28 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition resize-none text-base disabled:opacity-60 disabled:cursor-not-allowed"
                    value={form.customer_message_consent_text}
                    onChange={(e) => setForm((prev) => ({ ...prev, customer_message_consent_text: e.target.value }))}
                    disabled={effectiveDisabled}
                    maxLength={320}
                />
                <div className="flex justify-end mt-1 text-xs font-bold text-gray-400">
                    {form.customer_message_consent_text.length}/320
                </div>
            </section>

            <section className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <MessageSquareText className="text-brand-green" size={22} /> Modelos de mensagens
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Separe mensagens operacionais de marketing. Promoções e campanhas ficam na Central de Marketing.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[260px,1fr,360px] min-h-[520px]">
                    <aside className="border-b lg:border-b-0 lg:border-r border-gray-100 dark:border-gray-700 p-4 bg-gray-50/60 dark:bg-gray-900/30">
                        <div className="flex flex-wrap lg:flex-col gap-2">
                            {(Object.keys(groupedTemplates) as MessageTemplate['group'][]).map((group) => (
                                <button
                                    key={group}
                                    type="button"
                                    onClick={() => {
                                        setActiveGroup(group);
                                        setActiveTemplateKey(groupedTemplates[group][0].key);
                                    }}
                                    className={`px-4 py-3 rounded-xl text-left text-sm font-bold transition ${activeGroup === group
                                        ? 'bg-brand-green text-white shadow-sm'
                                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    {group}
                                </button>
                            ))}
                        </div>

                        <div className="mt-5 space-y-2">
                            {groupedTemplates[activeGroup].map((template) => (
                                <button
                                    key={template.key}
                                    type="button"
                                    onClick={() => setActiveTemplateKey(template.key)}
                                    className={`w-full px-3 py-2 rounded-lg text-left text-xs font-bold transition ${activeTemplateKey === template.key
                                        ? 'bg-white dark:bg-gray-800 text-brand-green border border-brand-green/30 shadow-sm'
                                        : 'text-gray-500 hover:bg-white dark:hover:bg-gray-800 border border-transparent'
                                        }`}
                                >
                                    {template.label}
                                </button>
                            ))}
                        </div>
                    </aside>

                    <main className="p-6 space-y-5">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white">{activeTemplate.label}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{activeTemplate.description}</p>
                            </div>
                            <span className={`inline-flex items-center self-start rounded-full border px-3 py-1 text-xs font-black ${getRiskClasses(activeTemplate.risk)}`}>
                                {getRiskLabel(activeTemplate.risk)}
                            </span>
                        </div>

                        {activeTemplate.marketingWarning && (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                                Use esta mensagem com cuidado. Avaliações, fidelidade e relacionamento não devem virar envio repetitivo ou promocional sem consentimento.
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                Texto da mensagem
                            </label>
                            <textarea
                                className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-green outline-none h-44 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition resize-none text-base disabled:opacity-60 disabled:cursor-not-allowed"
                                value={activeMessage}
                                onChange={(e) => updateTemplate(activeTemplate.key, e.target.value)}
                                disabled={effectiveDisabled}
                                maxLength={activeTemplate.maxLength}
                            />
                            <div className="flex justify-between mt-1 text-xs font-bold text-gray-400">
                                <span>Evite caixa alta, excesso de emojis e promessas difíceis de cumprir.</span>
                                <span>{activeMessage.length}/{activeTemplate.maxLength}</span>
                            </div>
                        </div>

                        <div>
                            <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Variáveis disponíveis</p>
                            <div className="flex flex-wrap gap-2">
                                {VARIABLES.map((variable) => (
                                    <button
                                        key={variable}
                                        type="button"
                                        onClick={() => appendVariable(variable)}
                                        disabled={effectiveDisabled}
                                        className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-600 dark:text-gray-200 hover:bg-brand-green hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {variable}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {!effectiveDisabled && (
                            <div className="flex flex-wrap gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={restoreTemplateDefault}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                >
                                    <RotateCcw size={16} /> Restaurar este padrão
                                </button>
                                <button
                                    type="button"
                                    onClick={restoreAllDefaults}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-200 bg-amber-50 text-sm font-bold text-amber-700 hover:bg-amber-100 transition dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200"
                                >
                                    <RotateCcw size={16} /> Restaurar todos os padrões
                                </button>
                            </div>
                        )}
                    </main>

                    <aside className="border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-gray-700 p-6 bg-gray-50/60 dark:bg-gray-900/30">
                        <h3 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-wide mb-3">
                            Prévia com dados de exemplo
                        </h3>
                        <div className="rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-4 text-brand-green font-black text-sm">
                                <MessageCircle size={18} /> WhatsApp / Atendimento
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-200">
                                {activePreview || 'Digite uma mensagem para visualizar a prévia.'}
                            </p>
                        </div>

                        <div className="mt-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-xs text-gray-500 dark:text-gray-400 space-y-2">
                            <p className="font-bold text-gray-700 dark:text-gray-200">Checklist rápido</p>
                            <p>• A mensagem está clara?</p>
                            <p>• O cliente espera receber esse aviso?</p>
                            <p>• O texto evita promessa exagerada?</p>
                            <p>• Não há dados sensíveis desnecessários?</p>
                        </div>
                    </aside>
                </div>
            </section>

            <section className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <Smartphone className="text-orange-500" size={22} /> Integração OptmaSMSGate
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Recurso opcional para SMS. WhatsApp oficial e automações avançadas ficam para integração futura.
                        </p>
                    </div>

                    <label className={`flex items-center gap-3 bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-lg ${effectiveDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600'} transition`}>
                        <input
                            type="checkbox"
                            checked={form.use_sms_gateway}
                            onChange={(e) => setForm((prev) => ({ ...prev, use_sms_gateway: e.target.checked }))}
                            disabled={effectiveDisabled}
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
                                onChange={(e) => setForm((prev) => ({ ...prev, sms_gateway_token: e.target.value }))}
                                disabled={effectiveDisabled}
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

            {!effectiveDisabled && (
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
            title="Mensagens e Atendimento"
            subtitle="Configure textos operacionais, atendimento via WhatsApp, retirada, entrega e relacionamento responsável."
            category="Configurações"
            icon={<MessageCircle className="text-[#21A896]" size={28} />}
            flat
        >
            {content}
        </PageContainer>
    );
}

interface InfoCardProps {
    icon: ReactNode;
    title: string;
    description: string;
    className: string;
}

function InfoCard({ icon, title, description, className }: InfoCardProps) {
    return (
        <div className={`rounded-2xl border p-5 ${className}`}>
            <div className="flex items-start gap-3">
                {icon}
                <div>
                    <h3 className="font-bold">{title}</h3>
                    <p className="text-sm mt-1 opacity-90">{description}</p>
                </div>
            </div>
        </div>
    );
}
