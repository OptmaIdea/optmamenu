import { useEffect, useMemo, useState } from 'react';
import {
    BadgePercent,
    Edit3,
    Gift,
    Loader2,
    Medal,
    Plus,
    RefreshCw,
    Save,
    Settings2,
    Sparkles,
    Star,
    Trophy,
    X,
} from 'lucide-react';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import {
    LoyaltyAdvancedService,
    type CustomerBenefitRule,
    type LoyaltyAdvancedSettings,
    type LoyaltyPointRule,
} from '@/services/loyaltyAdvancedService';

type FormMode = 'create' | 'edit';

interface PointRuleFormState {
    id?: string | null;
    code: string;
    name: string;
    description: string;
    triggerEvent: string;
    ruleType: string;
    pointsMode: string;
    pointsValue: string;
    priority: string;
    stackable: boolean;
    active: boolean;
}

interface BenefitRuleFormState {
    id?: string | null;
    code: string;
    name: string;
    description: string;
    benefitType: string;
    targetType: string;
    targetTierId: string;
    targetTag: string;
    discountPercent: string;
    discountAmount: string;
    bonusPoints: string;
    freeDelivery: boolean;
    minimumOrderValue: string;
    maxUsesTotal: string;
    maxUsesPerCustomer: string;
    active: boolean;
}

function formatNumber(value: unknown) {
    return Number(value || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
}

function formatCurrency(value: unknown) {
    return Number(value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });
}

