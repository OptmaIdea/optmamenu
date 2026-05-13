
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader, Info } from 'lucide-react';
import { toast } from 'sonner';

interface Category {
    id: string;
    name: string;
    loyalty_eligible: boolean;
    loyalty_multiplier: number;
}

export default function CategoryRules({ storeId }: { storeId: string }) {
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<Category[]>([]);

    useEffect(() => {
        if (storeId) fetchCategories();
    }, [storeId]);

    const fetchCategories = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('categories')
                .select('id, name, loyalty_eligible, loyalty_multiplier')
                .eq('store_id', storeId)
                .order('sort_order', { ascending: true });

            if (error) throw error;
            setCategories(data || []);
        } catch (error) {
            console.error('Error fetching categories:', error);
            toast.error('Erro ao carregar categorias.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (id: string, updates: Partial<Category>) => {
        // Optimistic update
        setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

        const { error } = await supabase
            .from('categories')
            .update(updates)
            .eq('id', id);

        if (error) {
            toast.error('Erro ao salvar alteração');
            fetchCategories(); // Revert on error
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader className="animate-spin text-brand-green" /></div>;

    return (
        <div className="animate-fadeIn space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl flex items-start gap-3 border border-blue-100 dark:border-blue-800">
                <Info className="text-blue-500 shrink-0 mt-0.5" size={20} />
                <div>
                    <h3 className="font-bold text-blue-700 dark:text-blue-300 text-sm">Regras por Categoria</h3>
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                        Defina quais categorias pontuam e crie aceleradores de pontos (ex: Bebidas valem 2x pontos).
                        Se uma categoria não for elegível, os itens dela não gerarão pontos na compra.
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 text-xs uppercase text-gray-500 font-bold">
                        <tr>
                            <th className="p-4">Categoria</th>
                            <th className="p-4 text-center">Pontua?</th>
                            <th className="p-4 text-center">Multiplicador</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {categories.map(cat => (
                            <tr key={cat.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                                <td className="p-4 font-medium text-gray-800 dark:text-gray-200">
                                    {cat.name}
                                </td>
                                <td className="p-4 text-center">
                                    <div className="flex justify-center">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={cat.loyalty_eligible !== false} // Default true
                                                onChange={e => handleUpdate(cat.id, { loyalty_eligible: e.target.checked })}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-green"></div>
                                        </label>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex justify-center items-center gap-2">
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            disabled={cat.loyalty_eligible === false}
                                            value={cat.loyalty_multiplier ?? 1.0}
                                            onChange={e => handleUpdate(cat.id, { loyalty_multiplier: parseFloat(e.target.value) })}
                                            className="w-20 p-2 text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white font-bold disabled:opacity-50"
                                        />
                                        <span className="text-gray-500 font-bold">x</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {categories.length === 0 && (
                            <tr>
                                <td colSpan={3} className="p-8 text-center text-gray-500">
                                    Nenhuma categoria encontrada.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
