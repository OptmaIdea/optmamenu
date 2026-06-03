import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Save, Loader, Gift, Award, Settings, ToggleLeft, ToggleRight, DollarSign, Calendar, UserPlus, Stamp, Layers, List, UserCheck, AlertTriangle, FileText, Heart } from 'lucide-react';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';

// New Components
// New Components
import LevelsConfig from '@/pages/private/admin/commercial/loyalty/settings/LevelsConfig';
import CategoryRules from '@/pages/private/admin/commercial/loyalty/settings/CategoryRules';
import ActiveCustomers from '@/pages/private/admin/commercial/loyalty/settings/ManualPoints';
import RewardsConfig from '@/pages/private/admin/commercial/loyalty/settings/RewardsConfig';
import LegalTerms from '@/pages/private/admin/commercial/loyalty/terms/LegalTerms';


import type { FidelityProgram } from '@/types';



export default function LoyaltyConfig() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [storeId, setStoreId] = useState<string | null>(null);
    const [program, setProgram] = useState<FidelityProgram | null>(null);
    // Tabs: rules, categories, tiers, rewards, manual, legal
    const [activeTab, setActiveTab] = useState<'rules' | 'categories' | 'tiers' | 'rewards' | 'manual' | 'legal'>('rules');

    // Load Data
    useEffect(() => {
        fetchProgramData();
    }, []);

    const fetchProgramData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get store ID via RPC
            const { data: storeData, error } = await supabase.rpc(
                'get_user_store_by_id',
                { p_user_id: user.id }
            );
            if (error || !storeData) return;
            const store = Array.isArray(storeData) ? storeData[0] : storeData;
            if (!store) return;

            setStoreId(store.id);

            const { data: result, error: loyaltyError } = await supabase.rpc('get_admin_loyalty_safe', {
                p_store_id: store.id,
            });

            if (loyaltyError) {
                console.error('Error fetching loyalty data:', loyaltyError);
                throw loyaltyError;
            }

            if (!result?.ok) {
                throw new Error(result?.error || 'Erro ao buscar dados de fidelidade.');
            }

            setProgram(result.program || null);

        } catch (error: any) {
            console.error('Error fetching loyalty data:', error);
            toast.error('Erro ao carregar dados de fidelidade');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProgram = async () => {
        if (!program) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('fidelity_programs')
                .update({
                    name: program.name,
                    is_active: program.is_active,
                    points_per_currency: program.points_per_currency,
                    min_order_value: program.min_order_value,
                    enable_join_bonus: program.enable_join_bonus,
                    join_bonus_points: program.join_bonus_points,
                    enable_birthday_bonus: program.enable_birthday_bonus,
                    birthday_bonus_points: program.birthday_bonus_points,
                    enable_cashback: program.enable_cashback,
                    points_validity_months: program.points_validity_months,
                    min_points_redemption: program.min_points_redemption,

                    // New Fields
                    enable_stamps: program.enable_stamps,
                    min_order_for_stamp: program.min_order_for_stamp,
                    stamps_target: program.stamps_target,
                    points_per_stamp_block: program.points_per_stamp_block,

                    // Notification Settings
                    warn_voucher_expiry_1: program.warn_voucher_expiry_1,
                    warn_voucher_expiry_2: program.warn_voucher_expiry_2,
                    warn_voucher_expiry_3: program.warn_voucher_expiry_3
                })
                .eq('id', program.id);

            if (error) throw error;
            toast.success('Configurações salvas!');
        } catch (error: any) {
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };



    if (loading) return <div className="p-10 flex justify-center"><Loader className="animate-spin text-brand-green" /></div>;
    if (!program || !storeId) return <div className="p-10 text-center">Erro ao carregar programa.</div>;

    const tabs = [
        { id: 'rules', label: 'Regras Principais', icon: Settings },
        { id: 'categories', label: 'Categorias', icon: List },
        { id: 'tiers', label: 'Níveis VIP', icon: Layers },
        { id: 'rewards', label: 'Prêmios', icon: Gift },
        { id: 'manual', label: 'Clientes ativos', icon: UserCheck },
        { id: 'legal', label: 'Termos Legais', icon: FileText },
    ];

    return (
        <PageContainer
            title="Fidelidade"
            subtitle="Configure regras do programa de fidelidade, cashback e pontuação por compra"
            category="Comercial"
            icon={<Heart size={28} className="text-[#21A896]" />}
            onRefresh={fetchProgramData}
            action={
                <div className="flex gap-2">
                    <button
                        onClick={() => setProgram({ ...program, is_active: !program.is_active })}
                        className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 transition text-xs ${program.is_active
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                            }`}
                    >
                        {program.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                        {program.is_active ? 'Programa Ativo' : 'Programa Inativo'}
                    </button>
                    <button
                        onClick={handleSaveProgram}
                        disabled={saving}
                        className="bg-[#21A896] hover:bg-[#1b8f80] text-white px-4 py-1.5 rounded-xl font-bold shadow-sm flex items-center gap-1.5 transition disabled:opacity-70 text-xs"
                    >
                        {saving ? <Loader className="animate-spin" size={14} /> : <Save size={14} />}
                        Salvar
                    </button>
                </div>
            }
            flat
        >

            {/* Navigation Tabs */}
            <div className="flex overflow-x-auto gap-2 mb-8 border-b border-gray-200 dark:border-gray-700 pb-1 no-scrollbar">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-2 font-bold text-sm whitespace-nowrap transition border-b-2 flex items-center gap-2 ${activeTab === tab.id
                            ? 'border-brand-green text-brand-green'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            }`}
                    >
                        <tab.icon size={18} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="min-h-[400px]">
                {activeTab === 'rules' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
                        {/* Identity */}
                        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                            <h2 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                                <Award className="text-purple-500" size={20} /> Identidade
                            </h2>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nome do Programa</label>
                                <input
                                    type="text"
                                    value={program.name}
                                    onChange={e => setProgram({ ...program, name: e.target.value })}
                                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-800 dark:text-white font-medium"
                                    placeholder="Ex: Clube de Vantagens"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Validade dos Pontos (Meses)</label>
                                <input
                                    type="number"
                                    value={program.points_validity_months}
                                    onChange={e => setProgram({ ...program, points_validity_months: Number(e.target.value) })}
                                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-800 dark:text-white font-medium"
                                />
                                <p className="text-xs text-gray-400 mt-1">Tempo até expiração por inatividade.</p>
                            </div>

                            {/* New: Notification Settings */}
                            <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                                <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                                    <AlertTriangle size={16} className="text-orange-500" /> Avisos de Expiração (Vouchers)
                                </h3>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 mb-1">1º Aviso (Dias antes)</label>
                                        <input
                                            type="number"
                                            value={program.warn_voucher_expiry_1 || 7}
                                            onChange={e => setProgram({ ...program, warn_voucher_expiry_1: Number(e.target.value) })}
                                            className="w-full p-2 text-gray-800 dark:text-white text-center rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 mb-1">2º Aviso (Dias antes)</label>
                                        <input
                                            type="number"
                                            value={program.warn_voucher_expiry_2 || 3}
                                            onChange={e => setProgram({ ...program, warn_voucher_expiry_2: Number(e.target.value) })}
                                            className="w-full p-2 text-gray-800 dark:text-white text-center rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 mb-1">3º Aviso (Dias antes)</label>
                                        <input
                                            type="number"
                                            value={program.warn_voucher_expiry_3 || 1}
                                            onChange={e => setProgram({ ...program, warn_voucher_expiry_3: Number(e.target.value) })}
                                            className="w-full p-2 text-gray-800 dark:text-white text-center rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50"
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Accumulation Rules */}
                        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
                            <h2 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                                <DollarSign className="text-green-500" size={20} /> Acúmulo Padrão
                            </h2>

                            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-transparent">
                                <input
                                    type="checkbox"
                                    checked={program.enable_cashback}
                                    onChange={e => setProgram({ ...program, enable_cashback: e.target.checked })}
                                    className="mt-1 w-5 h-5 text-brand-green rounded focus:ring-brand-green"
                                />
                                <div className="flex-1">
                                    <span className="block font-bold text-gray-700 dark:text-gray-200">Pontos por Compra</span>
                                    {program.enable_cashback && (
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Ganhar</span>
                                            <input
                                                type="number"
                                                value={program.points_per_currency}
                                                onChange={e => setProgram({ ...program, points_per_currency: Number(e.target.value) })}
                                                className="w-20 p-2 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-white font-bold"
                                            />
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">pts a cada R$ 1,00</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-transparent">
                                <input
                                    type="checkbox"
                                    checked={program.enable_stamps}
                                    onChange={e => setProgram({ ...program, enable_stamps: e.target.checked })}
                                    className="mt-1 w-5 h-5 text-brand-green rounded focus:ring-brand-green"
                                />
                                <div className="flex-1">
                                    <span className="block font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                        <Stamp size={16} /> Sistema de Selos
                                    </span>
                                    {program.enable_stamps && (
                                        <div className="space-y-3 mt-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Acima de R$</span>
                                                <input
                                                    type="number"
                                                    value={program.min_order_for_stamp}
                                                    onChange={e => setProgram({ ...program, min_order_for_stamp: Number(e.target.value) })}
                                                    className="w-20 p-2 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-white font-bold"
                                                />
                                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">ganha 1 selo.</span>
                                            </div>

                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Juntar</span>
                                                <input
                                                    type="number"
                                                    value={program.stamps_target}
                                                    onChange={e => setProgram({ ...program, stamps_target: Number(e.target.value) })}
                                                    className="w-16 p-2 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-white font-bold"
                                                />
                                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">selos = </span>
                                                <input
                                                    type="number"
                                                    value={program.points_per_stamp_block || 0}
                                                    onChange={e => setProgram({ ...program, points_per_stamp_block: Number(e.target.value) })}
                                                    className="w-20 p-2 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-white font-bold"
                                                />
                                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">pontos.</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Join Bonus */}
                            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-transparent">
                                <input
                                    type="checkbox"
                                    checked={program.enable_join_bonus}
                                    onChange={e => setProgram({ ...program, enable_join_bonus: e.target.checked })}
                                    className="mt-1 w-5 h-5 text-brand-green rounded focus:ring-brand-green"
                                />
                                <div className="flex-1">
                                    <span className="block font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                        <UserPlus size={16} /> Bônus de Adesão
                                    </span>
                                    {program.enable_join_bonus && (
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Ganhar</span>
                                            <input
                                                type="number"
                                                value={program.join_bonus_points}
                                                onChange={e => setProgram({ ...program, join_bonus_points: Number(e.target.value) })}
                                                className="w-20 p-2 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-white font-bold"
                                            />
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">pts ao cadastrar-se.</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Birthday Bonus */}
                            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-transparent">
                                <input
                                    type="checkbox"
                                    checked={program.enable_birthday_bonus}
                                    onChange={e => setProgram({ ...program, enable_birthday_bonus: e.target.checked })}
                                    className="mt-1 w-5 h-5 text-brand-green rounded focus:ring-brand-green"
                                />
                                <div className="flex-1">
                                    <span className="block font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                        <Calendar size={16} /> Presente de Aniversário
                                    </span>
                                    {program.enable_birthday_bonus && (
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Ganhar</span>
                                            <input
                                                type="number"
                                                value={program.birthday_bonus_points}
                                                onChange={e => setProgram({ ...program, birthday_bonus_points: Number(e.target.value) })}
                                                className="w-20 p-2 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-white font-bold"
                                            />
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">pts no aniversário.</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'categories' && <CategoryRules storeId={storeId} />}

                {activeTab === 'tiers' && <LevelsConfig storeId={storeId} />}

                {activeTab === 'manual' && program && <ActiveCustomers storeId={storeId} programId={program.id} />}

                {activeTab === 'rewards' && (
                    <RewardsConfig storeId={storeId} programId={program.id} />
                )}

                {activeTab === 'legal' && (
                    <LegalTerms programId={program.id} />
                )}
            </div>
        </PageContainer>
    );
}
