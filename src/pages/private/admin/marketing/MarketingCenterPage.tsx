import { useEffect, useMemo, useState } from 'react';
import {
    BadgeCheck,
    CalendarClock,
    ClipboardList,
    Edit3,
    Eye,
    Loader2,
    Megaphone,
    MessageCircle,
    Plus,
    Save,
    Send,
    Sparkles,
    Tags,
    Users,
    X,
} from 'lucide-react';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import PageContainer from '@/components/common/PageContainer';
import {
    MarketingCenterService,
    type CampaignPreparedRecipient,
    type CampaignRecipientsData,
    type CampaignRecipientsPreview,
    type CustomerSegment,
    type MarketingCenterData,
    type PromotionCampaign,
} from '@/services/marketingCenterService';

type SegmentFormState = {
    segmentId: string | null;
    code: string;
    name: string;
    description: string;
    segmentType: string;
    active: boolean;
    rulesJson: string;
    metadataJson: string;
};

type CampaignFormState = {
    campaignId: string | null;
    code: string;
    name: string;
    description: string;
    campaignType: string;
    status: string;
    targetType: string;
    targetSegmentId: string;
    targetCustomerId: string;
    targetTag: string;
    channel: string;
    title: string;
    messageTemplate: string;
    callToAction: string;
    landingUrl: string;
    benefitRuleId: string;
    startsAt: string;
    endsAt: string;
    scheduledAt: string;
    active: boolean;
    conditionsJson: string;
    metadataJson: string;
};

const emptySegmentForm: SegmentFormState = {
    segmentId: null,
    code: '',
    name: '',
    description: '',
    segmentType: 'manual',
    active: true,
    rulesJson: '{}',
    metadataJson: '{}',
};

const emptyCampaignForm: CampaignFormState = {
    campaignId: null,
    code: '',
    name: '',
    description: '',
    campaignType: 'promotion',
    status: 'draft',
    targetType: 'all',
    targetSegmentId: '',
    targetCustomerId: '',
    targetTag: '',
    channel: 'whatsapp',
    title: '',
    messageTemplate: '',
    callToAction: '',
    landingUrl: '',
    benefitRuleId: '',
    startsAt: '',
    endsAt: '',
    scheduledAt: '',
    active: true,
    conditionsJson: '{}',
    metadataJson: '{}',
};

function formatDateTime(value?: string | null) {
    if (!value) return 'Sem agendamento';
    return new Date(value).toLocaleString('pt-BR');
}

function toDateTimeLocal(value?: string | null) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
    return value ? new Date(value).toISOString() : null;
}

function parseJsonObject(value: string, label: string): Record<string, unknown> {
    if (!value.trim()) return {};

    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`${label} deve ser um objeto JSON.`);
    }

    return parsed as Record<string, unknown>;
}

function getSegmentTypeLabel(type: string) {
    const labels: Record<string, string> = {
        manual: 'Manual',
        tag: 'Tag',
        loyalty_tier: 'Nível de fidelidade',
        behavior: 'Comportamento',
        purchase_history: 'Histórico de compras',
        campaign: 'Campanha',
        custom: 'Personalizado',
    };

    return labels[type] || type;
}

function getCampaignTypeLabel(type: string) {
    const labels: Record<string, string> = {
        communication: 'Comunicação',
        promotion: 'Promoção',
        benefit: 'Benefício',
        reactivation: 'Reativação',
        birthday: 'Aniversário',
        loyalty: 'Fidelidade',
        custom: 'Personalizada',
    };

    return labels[type] || type;
}

function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
        draft: 'Rascunho',
        scheduled: 'Agendada',
        active: 'Ativa',
        paused: 'Pausada',
        completed: 'Concluída',
        cancelled: 'Cancelada',
    };

    return labels[status] || status;
}

function getChannelLabel(channel: string) {
    const labels: Record<string, string> = {
        whatsapp: 'WhatsApp',
        email: 'E-mail',
        sms: 'SMS',
        in_app: 'No app',
        manual: 'Manual',
        mixed: 'Misto',
    };

    return labels[channel] || channel;
}

function statusClass(status: string) {
    if (status === 'active') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200';
    if (status === 'scheduled') return 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200';
    if (status === 'paused') return 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200';
    if (status === 'cancelled') return 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-200';
    return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
}

function getCampaignScheduleStatus(campaign: PromotionCampaign) {
    if (!campaign.scheduled_at) {
        return {
            label: 'Sem agendamento',
            type: 'none' as const,
        };
    }

    const now = new Date();
    const scheduled = new Date(campaign.scheduled_at);

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    if (scheduled < now && campaign.status !== 'completed' && campaign.status !== 'cancelled') {
        return {
            label: 'Agendamento vencido',
            type: 'overdue' as const,
        };
    }

    if (scheduled >= todayStart && scheduled <= todayEnd) {
        return {
            label: 'Agendada para hoje',
            type: 'today' as const,
        };
    }

    return {
        label: 'Agendada',
        type: 'future' as const,
    };
}

function scheduleStatusClass(type: 'none' | 'overdue' | 'today' | 'future') {
    if (type === 'overdue') {
        return 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-200';
    }

    if (type === 'today') {
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200';
    }

    if (type === 'future') {
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200';
    }

    return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
}

function buildRulesPreview(segment: CustomerSegment) {
    const entries = Object.entries(segment.rules || {});
    if (entries.length === 0) return 'Sem regra definida';
    return entries.map(([key, value]) => `${key}: ${String(value)}`).join(' • ');
}

function buildMessagePreview(campaign: PromotionCampaign) {
    return (campaign.message_template || '')
        .replaceAll('{{customer_name}}', 'Cliente')
        .replaceAll('{{store_name}}', 'Sua loja')
        .replaceAll('{{current_date}}', new Date().toLocaleDateString('pt-BR'));
}

