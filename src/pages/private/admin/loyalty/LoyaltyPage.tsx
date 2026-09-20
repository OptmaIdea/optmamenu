import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Ban,
    BarChart3,
    BookOpenCheck,
    Gift,
    History,
    Loader2,
    Medal,
    RefreshCw,
    Save,
    Search,
    Settings2,
    ShieldCheck,
    Star,
    UserCheck,
    Users,
} from 'lucide-react';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { usePermissions } from '@/hooks/usePermissions';
import {
    LoyaltyAdvancedService,
    type CustomerBenefitRule,
    type LoyaltyAdminTransaction,
    type LoyaltyAdvancedSettings,
    type LoyaltyCustomer,
    type LoyaltyMembershipAuditEvent,
    type LoyaltyMembershipBlock,
    type LoyaltyPointRule,
    type LoyaltyProgramAdvanced,
    type LoyaltyReward,
    type LoyaltyTierAdvanced,
} from '@/services/loyaltyAdvancedService';

type TabId =
    | 'overview'
    | 'rules'
    | 'tiers'
    | 'benefits'
    | 'customers'
    | 'adjustments'
    | 'blocks'
    | 'terms';

const TABS: Array<{ id: TabId; label: string; icon: typeof Star }> = [
    { id: 'overview', label: 'Visão geral', icon: BarChart3 },
    { id: 'rules', label: 'Regras e pontuação', icon: Settings2 },
    { id: 'tiers', label: 'Níveis', icon: Medal },
    { id: 'benefits', label: 'Benefícios e prêmios', icon: Gift },
    { id: 'customers', label: 'Clientes participantes', icon: Users },
    { id: 'adjustments', label: 'Ajustes / extrato', icon: History },
    { id: 'blocks', label: 'Bloqueios e reentrada', icon: ShieldCheck },
    { id: 'terms', label: 'Termos e privacidade', icon: BookOpenCheck },
];

const fieldClass =
    'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#19A999] focus:ring-2 focus:ring-[#19A999]/15 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:disabled:bg-gray-800';
const labelClass = 'mb-1 block text-xs font-bold text-gray-600 dark:text-gray-300';
const cardClass = 'rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900';

