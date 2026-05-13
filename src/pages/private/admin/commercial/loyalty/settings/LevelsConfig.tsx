
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader, Plus, Trash2, Award } from 'lucide-react';
import { toast } from 'sonner';

interface Tier {
    id: string;
    name: string;
    min_points: number;
    multiplier: number;
    color: string;
    position: number;
}

export default function LevelsConfig({ storeId }: { storeId: string }) {
    const [loading, setLoading] = useState(true);
    const [tiers, setTiers] = useState<Tier[]>([]);

    useEffect(() => {
        if (storeId) fetchTiers();
    }, [storeId]);

    const fetchTiers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('fidelity_tiers')
                .select('*')
                .eq('store_id', storeId)
                .order('min_points', { ascending: true }); // Order by points usually implies hierarchy

            if (error) throw error;
            setTiers(data || []);
        } catch (error) {
            console.error('Error fetching tiers:', error);
            toast.error('Erro ao carregar níveis.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddTier = async () => {
        const newTier = {
            store_id: storeId,
            name: 'Novo Nível',
            min_points: 1000,
            multiplier: 1.0,
            color: '#000000',
            position: tiers.length + 1
        };

        const { data, error } = await supabase.from('fidelity_tiers').insert([newTier]).select().maybeSingle();
        if (error) {
            toast.error('Erro ao criar nível');
        } else {
            setTiers([...tiers, data]);
            toast.success('Nível criado!');
        }
    };

    const handleUpdate = async (id: string, updates: Partial<Tier>) => {
        setTiers(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

        const { error } = await supabase.from('fidelity_tiers').update(updates).eq('id', id);
        if (error) toast.error('Erro ao salvar');
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este nível? Clientes nele podem ficar sem nível.')) return;

        setTiers(prev => prev.filter(t => t.id !== id));
        const { error } = await supabase.from('fidelity_tiers').delete().eq('id', id);
        if (error) toast.error('Erro ao excluir');
    };

    if (loading) return <div className="flex justify-center p-8"><Loader className="animate-spin text-brand-green" /></div>;

    return (
        <div className="animate-fadeIn space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <Award size={20} className="text-yellow-500" />
                    Gerenciar Níveis
                </h3>
                <button
                    onClick={handleAddTier}
                    className="text-brand-green bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 transition"
                >
                    <Plus size={16} /> Novo Nível
                </button>
            </div>

            <div className="space-y-4">
                {tiers.map((tier, index) => (
                    <div key={tier.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col md:flex-row items-center gap-4 relative group">

                        {/* Tier Info */}
                        <div className="flex items-center gap-4 flex-1 w-full">
                            <div
                                className="w-12 h-12 rounded-full flex items-center justify-center font-black text-white text-lg shadow-sm shrink-0"
                                style={{ backgroundColor: tier.color }}
                            >
                                {index + 1}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase">Nome do Nível</label>
                                    <input
                                        type="text"
                                        value={tier.name}
                                        onChange={e => handleUpdate(tier.id, { name: e.target.value })}
                                        className="w-full font-bold text-gray-800 dark:text-white bg-transparent border-b border-gray-200 dark:border-gray-700 focus:border-brand-green outline-none py-1"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase">Pontos Mínimos</label>
                                    <input
                                        type="number"
                                        value={tier.min_points}
                                        onChange={e => handleUpdate(tier.id, { min_points: Number(e.target.value) })}
                                        className="w-full font-bold text-gray-800 dark:text-white bg-transparent border-b border-gray-200 dark:border-gray-700 focus:border-brand-green outline-none py-1"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase">Multiplicador</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={tier.multiplier}
                                            onChange={e => handleUpdate(tier.id, { multiplier: parseFloat(e.target.value) })}
                                            className="w-full font-bold text-gray-800 dark:text-white bg-transparent border-b border-gray-200 dark:border-gray-700 focus:border-brand-green outline-none py-1"
                                        />
                                        <span className="text-gray-400 text-sm font-bold">x</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Color Picker & Actions */}
                        <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-700 pt-4 md:pt-0 md:pl-4 w-full md:w-auto mt-2 md:mt-0 justify-between md:justify-start">
                            <div className="flex flex-col">
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1">Cor (Hex)</label>
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <input
                                            type="color"
                                            value={/^#[0-9A-F]{6}$/i.test(tier.color) ? tier.color : '#000000'}
                                            onChange={e => handleUpdate(tier.id, { color: e.target.value })}
                                            className="h-9 w-12 rounded-lg cursor-pointer border border-gray-200 dark:border-gray-600 p-0 overflow-hidden"
                                        />
                                    </div>
                                    <div className="flex items-center bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg px-2">
                                        <span className="text-gray-400 text-sm font-bold">#</span>
                                        <input
                                            type="text"
                                            value={tier.color.replace('#', '').toUpperCase()}
                                            maxLength={7}
                                            onChange={e => {
                                                // Allow typing, strip non-hex
                                                const val = e.target.value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase().slice(0, 6);
                                                handleUpdate(tier.id, { color: `#${val}` });
                                            }}
                                            className="w-20 font-bold text-gray-800 dark:text-white bg-transparent outline-none py-1.5 uppercase tracking-wider"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => handleDelete(tier.id)}
                                className="p-2 text-red-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition"
                                title="Excluir Nível"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>

                    </div>
                ))}

                {tiers.length === 0 && (
                    <div className="text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500">
                        <Award size={48} className="mx-auto mb-2 opacity-20" />
                        <p>Nenhum nível configurado.</p>
                        <button
                            onClick={handleAddTier}
                            className="text-brand-green font-bold mt-2 hover:underline"
                        >
                            Criar Primeiro Nível
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