function asNumber(value: string, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: string) {
    if (value.trim() === '') return null;

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function getRuleTypeLabel(type: string) {
    switch (type) {
        case 'per_currency':
            return 'Por valor gasto';
        case 'fixed_points':
            return 'Pontos fixos';
        case 'multiplier':
            return 'Multiplicador';
        case 'category_multiplier':
            return 'Multiplicador por categoria';
        case 'channel_multiplier':
            return 'Multiplicador por canal';
        case 'tier_multiplier':
            return 'Multiplicador por nível';
        case 'bonus':
            return 'Bônus';
        default:
            return type;
    }
}

function getPointsModeLabel(mode: string) {
    switch (mode) {
        case 'per_currency':
            return 'Por R$ 1,00';
        case 'fixed':
            return 'Fixo';
        case 'multiplier':
            return 'Multiplicador';
        default:
            return mode;
    }
}

function getBenefitTypeLabel(type: string) {
    switch (type) {
        case 'discount_percent':
            return 'Desconto %';
        case 'discount_amount':
            return 'Desconto R$';
        case 'free_delivery':
            return 'Entrega grátis';
        case 'bonus_points':
            return 'Pontos extras';
        case 'gift':
            return 'Brinde';
        case 'voucher':
            return 'Voucher';
        case 'custom':
            return 'Personalizado';
        default:
            return type;
    }
}

function getTargetTypeLabel(type: string) {
    switch (type) {
        case 'all':
            return 'Todos';
        case 'tier':
            return 'Nível';
        case 'customer':
            return 'Cliente';
        case 'tag':
            return 'Tag';
        case 'campaign':
            return 'Campanha';
        default:
            return type;
    }
}

function getTargetLabel(rule: CustomerBenefitRule) {
    if (rule.target_type === 'tier') return rule.target_tier_name || 'Nível';
    if (rule.target_type === 'customer') {
        return rule.target_customer_name || rule.target_customer_phone || 'Cliente específico';
    }
    if (rule.target_type === 'tag') return rule.target_tag || 'Tag';
    if (rule.target_type === 'campaign') return 'Campanha';
    return 'Todos';
}

function describePointRule(rule: LoyaltyPointRule) {
    if (rule.points_mode === 'per_currency') {
        return `${formatNumber(rule.points_value)} ponto(s) por R$ 1,00`;
    }

    if (rule.points_mode === 'fixed') {
        return `${formatNumber(rule.points_value)} ponto(s) fixos`;
    }

    if (rule.points_mode === 'multiplier') {
        return `${formatNumber(rule.points_value)}x pontos`;
    }

    return `${formatNumber(rule.points_value)} pontos`;
}

function describeBenefit(rule: CustomerBenefitRule) {
    if (rule.benefit_type === 'discount_percent') {
        return `${formatNumber(rule.discount_percent)}% de desconto`;
    }

    if (rule.benefit_type === 'discount_amount') {
        return `${formatCurrency(rule.discount_amount)} de desconto`;
    }

    if (rule.benefit_type === 'free_delivery') {
        return 'Entrega grátis';
    }

    if (rule.benefit_type === 'bonus_points') {
        return `${formatNumber(rule.bonus_points)} pontos extras`;
    }

    return rule.description || 'Benefício personalizado';
}

function emptyPointRuleForm(): PointRuleFormState {
    return {
        id: null,
        code: '',
        name: '',
        description: '',
        triggerEvent: 'order_completed',
        ruleType: 'per_currency',
        pointsMode: 'per_currency',
        pointsValue: '1',
        priority: '100',
        stackable: true,
        active: false,
    };
}

function pointRuleToForm(rule: LoyaltyPointRule): PointRuleFormState {
    return {
        id: rule.id,
        code: rule.code || '',
        name: rule.name || '',
        description: rule.description || '',
        triggerEvent: rule.trigger_event || 'order_completed',
        ruleType: rule.rule_type || 'per_currency',
        pointsMode: rule.points_mode || 'per_currency',
        pointsValue: String(rule.points_value ?? 1),
        priority: String(rule.priority ?? 100),
        stackable: Boolean(rule.stackable),
        active: Boolean(rule.active),
    };
}

function emptyBenefitRuleForm(): BenefitRuleFormState {
    return {
        id: null,
        code: '',
        name: '',
        description: '',
        benefitType: 'discount_percent',
        targetType: 'all',
        targetTierId: '',
        targetTag: '',
        discountPercent: '',
        discountAmount: '',
        bonusPoints: '',
        freeDelivery: false,
        minimumOrderValue: '0',
        maxUsesTotal: '',
        maxUsesPerCustomer: '',
        active: false,
    };
}

function benefitRuleToForm(rule: CustomerBenefitRule): BenefitRuleFormState {
    return {
        id: rule.id,
        code: rule.code || '',
        name: rule.name || '',
        description: rule.description || '',
        benefitType: rule.benefit_type || 'discount_percent',
        targetType: rule.target_type || 'all',
        targetTierId: rule.target_tier_id || '',
        targetTag: rule.target_tag || '',
        discountPercent: rule.discount_percent === null || rule.discount_percent === undefined ? '' : String(rule.discount_percent),
        discountAmount: rule.discount_amount === null || rule.discount_amount === undefined ? '' : String(rule.discount_amount),
        bonusPoints: rule.bonus_points === null || rule.bonus_points === undefined ? '' : String(rule.bonus_points),
        freeDelivery: Boolean(rule.free_delivery),
        minimumOrderValue: String(rule.minimum_order_value ?? 0),
        maxUsesTotal: rule.max_uses_total === null || rule.max_uses_total === undefined ? '' : String(rule.max_uses_total),
        maxUsesPerCustomer:
            rule.max_uses_per_customer === null || rule.max_uses_per_customer === undefined
                ? ''
                : String(rule.max_uses_per_customer),
        active: Boolean(rule.active),
    };
}

export default function LoyaltyAdvancedPage() {
    const { storeId, loading: loadingStore } = useCurrentStore();

    const [settings, setSettings] = useState<LoyaltyAdvancedSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingPointRule, setSavingPointRule] = useState(false);
    const [savingBenefitRule, setSavingBenefitRule] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const [pointFormOpen, setPointFormOpen] = useState(false);
    const [pointFormMode, setPointFormMode] = useState<FormMode>('create');
    const [pointForm, setPointForm] = useState<PointRuleFormState>(emptyPointRuleForm());

    const [benefitFormOpen, setBenefitFormOpen] = useState(false);
    const [benefitFormMode, setBenefitFormMode] = useState<FormMode>('create');
    const [benefitForm, setBenefitForm] = useState<BenefitRuleFormState>(emptyBenefitRuleForm());

    async function loadSettings() {
        if (!storeId) return;

        try {
            setLoading(true);
            setError(null);

            const data = await LoyaltyAdvancedService.getSettings(storeId);
            setSettings(data);
        } catch (err: unknown) {
            console.error('Erro ao carregar fidelidade avançada:', err);
            const fallback = 'Erro ao carregar fidelidade avançada.';
            setError(err instanceof Error ? err.message : fallback);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!loadingStore && storeId) {
            loadSettings();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingStore, storeId]);

    const activePointRules = useMemo(
        () => (settings?.point_rules || []).filter((rule) => rule.active).length,
        [settings]
    );

    const activeBenefitRules = useMemo(
        () => (settings?.benefit_rules || []).filter((rule) => rule.active).length,
        [settings]
    );

    function openNewPointRule() {
        setPointFormMode('create');
        setPointForm(emptyPointRuleForm());
        setPointFormOpen(true);
        setMessage(null);
        setError(null);
    }

    function openEditPointRule(rule: LoyaltyPointRule) {
        setPointFormMode('edit');
        setPointForm(pointRuleToForm(rule));
        setPointFormOpen(true);
        setMessage(null);
        setError(null);
    }

    function openNewBenefitRule() {
        setBenefitFormMode('create');
        setBenefitForm(emptyBenefitRuleForm());
        setBenefitFormOpen(true);
        setMessage(null);
        setError(null);
    }

    function openEditBenefitRule(rule: CustomerBenefitRule) {
        setBenefitFormMode('edit');
        setBenefitForm(benefitRuleToForm(rule));
        setBenefitFormOpen(true);
        setMessage(null);
        setError(null);
    }

    async function handleSavePointRule(event: React.FormEvent) {
        event.preventDefault();

        if (!storeId) return;

        try {
            setSavingPointRule(true);
            setError(null);
            setMessage(null);

            const result = await LoyaltyAdvancedService.upsertPointRule({
                storeId,
                ruleId: pointForm.id || null,
                code: pointForm.code || null,
                name: pointForm.name,
                description: pointForm.description || null,
                triggerEvent: pointForm.triggerEvent,
                ruleType: pointForm.ruleType,
                pointsMode: pointForm.pointsMode,
                pointsValue: asNumber(pointForm.pointsValue, 0),
                priority: Math.floor(asNumber(pointForm.priority, 100)),
                stackable: pointForm.stackable,
                active: pointForm.active,
                conditions: {},
                metadata: {
                    source: 'loyalty_advanced_page',
                },
            });

            if (!result.ok) {
                setError(result.message || result.error || 'Não foi possível salvar a regra.');
                return;
            }

            setPointFormOpen(false);
            setMessage(
                pointFormMode === 'create'
                    ? 'Regra de pontuação criada com sucesso.'
                    : 'Regra de pontuação atualizada com sucesso.'
            );

            await loadSettings();
        } catch (err: unknown) {
            console.error('Erro ao salvar regra de pontuação:', err);
            const fallback = 'Erro ao salvar regra de pontuação.';
            setError(err instanceof Error ? err.message : fallback);
        } finally {
            setSavingPointRule(false);
        }
    }

    async function handleSaveBenefitRule(event: React.FormEvent) {
        event.preventDefault();

        if (!storeId) return;

        try {
            setSavingBenefitRule(true);
            setError(null);
            setMessage(null);

            const result = await LoyaltyAdvancedService.upsertBenefitRule({
                storeId,
                ruleId: benefitForm.id || null,
                code: benefitForm.code || null,
                name: benefitForm.name,
                description: benefitForm.description || null,
                benefitType: benefitForm.benefitType,
                targetType: benefitForm.targetType,
                targetTierId: benefitForm.targetType === 'tier' ? benefitForm.targetTierId || null : null,
                targetCustomerId: null,
                targetTag: benefitForm.targetType === 'tag' ? benefitForm.targetTag || null : null,
                discountPercent: nullableNumber(benefitForm.discountPercent),
                discountAmount: nullableNumber(benefitForm.discountAmount),
                bonusPoints: nullableNumber(benefitForm.bonusPoints),
                freeDelivery: benefitForm.freeDelivery,
                minimumOrderValue: asNumber(benefitForm.minimumOrderValue, 0),
                maxUsesTotal: nullableNumber(benefitForm.maxUsesTotal),
                maxUsesPerCustomer: nullableNumber(benefitForm.maxUsesPerCustomer),
                active: benefitForm.active,
                conditions: {},
                metadata: {
                    source: 'loyalty_advanced_page',
                },
            });

            if (!result.ok) {
                setError(result.message || result.error || 'Não foi possível salvar o benefício.');
                return;
            }

            setBenefitFormOpen(false);
            setMessage(
                benefitFormMode === 'create'
                    ? 'Benefício criado com sucesso.'
                    : 'Benefício atualizado com sucesso.'
            );

            await loadSettings();
        } catch (err: unknown) {
            console.error('Erro ao salvar benefício:', err);
            const fallback = 'Erro ao salvar benefício.';
            setError(err instanceof Error ? err.message : fallback);
        } finally {
            setSavingBenefitRule(false);
        }
    }

    if (loadingStore || loading) {
        return (
            <div className="p-6">
                <div className="rounded-3xl bg-white p-8 shadow-sm dark:bg-gray-900">
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                        <Loader2 className="animate-spin" size={20} />
                        Carregando fidelidade avançada...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            <Sparkles size={14} />
                            Fidelidade
                        </div>

                        <h1 className="mt-3 text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">
                            Fidelidade avançada
                        </h1>

                        <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-400">
                            Configure regras de pontuação, benefícios, descontos e vantagens por nível ou tag.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={loadSettings}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-5 py-3 text-sm font-black text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                        <RefreshCw size={18} />
                        Atualizar
                    </button>
                </div>
            </div>

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
                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center gap-2 text-gray-500">
                        <Settings2 size={17} />
                        <p className="text-xs font-bold uppercase">Programa</p>
                    </div>
                    <p className="mt-2 text-xl font-black text-gray-900 dark:text-white">
                        {settings?.program?.is_active ? 'Ativo' : 'Inativo'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                        {settings?.program?.name || 'Programa de Fidelidade'}
                    </p>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center gap-2 text-gray-500">
                        <Medal size={17} />
                        <p className="text-xs font-bold uppercase">Níveis</p>
                    </div>
                    <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
                        {settings?.tiers.length || 0}
                    </p>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center gap-2 text-gray-500">
                        <Star size={17} />
                        <p className="text-xs font-bold uppercase">Regras ativas</p>
                    </div>
                    <p className="mt-2 text-2xl font-black text-amber-600">{activePointRules}</p>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center gap-2 text-gray-500">
                        <Gift size={17} />
                        <p className="text-xs font-bold uppercase">Benefícios ativos</p>
                    </div>
                    <p className="mt-2 text-2xl font-black text-emerald-600">
                        {activeBenefitRules}
                    </p>
                </div>
            </div>

            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-2">
                    <Trophy size={18} className="text-amber-600" />
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">
                        Níveis de fidelidade
                    </h2>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                    {(settings?.tiers || []).map((tier) => (
                        <div
                            key={tier.id}
                            className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800"
                        >
                            <div className="flex items-center gap-2">
                                <span
                                    className="h-3 w-3 rounded-full"
                                    style={{ backgroundColor: tier.color || '#999999' }}
                                />
                                <p className="font-black text-gray-900 dark:text-white">
                                    {tier.name}
                                </p>
                            </div>

                            <p className="mt-2 text-xs text-gray-500">
                                A partir de {formatNumber(tier.min_points)} pontos
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                                Multiplicador: {formatNumber(tier.multiplier)}x
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <Star size={18} className="text-amber-600" />
                        <h2 className="text-lg font-black text-gray-900 dark:text-white">
                            Regras de pontuação
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={openNewPointRule}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-2 text-sm font-black text-white transition hover:bg-amber-700"
                    >
                        <Plus size={16} />
                        Nova regra
                    </button>
                </div>

                {pointFormOpen && (
                    <form
                        onSubmit={handleSavePointRule}
                        className="mt-5 rounded-3xl border border-amber-100 bg-amber-50/40 p-5 dark:border-amber-900/40 dark:bg-amber-950/20"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="font-black text-gray-900 dark:text-white">
                                {pointFormMode === 'create'
                                    ? 'Nova regra de pontuação'
                                    : 'Editar regra de pontuação'}
                            </h3>

                            <button
                                type="button"
                                onClick={() => setPointFormOpen(false)}
                                className="rounded-xl p-2 text-gray-500 hover:bg-white dark:hover:bg-gray-900"
                            >
                                <X size={17} />
                            </button>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Nome
                                </label>
                                <input
                                    value={pointForm.name}
                                    onChange={(event) =>
                                        setPointForm((prev) => ({
                                            ...prev,
                                            name: event.target.value,
                                        }))
                                    }
                                    required
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Código
                                </label>
                                <input
                                    value={pointForm.code}
                                    onChange={(event) =>
                                        setPointForm((prev) => ({
                                            ...prev,
                                            code: event.target.value,
                                        }))
                                    }
                                    placeholder="gerado automaticamente se vazio"
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Descrição
                                </label>
                                <textarea
                                    value={pointForm.description}
                                    onChange={(event) =>
                                        setPointForm((prev) => ({
                                            ...prev,
                                            description: event.target.value,
                                        }))
                                    }
                                    rows={2}
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Tipo
                                </label>
                                <select
                                    value={pointForm.ruleType}
                                    onChange={(event) =>
                                        setPointForm((prev) => ({
                                            ...prev,
                                            ruleType: event.target.value,
                                        }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                >
                                    <option value="per_currency">Por valor gasto</option>
                                    <option value="fixed_points">Pontos fixos</option>
                                    <option value="multiplier">Multiplicador</option>
                                    <option value="category_multiplier">Multiplicador por categoria</option>
                                    <option value="channel_multiplier">Multiplicador por canal</option>
                                    <option value="tier_multiplier">Multiplicador por nível</option>
                                    <option value="bonus">Bônus</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Modo de pontos
                                </label>
                                <select
                                    value={pointForm.pointsMode}
                                    onChange={(event) =>
                                        setPointForm((prev) => ({
                                            ...prev,
                                            pointsMode: event.target.value,
                                        }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                >
                                    <option value="per_currency">Por R$ 1,00</option>
                                    <option value="fixed">Fixo</option>
                                    <option value="multiplier">Multiplicador</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Valor
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={pointForm.pointsValue}
                                    onChange={(event) =>
                                        setPointForm((prev) => ({
                                            ...prev,
                                            pointsValue: event.target.value,
                                        }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Prioridade
                                </label>
                                <input
                                    type="number"
                                    value={pointForm.priority}
                                    onChange={(event) =>
                                        setPointForm((prev) => ({
                                            ...prev,
                                            priority: event.target.value,
                                        }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="font-bold text-gray-900 dark:text-white">
                                        Empilhável
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={pointForm.stackable}
                                        onChange={(event) =>
                                            setPointForm((prev) => ({
                                                ...prev,
                                                stackable: event.target.checked,
                                            }))
                                        }
                                    />
                                </div>
                            </label>

                            <label className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="font-bold text-gray-900 dark:text-white">
                                        Ativa
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={pointForm.active}
                                        onChange={(event) =>
                                            setPointForm((prev) => ({
                                                ...prev,
                                                active: event.target.checked,
                                            }))
                                        }
                                    />
                                </div>
                            </label>
                        </div>

                        <div className="mt-5 flex justify-end">
                            <button
                                type="submit"
                                disabled={savingPointRule}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 px-5 py-3 text-sm font-black text-white transition hover:bg-amber-700 disabled:opacity-60"
                            >
                                {savingPointRule ? (
                                    <Loader2 className="animate-spin" size={18} />
                                ) : (
                                    <Save size={18} />
                                )}
                                Salvar regra
                            </button>
                        </div>
                    </form>
                )}

                <div className="mt-4 space-y-3">
                    {(settings?.point_rules || []).map((rule) => (
                        <div
                            key={rule.id}
                            className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800"
                        >
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-black text-gray-900 dark:text-white">
                                            {rule.name}
                                        </p>

                                        <span
                                            className={`rounded-full px-2 py-1 text-xs font-black ${rule.active
                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200'
                                                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300'
                                                }`}
                                        >
                                            {rule.active ? 'Ativa' : 'Inativa'}
                                        </span>
                                    </div>

                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                        {rule.description || describePointRule(rule)}
                                    </p>

                                    <p className="mt-2 text-xs text-gray-500">
                                        {getRuleTypeLabel(rule.rule_type)} •{' '}
                                        {getPointsModeLabel(rule.points_mode)} • {rule.trigger_event}
                                    </p>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                                        {describePointRule(rule)}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => openEditPointRule(rule)}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                    >
                                        <Edit3 size={14} />
                                        Editar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <BadgePercent size={18} className="text-emerald-600" />
                        <h2 className="text-lg font-black text-gray-900 dark:text-white">
                            Benefícios e descontos
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={openNewBenefitRule}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700"
                    >
                        <Plus size={16} />
                        Novo benefício
                    </button>
                </div>

                {benefitFormOpen && (
                    <form
                        onSubmit={handleSaveBenefitRule}
                        className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50/40 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="font-black text-gray-900 dark:text-white">
                                {benefitFormMode === 'create'
                                    ? 'Novo benefício'
                                    : 'Editar benefício'}
                            </h3>

                            <button
                                type="button"
                                onClick={() => setBenefitFormOpen(false)}
                                className="rounded-xl p-2 text-gray-500 hover:bg-white dark:hover:bg-gray-900"
                            >
                                <X size={17} />
                            </button>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Nome
                                </label>
                                <input
                                    value={benefitForm.name}
                                    onChange={(event) =>
                                        setBenefitForm((prev) => ({
                                            ...prev,
                                            name: event.target.value,
                                        }))
                                    }
                                    required
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Código
                                </label>
                                <input
                                    value={benefitForm.code}
                                    onChange={(event) =>
                                        setBenefitForm((prev) => ({
                                            ...prev,
                                            code: event.target.value,
                                        }))
                                    }
                                    placeholder="gerado automaticamente se vazio"
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Descrição
                                </label>
                                <textarea
                                    value={benefitForm.description}
                                    onChange={(event) =>
                                        setBenefitForm((prev) => ({
                                            ...prev,
                                            description: event.target.value,
                                        }))
                                    }
                                    rows={2}
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Tipo de benefício
                                </label>
                                <select
                                    value={benefitForm.benefitType}
                                    onChange={(event) =>
                                        setBenefitForm((prev) => ({
                                            ...prev,
                                            benefitType: event.target.value,
                                        }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                >
                                    <option value="discount_percent">Desconto %</option>
                                    <option value="discount_amount">Desconto R$</option>
                                    <option value="free_delivery">Entrega grátis</option>
                                    <option value="bonus_points">Pontos extras</option>
                                    <option value="gift">Brinde</option>
                                    <option value="voucher">Voucher</option>
                                    <option value="custom">Personalizado</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Alvo
                                </label>
                                <select
                                    value={benefitForm.targetType}
                                    onChange={(event) =>
                                        setBenefitForm((prev) => ({
                                            ...prev,
                                            targetType: event.target.value,
                                        }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                >
                                    <option value="all">Todos</option>
                                    <option value="tier">Nível</option>
                                    <option value="tag">Tag</option>
                                    <option value="campaign">Campanha</option>
                                </select>
                            </div>

                            {benefitForm.targetType === 'tier' && (
                                <div>
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                        Nível
                                    </label>
                                    <select
                                        value={benefitForm.targetTierId}
                                        onChange={(event) =>
                                            setBenefitForm((prev) => ({
                                                ...prev,
                                                targetTierId: event.target.value,
                                            }))
                                        }
                                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                    >
                                        <option value="">Selecione</option>
                                        {(settings?.tiers || []).map((tier) => (
                                            <option key={tier.id} value={tier.id}>
                                                {tier.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {benefitForm.targetType === 'tag' && (
                                <div>
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                        Tag do cliente
                                    </label>
                                    <input
                                        value={benefitForm.targetTag}
                                        onChange={(event) =>
                                            setBenefitForm((prev) => ({
                                                ...prev,
                                                targetTag: event.target.value,
                                            }))
                                        }
                                        placeholder="vip"
                                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Desconto %
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={benefitForm.discountPercent}
                                    onChange={(event) =>
                                        setBenefitForm((prev) => ({
                                            ...prev,
                                            discountPercent: event.target.value,
                                        }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Desconto R$
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={benefitForm.discountAmount}
                                    onChange={(event) =>
                                        setBenefitForm((prev) => ({
                                            ...prev,
                                            discountAmount: event.target.value,
                                        }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Pontos bônus
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={benefitForm.bonusPoints}
                                    onChange={(event) =>
                                        setBenefitForm((prev) => ({
                                            ...prev,
                                            bonusPoints: event.target.value,
                                        }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Pedido mínimo
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={benefitForm.minimumOrderValue}
                                    onChange={(event) =>
                                        setBenefitForm((prev) => ({
                                            ...prev,
                                            minimumOrderValue: event.target.value,
                                        }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="font-bold text-gray-900 dark:text-white">
                                        Entrega grátis
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={benefitForm.freeDelivery}
                                        onChange={(event) =>
                                            setBenefitForm((prev) => ({
                                                ...prev,
                                                freeDelivery: event.target.checked,
                                            }))
                                        }
                                    />
                                </div>
                            </label>

                            <label className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="font-bold text-gray-900 dark:text-white">
                                        Ativo
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={benefitForm.active}
                                        onChange={(event) =>
                                            setBenefitForm((prev) => ({
                                                ...prev,
                                                active: event.target.checked,
                                            }))
                                        }
                                    />
                                </div>
                            </label>
                        </div>

                        <div className="mt-5 flex justify-end">
                            <button
                                type="submit"
                                disabled={savingBenefitRule}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-60"
                            >
                                {savingBenefitRule ? (
                                    <Loader2 className="animate-spin" size={18} />
                                ) : (
                                    <Save size={18} />
                                )}
                                Salvar benefício
                            </button>
                        </div>
                    </form>
                )}

                <div className="mt-4 space-y-3">
                    {(settings?.benefit_rules || []).map((rule) => (
                        <div
                            key={rule.id}
                            className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800"
                        >
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-black text-gray-900 dark:text-white">
                                            {rule.name}
                                        </p>

                                        <span
                                            className={`rounded-full px-2 py-1 text-xs font-black ${rule.active
                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200'
                                                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300'
                                                }`}
                                        >
                                            {rule.active ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </div>

                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                        {rule.description || describeBenefit(rule)}
                                    </p>

                                    <p className="mt-2 text-xs text-gray-500">
                                        {getBenefitTypeLabel(rule.benefit_type)} • Alvo:{' '}
                                        {getTargetLabel(rule)} • Tipo de alvo:{' '}
                                        {getTargetTypeLabel(rule.target_type)}
                                    </p>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                                        {describeBenefit(rule)}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => openEditBenefitRule(rule)}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                    >
                                        <Edit3 size={14} />
                                        Editar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}