import { useState, useEffect } from 'react';
import { Gift, Award, TrendingUp, History, Ticket, Copy, Loader2, Clock, ExternalLink, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCustomerAuth } from '@/store/useCustomerAuth';
import { CustomerService } from '@/services/customerService';
import { toast } from 'sonner';
import type { LoyaltyTransaction, Reward, Voucher } from '@/types';

const FireIconSmall = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-flame"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-2.246-3.664-2.953-4.39a3.046 3.046 0 0 1 1.76-4.951c2.1.048 3.55.185 5.466.837 3.34 1.136 5.86 5.378 5.485 10.702-.128 1.83-1.574 3.329-3.253 3.329-1.68 0-3.111-1.365-3.253-3.057-.042-.51-.012-1.054.343-1.465A2.5 2.5 0 0 0 11 12" /><path d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9 9 0 0 1-8.718-6.747" /></svg>;

export default function LoyaltyPoints() {
    const { customer, login } = useCustomerAuth();
    const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [myRedemptionCounts, setMyRedemptionCounts] = useState<Record<string, number>>({});

    const [loading, setLoading] = useState(true);
    const [redeeming, setRedeeming] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'extract' | 'rewards' | 'vouchers'>('rewards');
    const [optInStep, setOptInStep] = useState<'intro' | 'terms'>('intro');
    const [agreedTerms, setAgreedTerms] = useState(false);
    const [enrollmentLoading, setEnrollmentLoading] = useState(false);
    const [programTerms, setProgramTerms] = useState<string>('');

    useEffect(() => {
        if (customer) {
            fetchData();
            if (!customer.loyalty_opt_in) {
                fetchTerms();
            }
        }
    }, [customer, activeTab]);

    const fetchTerms = async () => {
        try {
            const { data } = await supabase
                .from('fidelity_programs')
                .select('program_terms')
                .eq('store_id', customer?.store_id)
                .maybeSingle();

            if (data?.program_terms) {
                setProgramTerms(data.program_terms);
            } else {
                setProgramTerms('Ao participar do nosso programa de fidelidade, você acumula pontos em cada compra realizada. Os pontos podem ser trocados por prêmios e benefícios exclusivos de acordo com o regulamento vigente da loja.');
            }
        } catch (e) {
            console.error('[LOYALTY_POINTS] Error fetching terms:', e);
        }
    };

    const fetchData = async () => {
        if (!customer) return;
        setLoading(true);
        try {
            const promises = [];

            // Always fetch transactions for balance sync
            promises.push(
                supabase
                    .from('loyalty_transactions')
                    .select('*')
                    .eq('customer_id', customer.id)
                    .order('created_at', { ascending: false })
                    .then(({ data }) => setTransactions(data || []))
            );

            if (activeTab === 'rewards') {
                // Fetch Rewards AND My Redemptions to check limits
                const nowISO = new Date().toISOString();

                promises.push(
                    supabase
                        .from('fidelity_rewards')
                        .select('*')
                        .eq('is_active', true)
                        .or(`stock_quantity.gt.0,stock_quantity.is.null`) // Allow NULL or > 0
                        .or(`offer_valid_until.gt.${nowISO},offer_valid_until.is.null`) // Valid date or null
                        .then(({ data }) => setRewards(data || []))
                );

                // Count my vouchers per reward_id
                promises.push(
                    supabase
                        .from('fidelity_vouchers')
                        .select('reward_id')
                        .eq('customer_id', customer.id)
                        .then(({ data }) => {
                            const counts: Record<string, number> = {};
                            data?.forEach(v => {
                                counts[v.reward_id] = (counts[v.reward_id] || 0) + 1;
                            });
                            setMyRedemptionCounts(counts);
                        })
                );
            }

            if (activeTab === 'vouchers') {
                promises.push(
                    supabase
                        .from('fidelity_vouchers')
                        .select('*, reward:fidelity_rewards(title, description, image_url)')
                        .eq('customer_id', customer.id)
                        .order('created_at', { ascending: false })
                        .then(({ data }) => setVouchers(data || []))
                );
            }

            await Promise.all(promises);

        } catch (error) {
            console.error('Error fetching loyalty data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRedeem = async (reward: Reward) => {
        if (!customer) return;

        if ((customer.loyalty_points || 0) < reward.points_cost) {
            toast.error('Pontos insuficientes para este prêmio.');
            return;
        }

        if (!confirm(`Trocar ${reward.points_cost} pontos por "${reward.title}"?`)) return;

        setRedeeming(reward.id);
        try {
            const { data, error } = await supabase.rpc('redeem_reward', {
                p_customer_id: customer.id,
                p_reward_id: reward.id
            });

            if (error) throw error;

            if (data.success) {
                toast.success('Resgate realizado com sucesso!');
                // Update Local State
                const updatedPoints = (customer.loyalty_points || 0) - reward.points_cost;
                login({ ...customer, loyalty_points: updatedPoints }); // Update context

                // Refresh Vouchers
                setActiveTab('vouchers');
            } else {
                toast.error(data.message || 'Erro ao resgatar prêmio.');
            }
        } catch (error: any) {
            console.error('Redemption error:', error);
            toast.error('Erro ao processar resgate.');
        } finally {
            setRedeeming(null);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Código copiado!');
    };

    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

    const getTierColor = (tier: string = 'Bronze') => {
        if (tier === 'Ouro') return 'text-yellow-600 bg-yellow-100 border-yellow-200';
        if (tier === 'Prata') return 'text-gray-600 bg-gray-100 border-gray-200';
        return 'text-orange-700 bg-orange-100 border-orange-200';
    };

    if (!customer) return null;

    // Calculate progress (Logic preserved)
    const points = customer.loyalty_points || 0;
    const tier = customer.loyalty_tier || 'Bronze';
    let nextTier = '';
    let pointsNeeded = 0;
    let progress = 0;

    if (tier === 'Bronze') {
        nextTier = 'Prata';
        pointsNeeded = 100 - points;
        progress = (points / 100) * 100;
    } else if (tier === 'Prata') {
        nextTier = 'Ouro';
        pointsNeeded = 500 - points;
        progress = ((points - 100) / 400) * 100;
    } else {
        nextTier = 'Diamante';
        progress = 100;
        pointsNeeded = 0;
    }
    if (progress > 100) progress = 100;
    if (progress < 0) progress = 0;

    // OPT-IN PROMPT
    if (!customer.loyalty_opt_in) {
        return (
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden transition-all duration-500">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Gift size={150} />
                </div>

                <div className="relative z-10 flex flex-col items-center gap-6 animate-fadeIn">
                    {optInStep === 'intro' ? (
                        <>
                            <div className="w-20 h-20 bg-brand-green/20 rounded-full flex items-center justify-center mb-2 animate-bounce-slow">
                                <Gift size={40} className="text-brand-green" />
                            </div>
                            <div className="text-center space-y-2">
                                <h2 className="text-2xl font-black italic uppercase tracking-tighter">Clube de Vantagens</h2>
                                <p className="text-gray-400 max-w-sm mx-auto font-medium">
                                    Cadastre-se gratuitamente, acumule pontos em cada compra e troque por prêmios exclusivos! 🎁
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                                <div className="bg-white/5 p-3 rounded-xl border border-white/10 text-center">
                                    <TrendingUp size={20} className="text-brand-green mx-auto mb-1" />
                                    <p className="text-[10px] uppercase font-bold text-gray-400 leading-tight">Ganhe Pontos</p>
                                    <p className="text-xs font-medium">A cada real</p>
                                </div>
                                <div className="bg-white/5 p-3 rounded-xl border border-white/10 text-center">
                                    <Award size={20} className="text-brand-green mx-auto mb-1" />
                                    <p className="text-[10px] uppercase font-bold text-gray-400 leading-tight">Suba de Nível</p>
                                    <p className="text-xs font-medium">Bronze ao Ouro</p>
                                </div>
                            </div>

                            <button
                                onClick={() => setOptInStep('terms')}
                                className="w-full max-w-sm bg-brand-green text-white py-4 rounded-xl font-bold hover:brightness-110 transition shadow-lg shadow-brand-green/20 text-lg flex items-center justify-center gap-2"
                            >
                                Quero Participar! <ExternalLink size={20} className="rotate-45" />
                            </button>
                        </>
                    ) : (
                        <div className="w-full space-y-6 animate-fadeIn">
                            <button
                                onClick={() => setOptInStep('intro')}
                                className="text-xs font-bold text-gray-400 hover:text-white flex items-center gap-1 mb-2"
                            >
                                <X size={14} /> Voltar
                            </button>

                            <div className="space-y-4">
                                <h3 className="text-xl font-bold border-l-4 border-brand-green pl-3">Termos do Programa</h3>
                                <div className="bg-black/20 rounded-xl p-4 max-h-48 overflow-y-auto text-sm text-gray-400 leading-relaxed scrollbar-thin scrollbar-thumb-gray-700">
                                    <p className="whitespace-pre-wrap">{programTerms}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 bg-white/5 p-4 rounded-xl border border-white/10">
                                <input
                                    type="checkbox"
                                    id="agree-loyalty"
                                    checked={agreedTerms}
                                    onChange={(e) => setAgreedTerms(e.target.checked)}
                                    className="mt-1 w-5 h-5 text-brand-green border-white/20 rounded focus:ring-brand-green bg-transparent"
                                />
                                <label htmlFor="agree-loyalty" className="text-sm font-medium text-gray-300 leading-snug cursor-pointer select-none">
                                    Li e concordo com os termos e regulamento do Clube de Pontos da <strong>esta loja</strong>.
                                </label>
                            </div>

                            <button
                                onClick={async () => {
                                    if (!customer?.id || !agreedTerms) return;
                                    setEnrollmentLoading(true);
                                    console.log(`[LOYALTY_FLOW] Starting enrollment for user: ${customer.id}`);
                                    try {
                                        // 1. Update Profile (Triggers Join Bonus)
                                        await CustomerService.updateProfile(customer.id, { loyalty_opt_in: true } as any);
                                        console.log(`[LOYALTY_FLOW] Updated profile opt-in to true`);

                                        // 2. Log Consent
                                        await CustomerService.logConsent(customer.id, 'loyalty_program', 'granted');
                                        console.log(`[LOYALTY_FLOW] Consent logged`);

                                        // 3. UI Updates
                                        const updated = { ...customer, loyalty_opt_in: true };
                                        login(updated);

                                        // 4. Double Feedback
                                        alert('🎉 Parabéns! Você agora faz parte do nosso Clube de Pontos!');
                                        toast.success('Você ganhou pontos de adesão! Confira seu extrato. 🎁');

                                        console.log(`[LOYALTY_FLOW] Enrollment completed successfully`);
                                    } catch (e) {
                                        console.error('[LOYALTY_FLOW] ERROR:', e);
                                        toast.error('Erro ao ativar. Tente novamente.');
                                    } finally {
                                        setEnrollmentLoading(false);
                                    }
                                }}
                                disabled={!agreedTerms || enrollmentLoading}
                                className="w-full bg-brand-green text-white py-4 rounded-xl font-bold hover:brightness-110 transition shadow-lg shadow-brand-green/20 text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                            >
                                {enrollmentLoading ? <Loader2 className="animate-spin" /> : <>Confirmar Adesão <Gift size={20} /></>}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">

            {/* Balance Card */}
            <div className="bg-gradient-to-br from-brand-green to-teal-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Gift size={120} />
                </div>

                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-teal-100 text-sm font-medium mb-1">Seu Saldo Atual</p>
                            <h2 className="text-4xl font-black">{points} <span className="text-lg font-normal opacity-80">pontos</span></h2>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/20 backdrop-blur-sm border border-white/20 flex items-center gap-1 ${getTierColor(tier)}`}>
                            <Award size={14} /> {tier}
                        </div>
                    </div>

                    {tier !== 'Ouro' && (
                        <div>
                            <div className="flex justify-between text-xs text-teal-100 mb-1">
                                <span>Progresso para {nextTier}</span>
                                <span>Faltam {pointsNeeded > 0 ? pointsNeeded : 0} pontos</span>
                            </div>
                            <div className="w-full bg-black/20 rounded-full h-2">
                                <div
                                    className="bg-white rounded-full h-2 transition-all duration-1000 ease-out"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex bg-gray-100 rounded-xl p-1">
                <button
                    onClick={() => setActiveTab('rewards')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition flex items-center justify-center gap-2 ${activeTab === 'rewards' ? 'bg-white shadow-sm text-brand-green' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Gift size={16} /> Trocar Pontos
                </button>
                <button
                    onClick={() => setActiveTab('vouchers')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition flex items-center justify-center gap-2 ${activeTab === 'vouchers' ? 'bg-white shadow-sm text-brand-green' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Ticket size={16} /> Meus Vouchers
                </button>
                <button
                    onClick={() => setActiveTab('extract')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition flex items-center justify-center gap-2 ${activeTab === 'extract' ? 'bg-white shadow-sm text-brand-green' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <History size={16} /> Extrato
                </button>
            </div>

            {/* Content Area */}
            <div className="min-h-[200px]">

                {/* REWARDS TAB */}
                {activeTab === 'rewards' && (
                    <div className="animate-fadeIn">
                        {loading ? (
                            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" /></div>
                        ) : rewards.length === 0 ? (
                            <div className="text-center py-10 bg-gray-50 rounded-xl">
                                <Gift className="mx-auto text-gray-300 mb-3" size={40} />
                                <p className="text-gray-500 font-medium">Nenhum prêmio disponível no momento.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {rewards.filter(reward => {
                                    // Filter by Stock (already in query but double check)
                                    const hasStock = reward.stock_quantity === null || reward.stock_quantity > 0;

                                    // Filter by Per-Customer Limit
                                    let limitReached = false;
                                    if (reward.max_redemptions_per_customer) {
                                        const myCount = myRedemptionCounts[reward.id] || 0;
                                        if (myCount >= reward.max_redemptions_per_customer) {
                                            limitReached = true;
                                        }
                                    }

                                    // Filter by Validity Date (already in query but double check)
                                    const isValidDate = !reward.offer_valid_until || new Date(reward.offer_valid_until) > new Date();

                                    return hasStock && !limitReached && isValidDate;
                                }).map(reward => {
                                    const canRedeem = points >= reward.points_cost;
                                    const myCount = myRedemptionCounts[reward.id] || 0;
                                    const remainingForUser = reward.max_redemptions_per_customer ? reward.max_redemptions_per_customer - myCount : null;

                                    return (
                                        <div key={reward.id} className="bg-white border border-gray-100 rounded-xl p-4 flex gap-4 shadow-sm relative overflow-hidden transition hover:border-brand-green/30">
                                            {/* Image */}
                                            <div className="w-24 h-24 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden relative group">
                                                {reward.image_url ? (
                                                    <img src={reward.image_url} alt={reward.title} className="w-full h-full object-cover transition transform group-hover:scale-110" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Gift className="text-gray-300" size={30} />
                                                    </div>
                                                )}

                                                {/* Stock Overlay if low */}
                                                {reward.stock_quantity !== null && reward.stock_quantity < 5 && (
                                                    <div className="absolute bottom-0 left-0 right-0 bg-orange-500/90 text-white text-[10px] font-bold text-center py-0.5 backdrop-blur-sm">
                                                        Restam {reward.stock_quantity}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 flex flex-col justify-center">
                                                <div className="flex justify-between items-start">
                                                    <h4 className="font-bold text-gray-800 leading-tight mb-1">{reward.title}</h4>
                                                    {remainingForUser !== null && (
                                                        <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 whitespace-nowrap ml-2">
                                                            {remainingForUser} disp. p/ vc
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-xs text-gray-500 line-clamp-2 mb-2">{reward.description}</p>

                                                <div className="flex items-center gap-2 flex-wrap mt-auto">
                                                    <span className={`text-sm font-black ${canRedeem ? 'text-brand-green' : 'text-gray-400'}`}>
                                                        {reward.points_cost} pts
                                                    </span>
                                                    {reward.additional_cash_cost && reward.additional_cash_cost > 0 && (
                                                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                                            + {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(reward.additional_cash_cost)}
                                                        </span>
                                                    )}

                                                    {/* Stock Badge */}
                                                    {reward.stock_quantity !== null && (
                                                        <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded flex items-center gap-1 border border-orange-100">
                                                            <FireIconSmall /> Estoque: {reward.stock_quantity}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action */}
                                            <div className="flex items-center">
                                                <button
                                                    onClick={() => handleRedeem(reward)}
                                                    disabled={!canRedeem || redeeming === reward.id}
                                                    className={`px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2 ${canRedeem
                                                        ? 'bg-brand-green text-white hover:bg-green-600 shadow-lg shadow-green-100 active:scale-95'
                                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                        }`}
                                                >
                                                    {redeeming === reward.id ? <Loader2 className="animate-spin" size={16} /> : <Ticket size={16} />}
                                                    {canRedeem ? 'Resgatar' : 'Faltam Pts'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* VOUCHERS TAB */}
                {activeTab === 'vouchers' && (
                    <div className="animate-fadeIn space-y-4">
                        {loading ? (
                            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" /></div>
                        ) : vouchers.length === 0 ? (
                            <div className="text-center py-10 bg-gray-50 rounded-xl">
                                <Ticket className="mx-auto text-gray-300 mb-3" size={40} />
                                <p className="text-gray-500 font-medium">Você ainda não tem vouchers.</p>
                                <button onClick={() => setActiveTab('rewards')} className="text-brand-green font-bold text-sm mt-2 hover:underline">
                                    Trocar meus pontos agora
                                </button>
                            </div>
                        ) : (
                            vouchers.map(voucher => (
                                <div key={voucher.id} className={`bg-white border rounded-xl p-4 shadow-sm relative overflow-hidden ${voucher.status !== 'active' ? 'opacity-60 grayscale' : 'border-brand-green/30'}`}>
                                    {/* Dashed Separator Visual */}
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-8 bg-gray-50 rounded-r-full border-y border-r border-gray-100"></div>
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-8 bg-gray-50 rounded-l-full border-y border-l border-gray-100"></div>

                                    <div className="flex gap-4">
                                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden self-center">
                                            {voucher.reward?.image_url ? (
                                                <img src={voucher.reward.image_url} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center"><Gift size={20} className="text-gray-400" /></div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-gray-800 text-sm">{voucher.reward?.title || 'Prêmio'}</h4>
                                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${voucher.status === 'active' ? 'bg-green-100 text-green-700' :
                                                    voucher.status === 'used' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {voucher.status === 'active' ? 'Disponível' : voucher.status === 'used' ? 'Utilizado' : 'Expirado'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 line-clamp-1 mb-3">{voucher.reward?.description}</p>

                                            {/* Code Box */}
                                            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-2 flex justify-between items-center group cursor-pointer hover:border-brand-green hover:bg-green-50/30 transition" onClick={() => copyToClipboard(voucher.code)}>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Código</span>
                                                    <span className="font-mono font-black text-lg text-gray-800 tracking-widest">{voucher.code}</span>
                                                </div>
                                                <Copy size={16} className="text-gray-400 group-hover:text-brand-green" />
                                            </div>

                                            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 font-medium">
                                                <span className="flex items-center gap-1">
                                                    <Clock size={12} /> Expira em: {new Date(voucher.expires_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* EXTRACT TAB */}
                {activeTab === 'extract' && (
                    <div className="animate-fadeIn space-y-3">
                        {loading ? (
                            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" /></div>
                        ) : transactions.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-100">
                                <History className="mx-auto text-gray-300 mb-2" size={32} />
                                <p className="text-gray-500 text-sm">Nenhuma movimentação ainda.</p>
                                <p className="text-xs text-gray-400">Faça pedidos para ganhar pontos!</p>
                            </div>
                        ) : (
                            transactions.map(t => (
                                <div key={t.id} className="bg-white border border-gray-100 rounded-xl p-3 flex justify-between items-center shadow-sm">
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded-lg ${t.type === 'earn' || t.type === 'bonus' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {t.type === 'earn' ? <TrendingUp size={18} /> :
                                                t.type === 'bonus' ? <Gift size={18} /> :
                                                    <History size={18} />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">{t.description}</p>
                                            <p className="text-xs text-gray-400">{formatDate(t.created_at)}</p>
                                        </div>
                                    </div>
                                    <div className={`font-black ${t.type === 'earn' || t.type === 'bonus' ? 'text-green-600' : 'text-red-600'}`}>
                                        {t.type === 'earn' || t.type === 'bonus' ? '+' : ''}{t.points}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