function stringifyJson(value?: Record<string, unknown> | null) {
    return JSON.stringify(value || {}, null, 2);
}

export default function MarketingCenterPage() {
    const { storeId, loading: loadingStore } = useCurrentStore();

    const [data, setData] = useState<MarketingCenterData | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingSegment, setSavingSegment] = useState(false);
    const [savingCampaign, setSavingCampaign] = useState(false);
    const [previewingRecipients, setPreviewingRecipients] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [segmentFormOpen, setSegmentFormOpen] = useState(false);
    const [campaignFormOpen, setCampaignFormOpen] = useState(false);
    const [segmentForm, setSegmentForm] = useState<SegmentFormState>(emptySegmentForm);
    const [campaignForm, setCampaignForm] = useState<CampaignFormState>(emptyCampaignForm);
    const [recipientsPreview, setRecipientsPreview] = useState<CampaignRecipientsPreview | null>(null);
    const [recipientsPanelOpen, setRecipientsPanelOpen] = useState(false);
    const [recipientsLoading, setRecipientsLoading] = useState(false);
    const [preparingRecipients, setPreparingRecipients] = useState<string | null>(null);
    const [markingSentId, setMarkingSentId] = useState<string | null>(null);
    const [recipientsFilter, setRecipientsFilter] = useState<'all' | 'ready' | 'sent'>('all');
    const [selectedCampaignRecipients, setSelectedCampaignRecipients] =
        useState<CampaignRecipientsData | null>(null);

    async function loadCenter() {
        if (!storeId) return;

        try {
            setLoading(true);
            setError(null);
            const result = await MarketingCenterService.getCenter(storeId);
            setData(result);
        } catch (err: unknown) {
            console.error('Erro ao carregar central de marketing:', err);
            setError(err instanceof Error ? err.message : 'Erro ao carregar central de marketing.');
        } finally {
            setLoading(false);
        }
    }

    async function handleRefreshSegments() {
        if (!storeId) return;

        try {
            setError(null);
            setMessage(null);
            const result = await MarketingCenterService.refreshSegments(storeId);

            if (!result.ok) {
                setError(result.error || 'Não foi possível atualizar segmentos.');
                return;
            }

            setMessage(`${result.members_refreshed || 0} vínculo(s) de clientes atualizados nos segmentos.`);
            await loadCenter();
        } catch (err: unknown) {
            console.error('Erro ao atualizar segmentos:', err);
            setError(err instanceof Error ? err.message : 'Erro ao atualizar segmentos.');
        } finally {
        }
    }

    function openNewSegment() {
        setSegmentForm(emptySegmentForm);
        setSegmentFormOpen(true);
    }

    function openEditSegment(segment: CustomerSegment) {
        setSegmentForm({
            segmentId: segment.id,
            code: segment.code || '',
            name: segment.name || '',
            description: segment.description || '',
            segmentType: segment.segment_type || 'manual',
            active: segment.active,
            rulesJson: stringifyJson(segment.rules),
            metadataJson: '{}',
        });
        setSegmentFormOpen(true);
    }

    function openNewCampaign() {
        setRecipientsPreview(null);
        setCampaignForm(emptyCampaignForm);
        setCampaignFormOpen(true);
    }

    function openEditCampaign(campaign: PromotionCampaign) {
        setRecipientsPreview(null);
        setCampaignForm({
            campaignId: campaign.id,
            code: campaign.code || '',
            name: campaign.name || '',
            description: campaign.description || '',
            campaignType: campaign.campaign_type || 'promotion',
            status: campaign.status || 'draft',
            targetType: campaign.target_type || 'all',
            targetSegmentId: campaign.target_segment_id || '',
            targetCustomerId: campaign.target_customer_id || '',
            targetTag: campaign.target_tag || '',
            channel: campaign.channel || 'whatsapp',
            title: campaign.title || '',
            messageTemplate: campaign.message_template || '',
            callToAction: campaign.call_to_action || '',
            landingUrl: campaign.landing_url || '',
            benefitRuleId: campaign.benefit_rule_id || '',
            startsAt: toDateTimeLocal(campaign.starts_at),
            endsAt: toDateTimeLocal(campaign.ends_at),
            scheduledAt: toDateTimeLocal(campaign.scheduled_at),
            active: campaign.active,
            conditionsJson: '{}',
            metadataJson: '{}',
        });
        setCampaignFormOpen(true);
    }

    async function handleSaveSegment(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!storeId) return;

        try {
            setSavingSegment(true);
            setError(null);
            setMessage(null);

            const result = await MarketingCenterService.upsertSegment({
                storeId,
                segmentId: segmentForm.segmentId,
                code: segmentForm.code,
                name: segmentForm.name,
                description: segmentForm.description,
                segmentType: segmentForm.segmentType,
                active: segmentForm.active,
                rules: parseJsonObject(segmentForm.rulesJson, 'Regras'),
                metadata: parseJsonObject(segmentForm.metadataJson, 'Metadados'),
            });

            if (!result.ok) {
                setError(result.error || 'Não foi possível salvar o segmento.');
                return;
            }

            setMessage(result.message || 'Segmento salvo com sucesso.');
            setSegmentFormOpen(false);
            await loadCenter();
        } catch (err: unknown) {
            console.error('Erro ao salvar segmento:', err);
            setError(err instanceof Error ? err.message : 'Erro ao salvar segmento.');
        } finally {
            setSavingSegment(false);
        }
    }

    async function handleSaveCampaign(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!storeId) return;

        try {
            setSavingCampaign(true);
            setError(null);
            setMessage(null);

            const result = await MarketingCenterService.upsertCampaign({
                storeId,
                campaignId: campaignForm.campaignId,
                code: campaignForm.code,
                name: campaignForm.name,
                description: campaignForm.description,
                campaignType: campaignForm.campaignType,
                status: campaignForm.status,
                targetType: campaignForm.targetType,
                targetSegmentId: campaignForm.targetSegmentId,
                targetCustomerId: campaignForm.targetCustomerId,
                targetTag: campaignForm.targetTag,
                channel: campaignForm.channel,
                title: campaignForm.title,
                messageTemplate: campaignForm.messageTemplate,
                callToAction: campaignForm.callToAction,
                landingUrl: campaignForm.landingUrl,
                benefitRuleId: campaignForm.benefitRuleId,
                startsAt: fromDateTimeLocal(campaignForm.startsAt),
                endsAt: fromDateTimeLocal(campaignForm.endsAt),
                scheduledAt: fromDateTimeLocal(campaignForm.scheduledAt),
                active: campaignForm.active,
                conditions: parseJsonObject(campaignForm.conditionsJson, 'Condições'),
                metadata: parseJsonObject(campaignForm.metadataJson, 'Metadados'),
            });

            if (!result.ok) {
                setError(result.error || 'Não foi possível salvar a campanha.');
                return;
            }

            setMessage(result.message || 'Campanha salva com sucesso.');
            setCampaignFormOpen(false);
            await loadCenter();
        } catch (err: unknown) {
            console.error('Erro ao salvar campanha:', err);
            setError(err instanceof Error ? err.message : 'Erro ao salvar campanha.');
        } finally {
            setSavingCampaign(false);
        }
    }

    async function handlePreviewRecipients(campaign?: PromotionCampaign) {
        if (!storeId) return;

        try {
            setPreviewingRecipients(true);
            setError(null);

            const preview = await MarketingCenterService.previewRecipients({
                storeId,
                campaignId: campaign?.id || campaignForm.campaignId,
                targetType: campaign?.target_type || campaignForm.targetType,
                targetSegmentId: campaign?.target_segment_id || campaignForm.targetSegmentId,
                targetCustomerId: campaign?.target_customer_id || campaignForm.targetCustomerId,
                targetTag: campaign?.target_tag || campaignForm.targetTag,
                channel: campaign?.channel || campaignForm.channel,
                limit: 20,
            });

            if (!preview.ok) {
                setError(preview.error || 'Não foi possível montar a prévia de destinatários.');
                return;
            }

            setRecipientsPreview(preview);
            if (campaign) {
                openEditCampaign(campaign);
                setRecipientsPreview(preview);
            }
        } catch (err: unknown) {
            console.error('Erro ao pré-visualizar destinatários:', err);
            setError(err instanceof Error ? err.message : 'Erro ao pré-visualizar destinatários.');
        } finally {
            setPreviewingRecipients(false);
        }
    }

    useEffect(() => {
        if (!loadingStore && storeId) {
            loadCenter();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingStore, storeId]);

    const totalAudience = useMemo(() => {
        return (data?.segments || []).reduce((sum, segment) => sum + Number(segment.members_count || 0), 0);
    }, [data]);

    const scheduledCampaigns = useMemo(() => {
        return (data?.campaigns || []).filter(
            (campaign) =>
                campaign.scheduled_at &&
                campaign.status !== 'completed' &&
                campaign.status !== 'cancelled'
        );
    }, [data]);

    const campaignsScheduledToday = useMemo(() => {
        return scheduledCampaigns.filter(
            (campaign) => getCampaignScheduleStatus(campaign).type === 'today'
        );
    }, [scheduledCampaigns]);

    const overdueCampaigns = useMemo(() => {
        return scheduledCampaigns.filter(
            (campaign) => getCampaignScheduleStatus(campaign).type === 'overdue'
        );
    }, [scheduledCampaigns]);

    function normalizePhoneForWhatsapp(phone?: string | null) {
        const digits = String(phone || '').replace(/\D/g, '');

        if (!digits) return '';

        if (digits.startsWith('55')) return digits;

        return `55${digits}`;
    }

    function buildWhatsappUrl(recipient: CampaignPreparedRecipient) {
        const phone = normalizePhoneForWhatsapp(recipient.recipient_phone);
        const whatsappMessage = encodeURIComponent(recipient.message_preview || '');

        if (!phone) return '';

        return `https://wa.me/${phone}?text=${whatsappMessage}`;
    }

    function isRecipientSentStatus(status: string) {
        return ['sent', 'delivered', 'read', 'clicked', 'converted'].includes(status);
    }

    const filteredCampaignRecipients = useMemo(() => {
        const recipients = selectedCampaignRecipients?.recipients || [];

        if (recipientsFilter === 'ready') {
            return recipients.filter((recipient) => !isRecipientSentStatus(recipient.status));
        }

        if (recipientsFilter === 'sent') {
            return recipients.filter((recipient) => isRecipientSentStatus(recipient.status));
        }

        return recipients;
    }, [selectedCampaignRecipients, recipientsFilter]);

    function handleOpenNextPendingRecipient() {
        const nextRecipient = (selectedCampaignRecipients?.recipients || []).find(
            (recipient) =>
                !isRecipientSentStatus(recipient.status) &&
                Boolean(buildWhatsappUrl(recipient))
        );

        if (!nextRecipient) {
            setMessage('Nenhum destinatário pendente com WhatsApp disponível.');
            return;
        }

        const url = buildWhatsappUrl(nextRecipient);

        window.open(url, '_blank', 'noopener,noreferrer');
    }

    async function handlePrepareRecipients(campaign: PromotionCampaign) {
        if (!storeId) return;

        try {
            setPreparingRecipients(campaign.id);
            setError(null);
            setMessage(null);

            const result = await MarketingCenterService.prepareCampaignRecipients({
                storeId,
                campaignId: campaign.id,
                limit: 500,
            });

            if (!result.ok) {
                setError(result.message || result.error || 'Não foi possível preparar destinatários.');
                return;
            }

            setMessage(
                `${result.recipients_prepared || 0} destinatário(s) preparado(s) para a campanha.`
            );

            await handleOpenRecipients(campaign, false);
            await loadCenter();
        } catch (err: unknown) {
            console.error('Erro ao preparar destinatários:', err);
            setError(err instanceof Error ? err.message : 'Erro ao preparar destinatários.');
        } finally {
            setPreparingRecipients(null);
        }
    }

    async function handleOpenRecipients(campaign: PromotionCampaign, clearMessages = true) {
        if (!storeId) return;

        try {
            setRecipientsLoading(true);

            if (clearMessages) {
                setError(null);
                setMessage(null);
            }

            const result = await MarketingCenterService.getCampaignRecipients({
                storeId,
                campaignId: campaign.id,
            });

            setSelectedCampaignRecipients({
                campaign: result.campaign,
                recipients: result.recipients || [],
            });

            setRecipientsFilter('all');
            setRecipientsPanelOpen(true);

            setTimeout(() => {
                document
                    .getElementById('campaign-recipients-panel')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        } catch (err: unknown) {
            console.error('Erro ao carregar destinatários:', err);
            setError(err instanceof Error ? err.message : 'Erro ao carregar destinatários.');
        } finally {
            setRecipientsLoading(false);
        }
    }

    async function handleMarkRecipientSent(recipient: CampaignPreparedRecipient) {
        if (!storeId || !selectedCampaignRecipients) return;

        try {
            setMarkingSentId(recipient.id);
            setError(null);
            setMessage(null);

            const result = await MarketingCenterService.markRecipientManualSent({
                storeId,
                recipientId: recipient.id,
            });

            if (!result.ok) {
                setError(result.error || 'Não foi possível marcar como enviado.');
                return;
            }

            setSelectedCampaignRecipients((prev) => {
                if (!prev) return prev;

                return {
                    ...prev,
                    recipients: prev.recipients.map((item) =>
                        item.id === recipient.id
                            ? {
                                ...item,
                                status: 'sent',
                                sent_at: new Date().toISOString(),
                            }
                            : item
                    ),
                };
            });

            setMessage('Destinatário marcado como enviado manualmente.');
            await loadCenter();
        } catch (err: unknown) {
            console.error('Erro ao marcar destinatário como enviado:', err);
            setError(err instanceof Error ? err.message : 'Erro ao marcar destinatário como enviado.');
        } finally {
            setMarkingSentId(null);
        }
    }

    if (loadingStore || loading) {
        return (
            <div className="p-6">
                <div className="rounded-3xl bg-white p-8 shadow-sm dark:bg-gray-900">
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                        <Loader2 className="animate-spin" size={20} />
                        Carregando central de marketing...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <PageContainer
            title="Segmentos e promoções"
            subtitle="Organize públicos, campanhas e mensagens dirigidas para WhatsApp, e-mail e ações futuras."
            category="Comercial"
            icon={<Megaphone size={28} className="text-[#19A999]" />}
            onRefresh={handleRefreshSegments}
            action={
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={openNewSegment}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-purple-200 px-4 py-2 text-sm font-black text-purple-700 transition hover:bg-purple-50 dark:border-purple-900/50 dark:text-purple-200 dark:hover:bg-purple-950/30"
                    >
                        <Plus size={16} />
                        Novo segmento
                    </button>
                    <button
                        type="button"
                        onClick={openNewCampaign}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-black text-white transition hover:bg-purple-700"
                    >
                        <Sparkles size={16} />
                        Nova campanha
                    </button>
                </div>
            }
            flat
        >

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                    {error}
                </div>
            )}

            {message && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                    {message}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <SummaryCard icon={<Tags size={18} />} label="Segmentos" value={data?.summary.total_segments || 0} detail={`${data?.summary.active_segments || 0} ativos`} color="text-purple-600" />
                <SummaryCard icon={<Users size={18} />} label="Audiência mapeada" value={totalAudience} detail="soma dos vínculos ativos" color="text-emerald-600" />
                <SummaryCard icon={<ClipboardList size={18} />} label="Campanhas" value={data?.summary.total_campaigns || 0} detail={`${data?.summary.draft_campaigns || 0} rascunho(s)`} color="text-blue-600" />
                <SummaryCard icon={<Send size={18} />} label="Agendadas/ativas" value={(data?.summary.scheduled_campaigns || 0) + (data?.summary.active_campaigns || 0)} detail="prontas para ação" color="text-amber-600" />
            </div>

            {(campaignsScheduledToday.length > 0 || overdueCampaigns.length > 0) && (
                <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-black text-amber-700 dark:bg-gray-950 dark:text-amber-200">
                                <CalendarClock size={14} />
                                Lembretes de campanhas
                            </div>

                            <h2 className="mt-3 text-xl font-black text-gray-900 dark:text-white">
                                Você tem campanhas que precisam de atenção
                            </h2>

                            <p className="mt-1 text-sm text-amber-800 dark:text-amber-100">
                                As campanhas agendadas não são enviadas automaticamente. Use este bloco para lembrar de preparar e enviar manualmente.
                            </p>
                        </div>

                        <div className="rounded-2xl bg-white px-4 py-3 text-center dark:bg-gray-950">
                            <p className="text-2xl font-black text-amber-700 dark:text-amber-200">
                                {campaignsScheduledToday.length + overdueCampaigns.length}
                            </p>
                            <p className="text-xs font-bold uppercase text-amber-600 dark:text-amber-300">
                                pendência(s)
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {overdueCampaigns.map((campaign) => (
                            <div
                                key={campaign.id}
                                className="rounded-2xl border border-red-200 bg-white p-4 dark:border-red-900/40 dark:bg-gray-950"
                            >
                                <p className="font-black text-gray-900 dark:text-white">
                                    {campaign.name}
                                </p>

                                <p className="mt-1 text-xs text-red-600 dark:text-red-300">
                                    Vencida em {formatDateTime(campaign.scheduled_at)}
                                </p>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handlePrepareRecipients(campaign)}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-3 py-2 text-xs font-black text-white transition hover:bg-purple-700"
                                    >
                                        <Send size={14} />
                                        Preparar todos
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            void handleOpenRecipients(campaign);
                                        }}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                    >
                                        <Users size={14} />
                                        Destinatários
                                    </button>
                                </div>
                            </div>
                        ))}

                        {campaignsScheduledToday.map((campaign) => (
                            <div
                                key={campaign.id}
                                className="rounded-2xl border border-amber-200 bg-white p-4 dark:border-amber-900/40 dark:bg-gray-950"
                            >
                                <p className="font-black text-gray-900 dark:text-white">
                                    {campaign.name}
                                </p>

                                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                                    Agendada para hoje: {formatDateTime(campaign.scheduled_at)}
                                </p>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handlePrepareRecipients(campaign)}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-3 py-2 text-xs font-black text-white transition hover:bg-purple-700"
                                    >
                                        <Send size={14} />
                                        Preparar todos
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            void handleOpenRecipients(campaign);
                                        }}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                    >
                                        <Users size={14} />
                                        Destinatários
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {recipientsPanelOpen && selectedCampaignRecipients && (
                <section
                    id="campaign-recipients-panel"
                    className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm dark:border-purple-900/40 dark:bg-gray-900"
                >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-sm font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                <Users size={14} />
                                Destinatários preparados
                            </div>

                            <h2 className="mt-3 text-xl font-black text-gray-900 dark:text-white">
                                {selectedCampaignRecipients.campaign.name}
                            </h2>

                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {selectedCampaignRecipients.recipients.length} destinatário(s) preparado(s).
                                Mostrando {filteredCampaignRecipients.length} no filtro atual.
                                O sistema não envia automaticamente; o envio é manual pelo WhatsApp.
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setRecipientsFilter('all')}
                                    className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                                        recipientsFilter === 'all'
                                            ? 'bg-purple-600 text-white'
                                            : 'border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    Todos
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setRecipientsFilter('ready')}
                                    className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                                        recipientsFilter === 'ready'
                                            ? 'bg-purple-600 text-white'
                                            : 'border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    Prontos
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setRecipientsFilter('sent')}
                                    className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                                        recipientsFilter === 'sent'
                                            ? 'bg-purple-600 text-white'
                                            : 'border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    Enviados
                                </button>

                                <button
                                    type="button"
                                    onClick={handleOpenNextPendingRecipient}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-700"
                                >
                                    <MessageCircle size={14} />
                                    Abrir próximo pendente
                                </button>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setRecipientsPanelOpen(false);
                                setSelectedCampaignRecipients(null);
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                            <X size={14} />
                            Fechar
                        </button>
                    </div>

                    <div className="mt-5 overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-800">
                                <thead className="bg-gray-50 dark:bg-gray-950">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500">Cliente</th>
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500">Contato</th>
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500">Mensagem</th>
                                        <th className="px-4 py-3 text-right text-xs font-black uppercase text-gray-500">Ações</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                                    {filteredCampaignRecipients.map((recipient) => {
                                        const whatsappUrl = buildWhatsappUrl(recipient);
                                        const alreadySent = isRecipientSentStatus(recipient.status);

                                        return (
                                            <tr key={recipient.id}>
                                                <td className="px-4 py-3">
                                                    <p className="font-black text-gray-900 dark:text-white">
                                                        {recipient.recipient_name || 'Cliente sem nome'}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        ID: {recipient.customer_id.slice(0, 8)}
                                                    </p>
                                                </td>

                                                <td className="px-4 py-3">
                                                    <p className="font-bold text-gray-700 dark:text-gray-200">
                                                        {recipient.recipient_phone || 'Sem telefone'}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {recipient.recipient_email || 'Sem e-mail'}
                                                    </p>
                                                </td>

                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`rounded-full px-2 py-1 text-xs font-black ${alreadySent
                                                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200'
                                                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                                                            }`}
                                                    >
                                                        {alreadySent ? 'Enviado manualmente' : 'Pronto'}
                                                    </span>

                                                    {recipient.sent_at && (
                                                        <p className="mt-1 text-xs text-gray-400">
                                                            {formatDateTime(recipient.sent_at)}
                                                        </p>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3">
                                                    <div className="max-w-md rounded-xl bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-950 dark:text-gray-300">
                                                        <p className="line-clamp-4 whitespace-pre-wrap">
                                                            {recipient.message_preview || 'Sem mensagem.'}
                                                        </p>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex flex-col justify-end gap-2 sm:flex-row">
                                                        <a
                                                            href={whatsappUrl || undefined}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            aria-disabled={!whatsappUrl}
                                                            className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-white transition ${whatsappUrl
                                                                    ? 'bg-emerald-600 hover:bg-emerald-700'
                                                                    : 'pointer-events-none bg-gray-300'
                                                                }`}
                                                        >
                                                            <MessageCircle size={14} />
                                                            WhatsApp
                                                        </a>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleMarkRecipientSent(recipient)}
                                                            disabled={alreadySent || markingSentId === recipient.id}
                                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                                        >
                                                            {markingSentId === recipient.id ? (
                                                                <Loader2 className="animate-spin" size={14} />
                                                            ) : (
                                                                <BadgeCheck size={14} />
                                                            )}
                                                            Marcar enviado
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {filteredCampaignRecipients.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                                                Nenhum destinatário preparado para esta campanha.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            )}

            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Tags size={18} className="text-purple-600" />
                        <h2 className="text-lg font-black text-gray-900 dark:text-white">Segmentos de clientes</h2>
                    </div>
                    <button type="button" onClick={openNewSegment} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-purple-700 hover:bg-purple-50 dark:text-purple-200 dark:hover:bg-purple-950/30" title="Novo segmento">
                        <Plus size={18} />
                    </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {(data?.segments || []).map((segment) => (
                        <div key={segment.id} className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-black text-gray-900 dark:text-white">{segment.name}</p>
                                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">{getSegmentTypeLabel(segment.segment_type)}</span>
                                        {segment.active && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                                                <BadgeCheck size={12} />
                                                Ativo
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{segment.description || buildRulesPreview(segment)}</p>
                                    <p className="mt-2 text-xs text-gray-400">Regra: {buildRulesPreview(segment)}</p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className="rounded-2xl bg-purple-50 px-4 py-3 text-center dark:bg-purple-950/30">
                                        <p className="text-2xl font-black text-purple-700 dark:text-purple-200">{segment.members_count || 0}</p>
                                        <p className="text-xs font-bold uppercase text-purple-600 dark:text-purple-300">clientes</p>
                                    </div>
                                    <button type="button" onClick={() => openEditSegment(segment)} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800" title="Editar segmento">
                                        <Edit3 size={17} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {(data?.segments || []).length === 0 && (
                        <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
                            Nenhum segmento configurado.
                        </div>
                    )}
                </div>
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Megaphone size={18} className="text-purple-600" />
                        <h2 className="text-lg font-black text-gray-900 dark:text-white">Campanhas e modelos de comunicação</h2>
                    </div>
                    <button type="button" onClick={openNewCampaign} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-purple-700 hover:bg-purple-50 dark:text-purple-200 dark:hover:bg-purple-950/30" title="Nova campanha">
                        <Plus size={18} />
                    </button>
                </div>

                <div className="mt-4 space-y-4">
                    {(data?.campaigns || []).map((campaign) => (
                        <div key={campaign.id} className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-black text-gray-900 dark:text-white">{campaign.name}</p>
                                        <span className={`rounded-full px-2 py-1 text-xs font-black ${statusClass(campaign.status)}`}>{getStatusLabel(campaign.status)}</span>
                                        {campaign.scheduled_at && (
                                            <span
                                                className={`rounded-full px-2 py-1 text-xs font-black ${scheduleStatusClass(
                                                    getCampaignScheduleStatus(campaign).type
                                                )}`}
                                            >
                                                {getCampaignScheduleStatus(campaign).label}
                                            </span>
                                        )}
                                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">{getCampaignTypeLabel(campaign.campaign_type)}</span>
                                    </div>

                                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{campaign.description || campaign.title || 'Sem descrição.'}</p>

                                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1 dark:bg-gray-950"><MessageCircle size={12} />{getChannelLabel(campaign.channel)}</span>
                                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1 dark:bg-gray-950"><Users size={12} />{campaign.target_segment_name || campaign.target_tag || campaign.target_type}</span>
                                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1 dark:bg-gray-950"><CalendarClock size={12} />{formatDateTime(campaign.scheduled_at)}</span>
                                    </div>

                                    {campaign.message_template && (
                                        <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700 dark:bg-gray-950 dark:text-gray-200">
                                            <p className="mb-1 text-xs font-black uppercase text-gray-400">Prévia da mensagem</p>
                                            <p className="whitespace-pre-wrap">{buildMessagePreview(campaign)}</p>
                                        </div>
                                    )}

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <button type="button" onClick={() => handlePreviewRecipients(campaign)} disabled={previewingRecipients} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                                            {previewingRecipients ? <Loader2 className="animate-spin" size={14} /> : <Eye size={14} />}
                                            Prévia
                                        </button>
                                        <button type="button" onClick={() => openEditCampaign(campaign)} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                                            <Edit3 size={14} />
                                            Editar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handlePrepareRecipients(campaign)}
                                            disabled={preparingRecipients === campaign.id}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-purple-200 px-3 py-2 text-xs font-black text-purple-700 transition hover:bg-purple-50 disabled:opacity-60 dark:border-purple-900/40 dark:text-purple-200 dark:hover:bg-purple-950/30"
                                        >
                                            {preparingRecipients === campaign.id ? (
                                                <Loader2 className="animate-spin" size={14} />
                                            ) : (
                                                <Send size={14} />
                                            )}
                                            Preparar todos
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                void handleOpenRecipients(campaign);
                                            }}
                                            disabled={recipientsLoading}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                        >
                                            {recipientsLoading ? (
                                                <Loader2 className="animate-spin" size={14} />
                                            ) : (
                                                <Users size={14} />
                                            )}
                                            Destinatários
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-5 lg:w-90">
                                    <MetricBox label="enviados" value={campaign.sent_count || 0} />
                                    <MetricBox label="entregues" value={campaign.delivered_count || 0} />
                                    <MetricBox label="lidos" value={campaign.read_count || 0} />
                                    <MetricBox label="cliques" value={campaign.clicked_count || 0} />
                                    <MetricBox label="conversões" value={campaign.converted_count || 0} success />
                                </div>
                            </div>
                        </div>
                    ))}

                    {(data?.campaigns || []).length === 0 && (
                        <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
                            Nenhuma campanha configurada.
                        </div>
                    )}
                </div>
            </section>

            {segmentFormOpen && (
                <Modal title={segmentForm.segmentId ? 'Editar segmento' : 'Novo segmento'} onClose={() => setSegmentFormOpen(false)}>
                    <form onSubmit={handleSaveSegment} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <TextField label="Nome" value={segmentForm.name} onChange={(value) => setSegmentForm((prev) => ({ ...prev, name: value }))} required />
                            <TextField label="Código" value={segmentForm.code} onChange={(value) => setSegmentForm((prev) => ({ ...prev, code: value }))} />
                            <SelectField label="Tipo" value={segmentForm.segmentType} onChange={(value) => setSegmentForm((prev) => ({ ...prev, segmentType: value }))} options={[
                                ['manual', 'Manual'],
                                ['tag', 'Tag'],
                                ['loyalty_tier', 'Nível de fidelidade'],
                                ['behavior', 'Comportamento'],
                                ['purchase_history', 'Histórico de compras'],
                                ['campaign', 'Campanha'],
                                ['custom', 'Personalizado'],
                            ]} />
                            <label className="flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200">
                                <input type="checkbox" checked={segmentForm.active} onChange={(event) => setSegmentForm((prev) => ({ ...prev, active: event.target.checked }))} />
                                Segmento ativo
                            </label>
                        </div>
                        <TextArea label="Descrição" value={segmentForm.description} onChange={(value) => setSegmentForm((prev) => ({ ...prev, description: value }))} rows={2} />
                        <TextArea label="Regras JSON" value={segmentForm.rulesJson} onChange={(value) => setSegmentForm((prev) => ({ ...prev, rulesJson: value }))} rows={5} monospace />
                        <TextArea label="Metadados JSON" value={segmentForm.metadataJson} onChange={(value) => setSegmentForm((prev) => ({ ...prev, metadataJson: value }))} rows={4} monospace />
                        <FormActions saving={savingSegment} onCancel={() => setSegmentFormOpen(false)} />
                    </form>
                </Modal>
            )}

            {campaignFormOpen && (
                <Modal title={campaignForm.campaignId ? 'Editar campanha' : 'Nova campanha'} onClose={() => setCampaignFormOpen(false)} wide>
                    <form onSubmit={handleSaveCampaign} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <TextField label="Nome" value={campaignForm.name} onChange={(value) => setCampaignForm((prev) => ({ ...prev, name: value }))} required />
                            <TextField label="Código" value={campaignForm.code} onChange={(value) => setCampaignForm((prev) => ({ ...prev, code: value }))} />
                            <SelectField label="Tipo" value={campaignForm.campaignType} onChange={(value) => setCampaignForm((prev) => ({ ...prev, campaignType: value }))} options={[
                                ['communication', 'Comunicação'],
                                ['promotion', 'Promoção'],
                                ['benefit', 'Benefício'],
                                ['reactivation', 'Reativação'],
                                ['birthday', 'Aniversário'],
                                ['loyalty', 'Fidelidade'],
                                ['custom', 'Personalizada'],
                            ]} />
                            <SelectField label="Status" value={campaignForm.status} onChange={(value) => setCampaignForm((prev) => ({ ...prev, status: value }))} options={[
                                ['draft', 'Rascunho'],
                                ['scheduled', 'Agendada'],
                                ['active', 'Ativa'],
                                ['paused', 'Pausada'],
                                ['completed', 'Concluída'],
                                ['cancelled', 'Cancelada'],
                            ]} />
                            <SelectField label="Público" value={campaignForm.targetType} onChange={(value) => setCampaignForm((prev) => ({ ...prev, targetType: value }))} options={[
                                ['all', 'Todos'],
                                ['segment', 'Segmento'],
                                ['customer', 'Cliente específico'],
                                ['tag', 'Tag'],
                            ]} />
                            <SelectField label="Canal" value={campaignForm.channel} onChange={(value) => setCampaignForm((prev) => ({ ...prev, channel: value }))} options={[
                                ['whatsapp', 'WhatsApp'],
                                ['email', 'E-mail'],
                                ['sms', 'SMS'],
                                ['in_app', 'No app'],
                                ['manual', 'Manual'],
                                ['mixed', 'Misto'],
                            ]} />
                            <SelectField label="Segmento alvo" value={campaignForm.targetSegmentId} onChange={(value) => setCampaignForm((prev) => ({ ...prev, targetSegmentId: value }))} options={[
                                ['', 'Nenhum'],
                                ...(data?.segments || []).map((segment) => [segment.id, segment.name] as [string, string]),
                            ]} />
                            <TextField label="Tag alvo" value={campaignForm.targetTag} onChange={(value) => setCampaignForm((prev) => ({ ...prev, targetTag: value }))} />
                        </div>

                        <TextArea label="Descrição" value={campaignForm.description} onChange={(value) => setCampaignForm((prev) => ({ ...prev, description: value }))} rows={2} />
                        <TextField label="Título" value={campaignForm.title} onChange={(value) => setCampaignForm((prev) => ({ ...prev, title: value }))} />
                        <TextArea label="Modelo de mensagem" value={campaignForm.messageTemplate} onChange={(value) => setCampaignForm((prev) => ({ ...prev, messageTemplate: value }))} rows={5} />

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <TextField label="Chamada para ação" value={campaignForm.callToAction} onChange={(value) => setCampaignForm((prev) => ({ ...prev, callToAction: value }))} />
                            <TextField label="URL de destino" value={campaignForm.landingUrl} onChange={(value) => setCampaignForm((prev) => ({ ...prev, landingUrl: value }))} />
                            <TextField label="ID do cliente alvo" value={campaignForm.targetCustomerId} onChange={(value) => setCampaignForm((prev) => ({ ...prev, targetCustomerId: value }))} />
                            <TextField label="ID da regra de benefício" value={campaignForm.benefitRuleId} onChange={(value) => setCampaignForm((prev) => ({ ...prev, benefitRuleId: value }))} />
                            <DateTimeField label="Início" value={campaignForm.startsAt} onChange={(value) => setCampaignForm((prev) => ({ ...prev, startsAt: value }))} />
                            <DateTimeField label="Fim" value={campaignForm.endsAt} onChange={(value) => setCampaignForm((prev) => ({ ...prev, endsAt: value }))} />
                            <DateTimeField label="Agendamento" value={campaignForm.scheduledAt} onChange={(value) => setCampaignForm((prev) => ({ ...prev, scheduledAt: value }))} />
                            <label className="flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200">
                                <input type="checkbox" checked={campaignForm.active} onChange={(event) => setCampaignForm((prev) => ({ ...prev, active: event.target.checked }))} />
                                Campanha ativa
                            </label>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <TextArea label="Condições JSON" value={campaignForm.conditionsJson} onChange={(value) => setCampaignForm((prev) => ({ ...prev, conditionsJson: value }))} rows={4} monospace />
                            <TextArea label="Metadados JSON" value={campaignForm.metadataJson} onChange={(value) => setCampaignForm((prev) => ({ ...prev, metadataJson: value }))} rows={4} monospace />
                        </div>

                        <div className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="font-black text-gray-900 dark:text-white">Prévia de destinatários</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{recipientsPreview?.total_recipients ?? 0} destinatário(s) encontrados</p>
                                </div>
                                <button type="button" onClick={() => handlePreviewRecipients()} disabled={previewingRecipients} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-2 text-sm font-black text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                                    {previewingRecipients ? <Loader2 className="animate-spin" size={16} /> : <Eye size={16} />}
                                    Gerar prévia
                                </button>
                            </div>
                            {recipientsPreview?.recipients && recipientsPreview.recipients.length > 0 && (
                                <div className="mt-4 max-h-56 overflow-auto rounded-2xl border border-gray-100 dark:border-gray-800">
                                    {recipientsPreview.recipients.map((recipient) => (
                                        <div key={recipient.customer_id} className="flex flex-col gap-1 border-b border-gray-100 p-3 text-sm last:border-b-0 dark:border-gray-800">
                                            <span className="font-bold text-gray-900 dark:text-white">{recipient.customer_name || 'Cliente sem nome'}</span>
                                            <span className="text-xs text-gray-500">{recipient.phone || recipient.email || 'Sem contato'} · {recipient.source || 'origem não informada'}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <FormActions saving={savingCampaign} onCancel={() => setCampaignFormOpen(false)} />
                    </form>
                </Modal>
            )}
        </PageContainer>
    );
}

function SummaryCard({ icon, label, value, detail, color }: { icon: React.ReactNode; label: string; value: number; detail: string; color: string }) {
    return (
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className={`flex items-center gap-2 ${color}`}>
                {icon}
                <p className="text-xs font-bold uppercase">{label}</p>
            </div>
            <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">{value}</p>
            <p className="mt-1 text-xs text-gray-500">{detail}</p>
        </div>
    );
}

function MetricBox({ label, value, success = false }: { label: string; value: number; success?: boolean }) {
    return (
        <div className={`rounded-2xl p-3 ${success ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-gray-50 dark:bg-gray-950'}`}>
            <p className={`text-lg font-black ${success ? 'text-emerald-700 dark:text-emerald-200' : 'text-gray-900 dark:text-white'}`}>{value}</p>
            <p className={`text-[10px] font-bold uppercase ${success ? 'text-emerald-600 dark:text-emerald-300' : 'text-gray-500'}`}>{label}</p>
        </div>
    );
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/50 p-4 backdrop-blur-sm">
            <div className={`my-6 w-full rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
                <div className="mb-5 flex items-center justify-between gap-3">
                    <h2 className="text-xl font-black text-gray-900 dark:text-white">{title}</h2>
                    <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800" title="Fechar">
                        <X size={18} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

function TextField({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
    return (
        <label className="block">
            <span className="text-xs font-black uppercase text-gray-500">{label}</span>
            <input required={required} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-purple-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
        </label>
    );
}

function DateTimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <label className="block">
            <span className="text-xs font-black uppercase text-gray-500">{label}</span>
            <input type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-purple-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
        </label>
    );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
    return (
        <label className="block">
            <span className="text-xs font-black uppercase text-gray-500">{label}</span>
            <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-purple-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white">
                {options.map(([optionValue, optionLabel]) => (
                    <option key={optionValue} value={optionValue}>{optionLabel}</option>
                ))}
            </select>
        </label>
    );
}

function TextArea({ label, value, onChange, rows = 3, monospace = false }: { label: string; value: string; onChange: (value: string) => void; rows?: number; monospace?: boolean }) {
    return (
        <label className="block">
            <span className="text-xs font-black uppercase text-gray-500">{label}</span>
            <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className={`mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-purple-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white ${monospace ? 'font-mono' : ''}`} />
        </label>
    );
}

function FormActions({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
    return (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onCancel} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-5 py-3 text-sm font-black text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                <X size={16} />
                Cancelar
            </button>
            <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 text-sm font-black text-white hover:bg-purple-700 disabled:opacity-60">
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Salvar
            </button>
        </div>
    );
}
