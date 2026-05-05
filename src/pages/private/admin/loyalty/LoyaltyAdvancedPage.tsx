import { useEffect, useMemo, useState } from 'react';
import {
    BadgePercent,
    Gift,
    Loader2,
    Medal,
    RefreshCw,
    Settings2,
    Sparkles,
    Star,
    Trophy,
} from 'lucide-react';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import {
    LoyaltyAdvancedService,
    type CustomerBenefitRule,
    type LoyaltyAdvancedSettings,
    type LoyaltyPointRule,
} from '@/services/loyaltyAdvancedService';

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

export default function LoyaltyAdvancedPage() {
    const { storeId, loading: loadingStore } = useCurrentStore();

    const [settings, setSettings] = useState<LoyaltyAdvancedSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    async function loadSettings() {
        if (!storeId) return;

        try {
            setLoading(true);
            setError(null);

            const data = await LoyaltyAdvancedService.getSettings(storeId);
            setSettings(data);
        } catch (err: unknown) {
            console.error('Erro ao carregar fidelidade avançada:', err);
            const message =
                err instanceof Error ? err.message : 'Erro ao carregar fidelidade avançada.';
            setError(message);
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
                            Configure e acompanhe regras de pontuação, benefícios, descontos
                            e vantagens por nível, cliente ou tag.
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
                    <p className="mt-2 text-2xl font-black text-amber-600">
                        {activePointRules}
                    </p>
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
                <div className="flex items-center gap-2">
                    <Star size={18} className="text-amber-600" />
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">
                        Regras de pontuação
                    </h2>
                </div>

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
                                        {getRuleTypeLabel(rule.rule_type)} • {rule.trigger_event}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                                    {describePointRule(rule)}
                                </div>
                            </div>
                        </div>
                    ))}

                    {(settings?.point_rules || []).length === 0 && (
                        <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
                            Nenhuma regra de pontuação configurada.
                        </div>
                    )}
                </div>
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-2">
                    <BadgePercent size={18} className="text-emerald-600" />
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">
                        Benefícios e descontos
                    </h2>
                </div>

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
                                        {getTargetLabel(rule)}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                                    {describeBenefit(rule)}
                                </div>
                            </div>
                        </div>
                    ))}

                    {(settings?.benefit_rules || []).length === 0 && (
                        <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
                            Nenhum benefício configurado.
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}