function number(value: unknown, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function formatPoints(value: unknown) {
    return number(value).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function formatDate(value?: string | null) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? '—'
        : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function displayCustomer(customer: LoyaltyCustomer) {
    return customer.full_name || customer.nickname || customer.phone_e164 || customer.phone || 'Cliente';
}

function transactionSign(transaction: LoyaltyAdminTransaction) {
    return transaction.points > 0 ? '+' : '';
}

function ruleDescription(rule: LoyaltyPointRule) {
    if (rule.points_mode === 'per_currency') return formatPoints(rule.points_value) + ' ponto(s) por R$ 1,00';
    if (rule.points_mode === 'multiplier') return String(rule.points_value) + 'x';
    return formatPoints(rule.points_value) + ' ponto(s)';
}

function benefitDescription(rule: CustomerBenefitRule) {
    if (rule.benefit_type === 'discount_percent') return String(rule.discount_percent || 0) + '% de desconto';
    if (rule.benefit_type === 'discount_amount') return 'R$ ' + number(rule.discount_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    if (rule.benefit_type === 'bonus_points') return formatPoints(rule.bonus_points) + ' ponto(s) extras';
    if (rule.benefit_type === 'free_delivery') return 'Entrega grátis';
    return rule.description || rule.benefit_type;
}

function eventLabel(event: LoyaltyMembershipAuditEvent) {
    const labels: Record<string, string> = {
        first_join: 'Primeira adesão',
        reentry: 'Reentrada',
        leave: 'Saída voluntária',
        admin_remove: 'Remoção administrativa',
        ban: 'Bloqueio',
        unban: 'Desbloqueio',
    };
    return labels[event.event_type] || event.event_type;
}

export default function LoyaltyPage() {
    const { storeId, loading: loadingStore } = useCurrentStore();
    const { hasPermission, checkPermission, loading: loadingPermissions } = usePermissions(storeId);

    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [settings, setSettings] = useState<LoyaltyAdvancedSettings | null>(null);
    const [programDraft, setProgramDraft] = useState<LoyaltyProgramAdvanced | null>(null);
    const [customers, setCustomers] = useState<LoyaltyCustomer[]>([]);
    const [transactions, setTransactions] = useState<LoyaltyAdminTransaction[]>([]);
    const [blocks, setBlocks] = useState<LoyaltyMembershipBlock[]>([]);
    const [auditEvents, setAuditEvents] = useState<LoyaltyMembershipAuditEvent[]>([]);
    const [auditPurpose, setAuditPurpose] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [canManage, setCanManage] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

    const [pointForm, setPointForm] = useState({
        id: '',
        name: '',
        code: '',
        triggerEvent: 'order_completed',
        pointsMode: 'per_currency',
        pointsValue: '1',
        priority: '100',
        stackable: true,
        active: true,
    });

    const [tierForm, setTierForm] = useState({
        id: '',
        name: '',
        minPoints: '0',
        multiplier: '1',
        color: '#19A999',
        position: '0',
    });

    const [benefitForm, setBenefitForm] = useState({
        id: '',
        name: '',
        code: '',
        benefitType: 'discount_percent',
        targetType: 'all',
        targetTierId: '',
        discountPercent: '',
        discountAmount: '',
        bonusPoints: '',
        freeDelivery: false,
        active: true,
    });

    const [rewardForm, setRewardForm] = useState({
        id: '',
        title: '',
        description: '',
        pointsCost: '0',
        type: 'product',
        stockQuantity: '',
        voucherValidityDays: '15',
        active: true,
    });

    const [adjustment, setAdjustment] = useState({ points: '', reason: '' });

    useEffect(() => {
        let cancelled = false;
        if (!storeId) {
            setCanManage(false);
            return;
        }

        void checkPermission('loyalty.manage')
            .then((allowed) => {
                if (!cancelled) setCanManage(allowed || hasPermission('loyalty.manage'));
            })
            .catch(() => {
                if (!cancelled) setCanManage(hasPermission('loyalty.manage'));
            });

        return () => {
            cancelled = true;
        };
    }, [storeId, checkPermission, hasPermission]);

    const loadAll = useCallback(async () => {
        if (!storeId) return;
        setLoading(true);
        try {
            const [nextSettings, nextCustomers, nextTransactions, reentry] = await Promise.all([
                LoyaltyAdvancedService.getSettings(storeId),
                LoyaltyAdvancedService.getCustomers(storeId, '', 100),
                LoyaltyAdvancedService.getTransactions(storeId, null, 200),
                LoyaltyAdvancedService.getBlocksAndReentry(storeId, 200),
            ]);
            setSettings(nextSettings);
            setProgramDraft(nextSettings.program);
            setCustomers(nextCustomers);
            setTransactions(nextTransactions);
            setBlocks(reentry.blocks);
            setAuditEvents(reentry.events);
            setAuditPurpose(reentry.audit_purpose);
        } catch (error) {
            console.error('[LOYALTY] load failed', error);
            toast.error(error instanceof Error ? error.message : 'Não foi possível carregar Fidelidade.');
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        if (!loadingStore && storeId) void loadAll();
    }, [loadingStore, storeId, loadAll]);

    const filteredCustomers = useMemo(() => {
        const needle = search.trim().toLocaleLowerCase('pt-BR');
        if (!needle) return customers;
        const digits = needle.replace(/\D/g, '');
        return customers.filter((customer) => {
            const name = (customer.full_name || '').toLocaleLowerCase('pt-BR');
            const nick = (customer.nickname || '').toLocaleLowerCase('pt-BR');
            const phone = (customer.phone_e164 || customer.phone || '').replace(/\D/g, '');
            return name.includes(needle) || nick.includes(needle) || (digits.length > 0 && phone.includes(digits));
        });
    }, [customers, search]);

    const selectedCustomer = useMemo(
        () => customers.find((customer) => customer.id === selectedCustomerId) || null,
        [customers, selectedCustomerId],
    );

    const selectedTransactions = useMemo(
        () => selectedCustomerId ? transactions.filter((transaction) => transaction.customer_id === selectedCustomerId) : transactions,
        [transactions, selectedCustomerId],
    );

    async function saveProgram(patch: Partial<LoyaltyProgramAdvanced>, successMessage: string) {
        if (!storeId || !canManage) return;
        setSaving(true);
        try {
            const result = await LoyaltyAdvancedService.updateProgram(storeId, patch);
            const nextProgram = (result.program as LoyaltyProgramAdvanced | undefined) || null;
            if (nextProgram) setProgramDraft(nextProgram);
            toast.success(successMessage);
            await loadAll();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Não foi possível salvar.');
        } finally {
            setSaving(false);
        }
    }

    async function savePointRule() {
        if (!storeId || !canManage || !pointForm.name.trim()) return;
        setSaving(true);
        try {
            await LoyaltyAdvancedService.upsertPointRule({
                storeId,
                ruleId: pointForm.id || null,
                code: pointForm.code || null,
                name: pointForm.name.trim(),
                triggerEvent: pointForm.triggerEvent,
                ruleType: pointForm.pointsMode === 'multiplier' ? 'multiplier' : pointForm.pointsMode === 'fixed' ? 'fixed_points' : 'per_currency',
                pointsMode: pointForm.pointsMode,
                pointsValue: number(pointForm.pointsValue),
                priority: Math.max(0, Math.trunc(number(pointForm.priority, 100))),
                stackable: pointForm.stackable,
                active: pointForm.active,
                conditions: {},
                metadata: { source: 'unified_loyalty' },
            });
            toast.success(pointForm.id ? 'Regra atualizada.' : 'Regra criada.');
            setPointForm({ id: '', name: '', code: '', triggerEvent: 'order_completed', pointsMode: 'per_currency', pointsValue: '1', priority: '100', stackable: true, active: true });
            await loadAll();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Erro ao salvar regra.');
        } finally {
            setSaving(false);
        }
    }

    function editPointRule(rule: LoyaltyPointRule) {
        setPointForm({
            id: rule.id,
            name: rule.name,
            code: rule.code || '',
            triggerEvent: rule.trigger_event,
            pointsMode: rule.points_mode,
            pointsValue: String(rule.points_value),
            priority: String(rule.priority),
            stackable: rule.stackable,
            active: rule.active,
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function saveTier() {
        if (!storeId || !canManage || !tierForm.name.trim()) return;
        setSaving(true);
        try {
            await LoyaltyAdvancedService.upsertTier({
                storeId,
                tierId: tierForm.id || null,
                name: tierForm.name.trim(),
                minPoints: Math.max(0, Math.trunc(number(tierForm.minPoints))),
                multiplier: Math.max(0.01, number(tierForm.multiplier, 1)),
                color: tierForm.color || '#19A999',
                position: Math.trunc(number(tierForm.position)),
            });
            toast.success(tierForm.id ? 'Nível atualizado.' : 'Nível criado.');
            setTierForm({ id: '', name: '', minPoints: '0', multiplier: '1', color: '#19A999', position: '0' });
            await loadAll();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Erro ao salvar nível.');
        } finally {
            setSaving(false);
        }
    }

    async function removeTier(tier: LoyaltyTierAdvanced) {
        if (!storeId || !canManage) return;
        if (!window.confirm('Excluir o nível "' + tier.name + '"?')) return;
        setSaving(true);
        try {
            await LoyaltyAdvancedService.deleteTier(storeId, tier.id);
            toast.success('Nível excluído.');
            await loadAll();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Erro ao excluir nível.');
        } finally {
            setSaving(false);
        }
    }

    async function saveBenefit() {
        if (!storeId || !canManage || !benefitForm.name.trim()) return;
        setSaving(true);
        try {
            await LoyaltyAdvancedService.upsertBenefitRule({
                storeId,
                ruleId: benefitForm.id || null,
                code: benefitForm.code || null,
                name: benefitForm.name.trim(),
                benefitType: benefitForm.benefitType,
                targetType: benefitForm.targetType,
                targetTierId: benefitForm.targetType === 'tier' ? benefitForm.targetTierId || null : null,
                discountPercent: benefitForm.discountPercent === '' ? null : number(benefitForm.discountPercent),
                discountAmount: benefitForm.discountAmount === '' ? null : number(benefitForm.discountAmount),
                bonusPoints: benefitForm.bonusPoints === '' ? null : Math.trunc(number(benefitForm.bonusPoints)),
                freeDelivery: benefitForm.freeDelivery,
                minimumOrderValue: 0,
                active: benefitForm.active,
                conditions: {},
                metadata: { source: 'unified_loyalty' },
            });
            toast.success(benefitForm.id ? 'Benefício atualizado.' : 'Benefício criado.');
            setBenefitForm({ id: '', name: '', code: '', benefitType: 'discount_percent', targetType: 'all', targetTierId: '', discountPercent: '', discountAmount: '', bonusPoints: '', freeDelivery: false, active: true });
            await loadAll();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Erro ao salvar benefício.');
        } finally {
            setSaving(false);
        }
    }

    async function saveReward() {
        if (!storeId || !canManage || !rewardForm.title.trim()) return;
        setSaving(true);
        try {
            await LoyaltyAdvancedService.upsertReward(storeId, rewardForm.id || null, {
                title: rewardForm.title.trim(),
                description: rewardForm.description || null,
                points_cost: Math.max(0, Math.trunc(number(rewardForm.pointsCost))),
                type: rewardForm.type,
                stock_quantity: rewardForm.stockQuantity === '' ? null : Math.max(0, Math.trunc(number(rewardForm.stockQuantity))),
                voucher_validity_days: Math.max(1, Math.trunc(number(rewardForm.voucherValidityDays, 15))),
                is_active: rewardForm.active,
            });
            toast.success(rewardForm.id ? 'Prêmio atualizado.' : 'Prêmio criado.');
            setRewardForm({ id: '', title: '', description: '', pointsCost: '0', type: 'product', stockQuantity: '', voucherValidityDays: '15', active: true });
            await loadAll();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Erro ao salvar prêmio.');
        } finally {
            setSaving(false);
        }
    }

    async function adjustPoints() {
        if (!storeId || !canManage || !selectedCustomerId) return;
        const delta = Math.trunc(number(adjustment.points));
        if (!delta || adjustment.reason.trim().length < 3) {
            toast.error('Informe uma quantidade diferente de zero e um motivo com pelo menos 3 caracteres.');
            return;
        }
        setSaving(true);
        try {
            await LoyaltyAdvancedService.adjustPoints(storeId, selectedCustomerId, delta, adjustment.reason.trim());
            toast.success('Ajuste registrado no extrato.');
            setAdjustment({ points: '', reason: '' });
            await loadAll();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Erro ao ajustar pontos.');
        } finally {
            setSaving(false);
        }
    }

    async function membershipAction(customer: LoyaltyCustomer, action: 'remove' | 'ban') {
        if (!storeId || !canManage) return;
        const verb = action === 'ban' ? 'bloquear' : 'remover';
        const reason = action === 'ban'
            ? window.prompt('Informe o motivo do bloqueio (mínimo 3 caracteres):', '')
            : window.prompt('Motivo da remoção (opcional):', '');
        if (reason === null) return;
        if (action === 'ban' && reason.trim().length < 3) {
            toast.error('O bloqueio exige um motivo com pelo menos 3 caracteres.');
            return;
        }
        if (!window.confirm('Confirma ' + verb + ' ' + displayCustomer(customer) + ' do programa?')) return;
        setSaving(true);
        try {
            await LoyaltyAdvancedService.setMembershipAction(storeId, customer.id, action, reason.trim() || null);
            toast.success(action === 'ban' ? 'CPF bloqueado para novas adesões.' : 'Participação removida; reentrada continua permitida.');
            if (selectedCustomerId === customer.id) setSelectedCustomerId('');
            await loadAll();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Não foi possível concluir a ação.');
        } finally {
            setSaving(false);
        }
    }

    async function unban(block: LoyaltyMembershipBlock) {
        if (!storeId || !canManage || !block.customer_id) {
            toast.error('Este bloqueio não possui cliente vinculado para desbloqueio pela interface.');
            return;
        }
        const reason = window.prompt('Observação do desbloqueio (opcional):', '');
        if (reason === null) return;
        setSaving(true);
        try {
            await LoyaltyAdvancedService.setMembershipAction(storeId, block.customer_id, 'unban', reason.trim() || null);
            toast.success('CPF liberado para nova adesão.');
            await loadAll();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Erro ao desbloquear.');
        } finally {
            setSaving(false);
        }
    }

    if (loadingStore || loadingPermissions || loading || !settings || !programDraft) {
        return (
            <div className="p-8">
                <div className={cardClass + ' flex items-center gap-3 text-gray-600 dark:text-gray-300'}>
                    <Loader2 className="animate-spin" size={20} />
                    Carregando Fidelidade...
                </div>
            </div>
        );
    }

    return (
        <PageContainer
            title="Fidelidade"
            subtitle="Programa, pontuação, níveis, benefícios, participantes, extrato e reentrada em uma única área segura."
            category="Comercial"
            icon={<Star size={28} className="text-[#19A999]" />}
            onRefresh={loadAll}
            flat
        >
            {!canManage && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                    Você possui <strong>loyalty.view</strong>. Alterações exigem <strong>loyalty.manage</strong>; a tela está em modo leitura.
                </div>
            )}

            <div className="mb-6 flex gap-2 overflow-x-auto border-b border-gray-200 pb-1 dark:border-gray-800">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={
                                'flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-bold transition ' +
                                (activeTab === tab.id
                                    ? 'border-[#19A999] text-[#14887B] dark:text-[#52d4c4]'
                                    : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white')
                            }
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {activeTab === 'overview' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {[
                            ['Participantes', settings.overview.participants, Users],
                            ['Pontos em circulação', settings.overview.points_in_circulation, Star],
                            ['Movimentações · 30 dias', settings.overview.transactions_30d, History],
                            ['Bloqueios ativos', settings.overview.active_blocks, Ban],
                        ].map(([label, value, Icon]) => (
                            <div key={String(label)} className={cardClass}>
                                <div className="flex items-center gap-2 text-xs font-bold uppercase text-gray-500">
                                    <Icon size={16} />
                                    {String(label)}
                                </div>
                                <div className="mt-2 text-3xl font-black text-gray-900 dark:text-white">{formatPoints(value)}</div>
                            </div>
                        ))}
                    </div>

                    <div className={cardClass}>
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h2 className="text-lg font-black text-gray-900 dark:text-white">{programDraft.name}</h2>
                                <p className="text-sm text-gray-500">
                                    {programDraft.is_active ? 'Programa ativo' : 'Programa inativo'} · primeira adesão:
                                    {' '}{programDraft.enable_join_bonus ? formatPoints(programDraft.join_bonus_points) + ' pontos' : 'sem bônus'}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs font-bold">
                                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                    18+ e e-mail confirmado
                                </span>
                                <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                    CPF obrigatório para adesão/bloqueio
                                </span>
                                <span className="rounded-full bg-purple-50 px-3 py-1 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                                    Reentrada: {programDraft.reentry_bonus_mode === 'percentage' ? String(programDraft.reentry_bonus_percentage || 0) + '%' : programDraft.reentry_bonus_mode === 'fixed' ? formatPoints(programDraft.reentry_bonus_fixed_points) + ' pts' : 'sem bônus'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className={cardClass}>
                            <h3 className="font-black text-gray-900 dark:text-white">Integridade da pontuação</h3>
                            <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                                <li>• Pedido concluído gera lançamento positivo no extrato.</li>
                                <li>• Cancelamento posterior gera lançamento reverso, sem apagar o histórico.</li>
                                <li>• Devolução parcial remove pontos proporcionalmente e registra correções como novos lançamentos.</li>
                                <li>• Ajustes administrativos exigem motivo, loja e permissão <strong>loyalty.manage</strong>.</li>
                            </ul>
                        </div>
                        <div className={cardClass}>
                            <h3 className="font-black text-gray-900 dark:text-white">Adesão e reentrada</h3>
                            <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                                A adesão é voluntária e exige regulamento, responsabilidade pelos dados, CPF, data de nascimento,
                                idade mínima de 18 anos e e-mail confirmado. Ao sair, dados exclusivos da fidelidade são eliminados.
                                Permanece somente o marcador mínimo de auditoria/antifraude necessário para impedir repetição indevida
                                do bônus de adesão, pelo prazo configurado e com finalidade explicitada ao cliente.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'rules' && (
                <div className="space-y-6">
                    <div className={cardClass}>
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="font-black text-gray-900 dark:text-white">Programa e pontuação base</h2>
                                <p className="text-sm text-gray-500">Fonte única para regras gerais e bônus de primeira adesão.</p>
                            </div>
                            <button
                                type="button"
                                disabled={!canManage || saving}
                                onClick={() => void saveProgram({
                                    name: programDraft.name,
                                    is_active: programDraft.is_active,
                                    points_per_currency: programDraft.points_per_currency,
                                    min_order_value: programDraft.min_order_value,
                                    enable_join_bonus: programDraft.enable_join_bonus,
                                    join_bonus_points: programDraft.join_bonus_points,
                                    enable_birthday_bonus: programDraft.enable_birthday_bonus,
                                    birthday_bonus_points: programDraft.birthday_bonus_points,
                                    points_validity_months: programDraft.points_validity_months,
                                    min_points_redemption: programDraft.min_points_redemption,
                                }, 'Configurações do programa salvas.')}
                                className="flex items-center gap-2 rounded-xl bg-[#19A999] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Salvar
                            </button>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div className="xl:col-span-2">
                                <label className={labelClass}>Nome do programa</label>
                                <input className={fieldClass} disabled={!canManage} value={programDraft.name} onChange={(e) => setProgramDraft({ ...programDraft, name: e.target.value })} />
                            </div>
                            <div>
                                <label className={labelClass}>Pontos por R$ 1,00</label>
                                <input type="number" step="0.01" className={fieldClass} disabled={!canManage} value={programDraft.points_per_currency ?? 0} onChange={(e) => setProgramDraft({ ...programDraft, points_per_currency: number(e.target.value) })} />
                            </div>
                            <div>
                                <label className={labelClass}>Pedido mínimo para pontuar</label>
                                <input type="number" step="0.01" className={fieldClass} disabled={!canManage} value={programDraft.min_order_value ?? 0} onChange={(e) => setProgramDraft({ ...programDraft, min_order_value: number(e.target.value) })} />
                            </div>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                                <input type="checkbox" disabled={!canManage} checked={Boolean(programDraft.is_active)} onChange={(e) => setProgramDraft({ ...programDraft, is_active: e.target.checked })} />
                                Programa ativo
                            </label>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                                <input type="checkbox" disabled={!canManage} checked={Boolean(programDraft.enable_join_bonus)} onChange={(e) => setProgramDraft({ ...programDraft, enable_join_bonus: e.target.checked })} />
                                Bônus na primeira adesão
                            </label>
                            <div>
                                <label className={labelClass}>Bônus integral da primeira adesão</label>
                                <input type="number" className={fieldClass} disabled={!canManage || !programDraft.enable_join_bonus} value={programDraft.join_bonus_points ?? 0} onChange={(e) => setProgramDraft({ ...programDraft, join_bonus_points: Math.trunc(number(e.target.value)) })} />
                            </div>
                            <div>
                                <label className={labelClass}>Validade dos pontos (meses)</label>
                                <input type="number" className={fieldClass} disabled={!canManage} value={programDraft.points_validity_months ?? 0} onChange={(e) => setProgramDraft({ ...programDraft, points_validity_months: Math.trunc(number(e.target.value)) })} />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                        <div className={cardClass}>
                            <h2 className="font-black text-gray-900 dark:text-white">{pointForm.id ? 'Editar regra' : 'Nova regra de pontuação'}</h2>
                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div className="md:col-span-2">
                                    <label className={labelClass}>Nome</label>
                                    <input className={fieldClass} disabled={!canManage} value={pointForm.name} onChange={(e) => setPointForm({ ...pointForm, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className={labelClass}>Evento</label>
                                    <select className={fieldClass} disabled={!canManage} value={pointForm.triggerEvent} onChange={(e) => setPointForm({ ...pointForm, triggerEvent: e.target.value })}>
                                        <option value="order_completed">Pedido concluído</option>
                                        <option value="loyalty_join">Adesão ao programa</option>
                                        <option value="birthday">Aniversário</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Modo</label>
                                    <select className={fieldClass} disabled={!canManage} value={pointForm.pointsMode} onChange={(e) => setPointForm({ ...pointForm, pointsMode: e.target.value })}>
                                        <option value="per_currency">Por valor gasto</option>
                                        <option value="fixed">Pontos fixos</option>
                                        <option value="multiplier">Multiplicador</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Valor</label>
                                    <input type="number" step="0.01" className={fieldClass} disabled={!canManage} value={pointForm.pointsValue} onChange={(e) => setPointForm({ ...pointForm, pointsValue: e.target.value })} />
                                </div>
                                <div>
                                    <label className={labelClass}>Prioridade</label>
                                    <input type="number" className={fieldClass} disabled={!canManage} value={pointForm.priority} onChange={(e) => setPointForm({ ...pointForm, priority: e.target.value })} />
                                </div>
                                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                                    <input type="checkbox" disabled={!canManage} checked={pointForm.stackable} onChange={(e) => setPointForm({ ...pointForm, stackable: e.target.checked })} /> Acumulável
                                </label>
                                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                                    <input type="checkbox" disabled={!canManage} checked={pointForm.active} onChange={(e) => setPointForm({ ...pointForm, active: e.target.checked })} /> Ativa
                                </label>
                            </div>
                            <div className="mt-4 flex gap-2">
                                <button type="button" disabled={!canManage || saving || !pointForm.name.trim()} onClick={() => void savePointRule()} className="rounded-xl bg-[#19A999] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                                    {pointForm.id ? 'Atualizar regra' : 'Criar regra'}
                                </button>
                                {pointForm.id && <button type="button" onClick={() => setPointForm({ id: '', name: '', code: '', triggerEvent: 'order_completed', pointsMode: 'per_currency', pointsValue: '1', priority: '100', stackable: true, active: true })} className="rounded-xl border px-4 py-2 text-sm font-bold dark:border-gray-700">Cancelar</button>}
                            </div>
                        </div>

                        <div className={cardClass}>
                            <h2 className="font-black text-gray-900 dark:text-white">Regras existentes</h2>
                            <div className="mt-4 space-y-3">
                                {settings.point_rules.map((rule) => (
                                    <button key={rule.id} type="button" onClick={() => editPointRule(rule)} className="w-full rounded-xl border border-gray-100 p-3 text-left hover:border-[#19A999]/40 dark:border-gray-800">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="font-bold text-gray-900 dark:text-white">{rule.name}</div>
                                                <div className="text-xs text-gray-500">{rule.trigger_event} · {ruleDescription(rule)}</div>
                                            </div>
                                            <span className={'rounded-full px-2 py-1 text-[10px] font-bold ' + (rule.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500')}>{rule.active ? 'ATIVA' : 'INATIVA'}</span>
                                        </div>
                                    </button>
                                ))}
                                {!settings.point_rules.length && <p className="text-sm text-gray-500">Nenhuma regra avançada cadastrada.</p>}
                            </div>
                        </div>
                    </div>

                    <div className={cardClass}>
                        <h2 className="font-black text-gray-900 dark:text-white">Multiplicadores por categoria</h2>
                        <p className="mt-1 text-sm text-gray-500">Categorias podem deixar de pontuar ou aplicar multiplicador próprio.</p>
                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {settings.category_rules.map((category) => (
                                <div key={category.id} className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                                    <div className="mb-2 font-bold text-gray-900 dark:text-white">{category.name}</div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            disabled={!canManage}
                                            checked={category.loyalty_eligible}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setSettings({
                                                    ...settings,
                                                    category_rules: settings.category_rules.map((item) => item.id === category.id ? { ...item, loyalty_eligible: checked } : item),
                                                });
                                            }}
                                        />
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0.1"
                                            disabled={!canManage || !category.loyalty_eligible}
                                            className={fieldClass}
                                            value={category.loyalty_multiplier}
                                            onChange={(e) => {
                                                const value = Math.max(0.1, number(e.target.value, 1));
                                                setSettings({
                                                    ...settings,
                                                    category_rules: settings.category_rules.map((item) => item.id === category.id ? { ...item, loyalty_multiplier: value } : item),
                                                });
                                            }}
                                        />
                                        <button
                                            type="button"
                                            disabled={!canManage || saving}
                                            onClick={async () => {
                                                if (!storeId) return;
                                                setSaving(true);
                                                try {
                                                    await LoyaltyAdvancedService.updateCategoryRule(storeId, category.id, category.loyalty_eligible, category.loyalty_multiplier);
                                                    toast.success('Categoria atualizada.');
                                                } catch (error) {
                                                    toast.error(error instanceof Error ? error.message : 'Erro ao atualizar categoria.');
                                                } finally {
                                                    setSaving(false);
                                                }
                                            }}
                                            className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50 dark:border-gray-700"
                                        >
                                            Salvar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'tiers' && (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
                    <div className={cardClass}>
                        <h2 className="font-black text-gray-900 dark:text-white">{tierForm.id ? 'Editar nível' : 'Novo nível'}</h2>
                        <div className="mt-4 space-y-3">
                            <div><label className={labelClass}>Nome</label><input className={fieldClass} disabled={!canManage} value={tierForm.name} onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })} /></div>
                            <div><label className={labelClass}>Pontos mínimos</label><input type="number" className={fieldClass} disabled={!canManage} value={tierForm.minPoints} onChange={(e) => setTierForm({ ...tierForm, minPoints: e.target.value })} /></div>
                            <div><label className={labelClass}>Multiplicador</label><input type="number" step="0.1" className={fieldClass} disabled={!canManage} value={tierForm.multiplier} onChange={(e) => setTierForm({ ...tierForm, multiplier: e.target.value })} /></div>
                            <div><label className={labelClass}>Cor</label><input type="color" className="h-10 w-full rounded-xl border dark:border-gray-700" disabled={!canManage} value={tierForm.color} onChange={(e) => setTierForm({ ...tierForm, color: e.target.value })} /></div>
                            <div><label className={labelClass}>Posição</label><input type="number" className={fieldClass} disabled={!canManage} value={tierForm.position} onChange={(e) => setTierForm({ ...tierForm, position: e.target.value })} /></div>
                            <button type="button" disabled={!canManage || saving || !tierForm.name.trim()} onClick={() => void saveTier()} className="w-full rounded-xl bg-[#19A999] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{tierForm.id ? 'Atualizar nível' : 'Criar nível'}</button>
                        </div>
                    </div>
                    <div className={cardClass}>
                        <h2 className="font-black text-gray-900 dark:text-white">Níveis configurados</h2>
                        <div className="mt-4 space-y-3">
                            {settings.tiers.map((tier) => (
                                <div key={tier.id} className="flex flex-col gap-3 rounded-xl border border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
                                    <div className="flex items-center gap-3">
                                        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: tier.color || '#19A999' }} />
                                        <div>
                                            <div className="font-black text-gray-900 dark:text-white">{tier.name}</div>
                                            <div className="text-xs text-gray-500">A partir de {formatPoints(tier.min_points)} pontos · {tier.multiplier}x</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="button" disabled={!canManage} onClick={() => setTierForm({ id: tier.id, name: tier.name, minPoints: String(tier.min_points), multiplier: String(tier.multiplier), color: tier.color || '#19A999', position: String(tier.position || 0) })} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50 dark:border-gray-700">Editar</button>
                                        <button type="button" disabled={!canManage || saving} onClick={() => void removeTier(tier)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 disabled:opacity-50 dark:border-red-900">Excluir</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'benefits' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                        <div className={cardClass}>
                            <h2 className="font-black text-gray-900 dark:text-white">{benefitForm.id ? 'Editar benefício' : 'Novo benefício'}</h2>
                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div className="md:col-span-2"><label className={labelClass}>Nome</label><input className={fieldClass} disabled={!canManage} value={benefitForm.name} onChange={(e) => setBenefitForm({ ...benefitForm, name: e.target.value })} /></div>
                                <div><label className={labelClass}>Tipo</label><select className={fieldClass} disabled={!canManage} value={benefitForm.benefitType} onChange={(e) => setBenefitForm({ ...benefitForm, benefitType: e.target.value })}><option value="discount_percent">Desconto %</option><option value="discount_amount">Desconto R$</option><option value="bonus_points">Pontos extras</option><option value="free_delivery">Entrega grátis</option><option value="custom">Personalizado</option></select></div>
                                <div><label className={labelClass}>Público</label><select className={fieldClass} disabled={!canManage} value={benefitForm.targetType} onChange={(e) => setBenefitForm({ ...benefitForm, targetType: e.target.value })}><option value="all">Todos</option><option value="tier">Nível</option></select></div>
                                {benefitForm.targetType === 'tier' && <div className="md:col-span-2"><label className={labelClass}>Nível</label><select className={fieldClass} disabled={!canManage} value={benefitForm.targetTierId} onChange={(e) => setBenefitForm({ ...benefitForm, targetTierId: e.target.value })}><option value="">Selecione</option>{settings.tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}</select></div>}
                                {benefitForm.benefitType === 'discount_percent' && <div><label className={labelClass}>Percentual</label><input type="number" step="0.1" className={fieldClass} disabled={!canManage} value={benefitForm.discountPercent} onChange={(e) => setBenefitForm({ ...benefitForm, discountPercent: e.target.value })} /></div>}
                                {benefitForm.benefitType === 'discount_amount' && <div><label className={labelClass}>Valor</label><input type="number" step="0.01" className={fieldClass} disabled={!canManage} value={benefitForm.discountAmount} onChange={(e) => setBenefitForm({ ...benefitForm, discountAmount: e.target.value })} /></div>}
                                {benefitForm.benefitType === 'bonus_points' && <div><label className={labelClass}>Pontos extras</label><input type="number" className={fieldClass} disabled={!canManage} value={benefitForm.bonusPoints} onChange={(e) => setBenefitForm({ ...benefitForm, bonusPoints: e.target.value })} /></div>}
                                <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" disabled={!canManage} checked={benefitForm.active} onChange={(e) => setBenefitForm({ ...benefitForm, active: e.target.checked })} /> Ativo</label>
                            </div>
                            <button type="button" disabled={!canManage || saving || !benefitForm.name.trim()} onClick={() => void saveBenefit()} className="mt-4 rounded-xl bg-[#19A999] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{benefitForm.id ? 'Atualizar benefício' : 'Criar benefício'}</button>
                            <div className="mt-5 space-y-2">
                                {settings.benefit_rules.map((rule) => (
                                    <button key={rule.id} type="button" onClick={() => setBenefitForm({
                                        id: rule.id, name: rule.name, code: rule.code || '', benefitType: rule.benefit_type, targetType: rule.target_type,
                                        targetTierId: rule.target_tier_id || '', discountPercent: rule.discount_percent == null ? '' : String(rule.discount_percent),
                                        discountAmount: rule.discount_amount == null ? '' : String(rule.discount_amount), bonusPoints: rule.bonus_points == null ? '' : String(rule.bonus_points),
                                        freeDelivery: rule.free_delivery, active: rule.active,
                                    })} className="w-full rounded-xl border border-gray-100 p-3 text-left dark:border-gray-800">
                                        <div className="font-bold text-gray-900 dark:text-white">{rule.name}</div>
                                        <div className="text-xs text-gray-500">{benefitDescription(rule)} · {rule.target_tier_name || (rule.target_type === 'all' ? 'Todos' : rule.target_type)}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={cardClass}>
                            <h2 className="font-black text-gray-900 dark:text-white">{rewardForm.id ? 'Editar prêmio' : 'Novo prêmio'}</h2>
                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div className="md:col-span-2"><label className={labelClass}>Título</label><input className={fieldClass} disabled={!canManage} value={rewardForm.title} onChange={(e) => setRewardForm({ ...rewardForm, title: e.target.value })} /></div>
                                <div className="md:col-span-2"><label className={labelClass}>Descrição</label><textarea className={fieldClass} disabled={!canManage} value={rewardForm.description} onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })} /></div>
                                <div><label className={labelClass}>Custo em pontos</label><input type="number" className={fieldClass} disabled={!canManage} value={rewardForm.pointsCost} onChange={(e) => setRewardForm({ ...rewardForm, pointsCost: e.target.value })} /></div>
                                <div><label className={labelClass}>Estoque (vazio = ilimitado)</label><input type="number" className={fieldClass} disabled={!canManage} value={rewardForm.stockQuantity} onChange={(e) => setRewardForm({ ...rewardForm, stockQuantity: e.target.value })} /></div>
                                <div><label className={labelClass}>Validade voucher (dias)</label><input type="number" className={fieldClass} disabled={!canManage} value={rewardForm.voucherValidityDays} onChange={(e) => setRewardForm({ ...rewardForm, voucherValidityDays: e.target.value })} /></div>
                                <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" disabled={!canManage} checked={rewardForm.active} onChange={(e) => setRewardForm({ ...rewardForm, active: e.target.checked })} /> Ativo</label>
                            </div>
                            <button type="button" disabled={!canManage || saving || !rewardForm.title.trim()} onClick={() => void saveReward()} className="mt-4 rounded-xl bg-[#19A999] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{rewardForm.id ? 'Atualizar prêmio' : 'Criar prêmio'}</button>
                            <div className="mt-5 space-y-2">
                                {settings.rewards.map((reward: LoyaltyReward) => (
                                    <div key={reward.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                                        <button type="button" className="flex-1 text-left" onClick={() => setRewardForm({
                                            id: reward.id, title: reward.title, description: reward.description || '', pointsCost: String(reward.points_cost || 0),
                                            type: reward.type || 'product', stockQuantity: reward.stock_quantity == null ? '' : String(reward.stock_quantity),
                                            voucherValidityDays: String(reward.voucher_validity_days || 15), active: reward.is_active,
                                        })}>
                                            <div className="font-bold text-gray-900 dark:text-white">{reward.title}</div>
                                            <div className="text-xs text-gray-500">{formatPoints(reward.points_cost)} pts · {reward.is_active ? 'ativo' : 'inativo'}</div>
                                        </button>
                                        <button type="button" disabled={!canManage || saving} onClick={async () => {
                                            if (!storeId || !window.confirm('Excluir o prêmio "' + reward.title + '"?')) return;
                                            setSaving(true);
                                            try { await LoyaltyAdvancedService.deleteReward(storeId, reward.id); toast.success('Prêmio excluído.'); await loadAll(); }
                                            catch (error) { toast.error(error instanceof Error ? error.message : 'Erro ao excluir prêmio.'); }
                                            finally { setSaving(false); }
                                        }} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 disabled:opacity-50 dark:border-red-900">Excluir</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'customers' && (
                <div className={cardClass}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="font-black text-gray-900 dark:text-white">Clientes participantes</h2>
                            <p className="text-sm text-gray-500">Somente participantes ativos; dados são lidos pela RPC store-scoped.</p>
                        </div>
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                            <input className={fieldClass + ' pl-9'} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, apelido ou telefone" />
                        </div>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead><tr className="border-b text-left text-xs uppercase text-gray-500 dark:border-gray-800"><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Pontos</th><th className="px-3 py-2">Nível</th><th className="px-3 py-2">Adesões</th><th className="px-3 py-2">CPF</th><th className="px-3 py-2">Ações</th></tr></thead>
                            <tbody>
                                {filteredCustomers.map((customer) => (
                                    <tr key={customer.id} className="border-b border-gray-100 dark:border-gray-800">
                                        <td className="px-3 py-3"><div className="font-bold text-gray-900 dark:text-white">{displayCustomer(customer)}</div><div className="text-xs text-gray-500">{customer.phone_e164 || customer.phone || '—'} · e-mail {customer.email_verified ? 'confirmado' : 'não confirmado'}</div></td>
                                        <td className="px-3 py-3 font-black">{formatPoints(customer.loyalty_points)}</td>
                                        <td className="px-3 py-3">{customer.loyalty_tier || '—'}</td>
                                        <td className="px-3 py-3">{customer.join_count || 1}</td>
                                        <td className="px-3 py-3">{customer.cpf_last4 ? '•••.' + customer.cpf_last4 : '—'}</td>
                                        <td className="px-3 py-3"><div className="flex gap-2"><button type="button" disabled={!canManage || saving} onClick={() => void membershipAction(customer, 'remove')} className="rounded-lg border px-2 py-1 text-xs font-bold disabled:opacity-50 dark:border-gray-700">Remover</button><button type="button" disabled={!canManage || saving || !customer.cpf_last4} onClick={() => void membershipAction(customer, 'ban')} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-bold text-red-600 disabled:opacity-50 dark:border-red-900">Bloquear CPF</button></div></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {!filteredCustomers.length && <p className="py-8 text-center text-sm text-gray-500">Nenhum participante encontrado.</p>}
                    </div>
                </div>
            )}

            {activeTab === 'adjustments' && (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
                    <div className={cardClass}>
                        <h2 className="font-black text-gray-900 dark:text-white">Ajuste manual</h2>
                        <p className="mt-1 text-sm text-gray-500">Todo ajuste gera um lançamento imutável no extrato.</p>
                        <div className="mt-4 space-y-3">
                            <div><label className={labelClass}>Cliente</label><select className={fieldClass} disabled={!canManage} value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}><option value="">Selecione</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{displayCustomer(customer)} · {formatPoints(customer.loyalty_points)} pts</option>)}</select></div>
                            {selectedCustomer && <div className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-800"><strong>{displayCustomer(selectedCustomer)}</strong><br />Saldo atual: {formatPoints(selectedCustomer.loyalty_points)} pontos</div>}
                            <div><label className={labelClass}>Pontos (+ crédito / - estorno)</label><input type="number" className={fieldClass} disabled={!canManage} value={adjustment.points} onChange={(e) => setAdjustment({ ...adjustment, points: e.target.value })} /></div>
                            <div><label className={labelClass}>Motivo obrigatório</label><textarea className={fieldClass} disabled={!canManage} value={adjustment.reason} onChange={(e) => setAdjustment({ ...adjustment, reason: e.target.value })} /></div>
                            <button type="button" disabled={!canManage || saving || !selectedCustomerId} onClick={() => void adjustPoints()} className="w-full rounded-xl bg-[#19A999] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Registrar ajuste</button>
                        </div>
                    </div>
                    <div className={cardClass}>
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="font-black text-gray-900 dark:text-white">Extrato {selectedCustomer ? '· ' + displayCustomer(selectedCustomer) : 'geral'}</h2>
                            <button type="button" onClick={() => void loadAll()} className="rounded-lg border p-2 dark:border-gray-700" title="Atualizar"><RefreshCw size={16} /></button>
                        </div>
                        <div className="mt-4 space-y-2">
                            {selectedTransactions.map((transaction) => (
                                <div key={transaction.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                                    <div>
                                        <div className="font-bold text-gray-900 dark:text-white">{transaction.description || transaction.type}</div>
                                        <div className="text-xs text-gray-500">{transaction.customer_name || transaction.customer_nickname || transaction.customer_phone || 'Cliente'} · {transaction.order_code || 'sem pedido'} · {formatDate(transaction.created_at)}</div>
                                    </div>
                                    <div className={'shrink-0 font-black ' + (transaction.points >= 0 ? 'text-emerald-600' : 'text-red-600')}>{transactionSign(transaction)}{formatPoints(transaction.points)}</div>
                                </div>
                            ))}
                            {!selectedTransactions.length && <p className="py-8 text-center text-sm text-gray-500">Nenhuma movimentação.</p>}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'blocks' && (
                <div className="space-y-6">
                    <div className={cardClass}>
                        <div className="mb-4">
                            <h2 className="font-black text-gray-900 dark:text-white">Regra de reentrada</h2>
                            <p className="text-sm text-gray-500">A primeira adesão usa o bônus integral. Reentradas seguem esta política e nunca repetem automaticamente o bônus integral.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                            <div><label className={labelClass}>Modo</label><select className={fieldClass} disabled={!canManage} value={programDraft.reentry_bonus_mode || 'none'} onChange={(e) => setProgramDraft({ ...programDraft, reentry_bonus_mode: e.target.value as 'none' | 'percentage' | 'fixed' })}><option value="none">Sem bônus</option><option value="percentage">Percentual do bônus original</option><option value="fixed">Valor fixo</option></select></div>
                            <div><label className={labelClass}>Percentual</label><input type="number" step="0.01" min="0" max="100" className={fieldClass} disabled={!canManage || programDraft.reentry_bonus_mode !== 'percentage'} value={programDraft.reentry_bonus_percentage ?? 30} onChange={(e) => setProgramDraft({ ...programDraft, reentry_bonus_percentage: number(e.target.value) })} /></div>
                            <div><label className={labelClass}>Pontos fixos</label><input type="number" min="0" className={fieldClass} disabled={!canManage || programDraft.reentry_bonus_mode !== 'fixed'} value={programDraft.reentry_bonus_fixed_points ?? 0} onChange={(e) => setProgramDraft({ ...programDraft, reentry_bonus_fixed_points: Math.trunc(number(e.target.value)) })} /></div>
                            <div><label className={labelClass}>Carência (dias)</label><input type="number" min="0" className={fieldClass} disabled={!canManage} value={programDraft.reentry_bonus_cooldown_days ?? 30} onChange={(e) => setProgramDraft({ ...programDraft, reentry_bonus_cooldown_days: Math.trunc(number(e.target.value)) })} /></div>
                            <div><label className={labelClass}>Máx. reentradas bonificadas</label><input type="number" min="0" className={fieldClass} disabled={!canManage} value={programDraft.reentry_bonus_max_awards ?? ''} onChange={(e) => setProgramDraft({ ...programDraft, reentry_bonus_max_awards: e.target.value === '' ? null : Math.trunc(number(e.target.value)) })} placeholder="Sem limite" /></div>
                            <div className="flex items-end"><button type="button" disabled={!canManage || saving} onClick={() => void saveProgram({
                                reentry_bonus_mode: programDraft.reentry_bonus_mode,
                                reentry_bonus_percentage: programDraft.reentry_bonus_percentage,
                                reentry_bonus_fixed_points: programDraft.reentry_bonus_fixed_points,
                                reentry_bonus_cooldown_days: programDraft.reentry_bonus_cooldown_days,
                                reentry_bonus_max_awards: programDraft.reentry_bonus_max_awards,
                            }, 'Política de reentrada salva.')} className="w-full rounded-xl bg-[#19A999] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save size={16} className="mr-1 inline" />Salvar</button></div>
                        </div>
                        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
                            <strong>Regra atual:</strong>{' '}
                            {programDraft.reentry_bonus_mode === 'percentage'
                                ? String(programDraft.reentry_bonus_percentage || 0) + '% do bônus original'
                                : programDraft.reentry_bonus_mode === 'fixed'
                                    ? formatPoints(programDraft.reentry_bonus_fixed_points) + ' pontos fixos'
                                    : 'sem bônus em reentrada'}
                            {' '}· carência de {formatPoints(programDraft.reentry_bonus_cooldown_days)} dia(s)
                            {' '}· limite {programDraft.reentry_bonus_max_awards == null ? 'sem limite' : formatPoints(programDraft.reentry_bonus_max_awards)}.
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                        <div className={cardClass}>
                            <h2 className="font-black text-gray-900 dark:text-white">Bloqueios por CPF</h2>
                            <div className="mt-4 space-y-2">
                                {blocks.filter((block) => !block.unblocked_at).map((block) => (
                                    <div key={block.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                                        <div><div className="font-bold text-gray-900 dark:text-white">{block.customer_name || 'Cliente'}</div><div className="text-xs text-gray-500">CPF •••.{block.cpf_last4 || '—'} · {block.reason || 'sem motivo'} · {formatDate(block.blocked_at)}</div></div>
                                        <button type="button" disabled={!canManage || saving || !block.customer_id} onClick={() => void unban(block)} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50 dark:border-gray-700">Liberar CPF</button>
                                    </div>
                                ))}
                                {!blocks.some((block) => !block.unblocked_at) && <p className="text-sm text-gray-500">Nenhum bloqueio ativo.</p>}
                            </div>
                        </div>
                        <div className={cardClass}>
                            <h2 className="font-black text-gray-900 dark:text-white">Auditoria de adesão e reentrada</h2>
                            <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                                {auditEvents.map((event) => (
                                    <div key={event.id} className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                                        <div className="flex items-start justify-between gap-3"><div className="font-bold text-gray-900 dark:text-white">{eventLabel(event)} · {event.customer_name || 'cliente removido'}</div><div className="text-xs font-bold text-[#14887B]">{event.bonus_points > 0 ? '+' + formatPoints(event.bonus_points) + ' pts' : 'sem bônus'}</div></div>
                                        <div className="mt-1 text-xs text-gray-500">Adesão #{event.join_sequence || '—'} · {formatDate(event.occurred_at)} · retenção até {formatDate(event.retention_until)}</div>
                                        {event.reason && <div className="mt-1 text-xs text-gray-500">{event.reason}</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'terms' && (
                <div className="space-y-6">
                    <div className={cardClass}>
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div><h2 className="font-black text-gray-900 dark:text-white">Regulamento e termos de vouchers</h2><p className="text-sm text-gray-500">O cliente recebe os textos vigentes da própria loja na adesão.</p></div>
                            <button type="button" disabled={!canManage || saving} onClick={() => void saveProgram({ program_terms: programDraft.program_terms, voucher_terms: programDraft.voucher_terms }, 'Termos atualizados.')} className="flex items-center gap-2 rounded-xl bg-[#19A999] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save size={16} />Salvar termos</button>
                        </div>
                        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                            <div><label className={labelClass}>Regulamento do programa</label><textarea rows={16} className={fieldClass} disabled={!canManage} value={programDraft.program_terms || ''} onChange={(e) => setProgramDraft({ ...programDraft, program_terms: e.target.value })} /></div>
                            <div><label className={labelClass}>Termos de vouchers/prêmios</label><textarea rows={16} className={fieldClass} disabled={!canManage} value={programDraft.voucher_terms || ''} onChange={(e) => setProgramDraft({ ...programDraft, voucher_terms: e.target.value })} /></div>
                        </div>
                    </div>

                    <div className={cardClass}>
                        <h2 className="font-black text-gray-900 dark:text-white">Privacidade, purge e retenção antifraude</h2>
                        <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_240px]">
                            <div className="space-y-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                                <p><strong>Saída do programa:</strong> remove pontos, extrato de fidelidade, vouchers, consentimentos exclusivos do programa e estado de nível/selos. Cadastro geral e histórico comercial permanecem fora desse purge.</p>
                                <p><strong>Dado mínimo preservado:</strong> hash de CPF por loja, quatro últimos dígitos para contexto administrativo, contadores e datas de participação/bônus e a regra aplicada. Não é um cadastro paralelo de marketing.</p>
                                <p><strong>Finalidade declarada:</strong> {auditPurpose || 'Prevenção de abuso de bônus de reentrada, segurança e auditoria do programa.'}</p>
                                <p>O cliente recebe a explicação da regra aplicável antes/na adesão, inclusive quando a carência ou o limite torna a reentrada não bonificada.</p>
                            </div>
                            <div>
                                <label className={labelClass}>Retenção da auditoria (meses)</label>
                                <input type="number" min="1" max="120" className={fieldClass} disabled={!canManage} value={programDraft.loyalty_audit_retention_months ?? 60} onChange={(e) => setProgramDraft({ ...programDraft, loyalty_audit_retention_months: Math.trunc(number(e.target.value, 60)) })} />
                                <button type="button" disabled={!canManage || saving} onClick={() => void saveProgram({ loyalty_audit_retention_months: programDraft.loyalty_audit_retention_months }, 'Prazo de retenção atualizado.')} className="mt-3 w-full rounded-xl border border-[#19A999] px-4 py-2 text-sm font-bold text-[#14887B] disabled:opacity-50 dark:text-[#52d4c4]">Salvar retenção</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    );
}
