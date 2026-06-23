import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Clock, Save, Plus, Trash2, Calendar, AlertCircle, Loader, Info } from 'lucide-react';
import { toast } from 'sonner';
import type { StoreHour, StoreException } from '@/types';
import PageContainer from '@/components/common/PageContainer';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';


const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function Hours() {
    const { storeId: currentStoreId } = useCurrentStore();
    const { hasPermission } = usePermissions(currentStoreId);
    const canManage = hasPermission('settings.hours.manage');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [storeId, setStoreId] = useState<string | null>(null);
    const [hours, setHours] = useState<StoreHour[]>([]);
    const [exceptions, setExceptions] = useState<StoreException[]>([]);
    const [newException, setNewException] = useState<StoreException>({
        exception_date: '',
        is_closed: true,
        reason: ''
    });
    const [storeConfig, setStoreConfig] = useState<any>({});




    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get store via RPC - first get user's store ID
            const { data: storeData, error: storeError } = await supabase.rpc(
                'get_user_store_by_id',
                { p_user_id: user.id }
            );
            if (storeError) throw storeError;
            const store = Array.isArray(storeData) ? storeData[0] : storeData;

            if (store) {
                setStoreId(store.id);
                setStoreConfig(store.config || {});

                // Fetch Hours
                const { data: hoursData } = await supabase
                    .from('store_hours')
                    .select('*')
                    .eq('store_id', store.id)
                    .order('day_of_week');

                // Initialize empty days if needed
                const mergedHours = Array.from({ length: 7 }).map((_, i) => {
                    const existing = hoursData?.find(h => h.day_of_week === i);
                    return existing || {
                        day_of_week: i,
                        open_time: '09:00',
                        close_time: '18:00',
                        is_closed: false
                    };
                });
                setHours(mergedHours);

                // Fetch Exceptions
                const { data: exceptionsData } = await supabase
                    .from('store_schedules_exceptions')
                    .select('*')
                    .eq('store_id', store.id)
                    .order('exception_date', { ascending: true })
                    .gte('exception_date', new Date().toISOString().split('T')[0]); // Only future/today

                setExceptions(exceptionsData || []);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Erro ao carregar horários.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveHours = async () => {
        if (!storeId) return;
        setSaving(true);
        try {
            // 1. Upsert all hours
            const updates = hours.map(h => ({
                store_id: storeId,
                day_of_week: h.day_of_week,
                open_time: h.open_time,
                close_time: h.close_time,
                is_closed: h.is_closed
            }));

            const { error: hoursError } = await supabase
                .from('store_hours')
                .upsert(updates, { onConflict: 'store_id,day_of_week' });

            if (hoursError) throw hoursError;

            // 2. Update Store Config logic
            // First we need the current config to not overwrite other fields
            const { data, error } = await supabase.rpc(
                'get_store_config_admin',
                { p_store_id: storeId }
            );
            if (error) throw error;
            const currentStore = Array.isArray(data) ? data[0] : data;
            const newConfig = { ...currentStore?.config, ...storeConfig };

            const { error: configError } = await supabase
                .from('stores')
                .update({ config: newConfig })
                .eq('id', storeId);

            if (configError) throw configError;

            toast.success('Horários e Configurações salvos com sucesso!');
        } catch (error: any) {
            console.error('Error saving hours:', error);
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleAddException = async () => {
        if (!storeId || !newException.exception_date) return;
        try {
            const { data, error } = await supabase
                .from('store_schedules_exceptions')
                .insert([{
                    store_id: storeId,
                    ...newException,
                    open_time: newException.is_closed ? null : (newException.open_time || '09:00'),
                    close_time: newException.is_closed ? null : (newException.close_time || '18:00')
                }])
                .select()
                .maybeSingle();

            if (error) throw error;
            setExceptions([...exceptions, data]);
            setNewException({ exception_date: '', is_closed: true, reason: '' }); // Reset
            toast.success('Exceção adicionada!');
        } catch (error: any) {
            toast.error('Erro ao adicionar: ' + error.message);
        }
    };

    const handleDeleteException = async (id: string) => {
        if (!storeId) return;

        try {
            const { error } = await supabase
                .from('store_schedules_exceptions')
                .delete()
                .eq('id', id)
                .eq('store_id', storeId); // segurança extra

            if (error) throw error;

            setExceptions(prev => prev.filter(e => e.id !== id));
            toast.success('Exceção removida.');
        } catch (error: any) {
            console.error('Error deleting exception:', error);
            toast.error('Erro ao remover: ' + (error?.message || 'Erro desconhecido'));
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><Loader className="animate-spin text-[#21A896]" /></div>;

    return (
        <PageContainer
            title="Horários de Funcionamento"
            subtitle="Configure sua grade semanal e dias especiais (feriados)."
            category="Configurações"
            icon={<Clock className="text-[#21A896]" size={28} />}
            flat
        >

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* WEEKLY SCHEDULE */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <Calendar className="text-blue-500" size={24} /> Grade Semanal
                        </h2>
                        {canManage && (
                            <button
                                onClick={handleSaveHours}
                                disabled={saving}
                                className="bg-[#21A896] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-[#1a867a] dark:hover:bg-[#2ec4a6] transition disabled:opacity-50"
                            >
                                {saving ? <Loader size={18} className="animate-spin" /> : <Save size={18} />}
                                Salvar
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        {hours.map((day, index) => (
                            <div key={index} className={`flex items-center gap-4 p-3 rounded-xl border ${day.is_closed ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30' : 'bg-gray-50 dark:bg-gray-700/30 border-gray-100 dark:border-gray-600'}`}>
                                <div className="w-24 font-bold text-gray-700 dark:text-gray-300">
                                    {DAYS[day.day_of_week]}
                                </div>
                                <div className="flex-1 flex items-center gap-2">
                                    {!day.is_closed ? (
                                        <>
                                            <input
                                                type="time"
                                                value={day.open_time}
                                                disabled={!canManage}
                                                onChange={(e) => {
                                                    const newHours = [...hours];
                                                    newHours[index].open_time = e.target.value;
                                                    setHours(newHours);
                                                }}
                                                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-blue-400 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                            />
                                            <span className="text-gray-400">-</span>
                                            <input
                                                type="time"
                                                value={day.close_time}
                                                disabled={!canManage}
                                                onChange={(e) => {
                                                    const newHours = [...hours];
                                                    newHours[index].close_time = e.target.value;
                                                    setHours(newHours);
                                                }}
                                                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-blue-400 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                            />
                                        </>
                                    ) : (
                                        <span className="flex-1 text-center font-bold text-red-500 text-sm uppercase tracking-wider">Fechado</span>
                                    )}
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={!day.is_closed}
                                        disabled={!canManage}
                                        onChange={(e) => {
                                            const newHours = [...hours];
                                            newHours[index].is_closed = !e.target.checked;
                                            setHours(newHours);
                                        }}
                                        className="accent-[#21A896] w-5 h-5 disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <span className="text-xs font-bold text-gray-500">Aberto</span>
                                </label>
                            </div>
                        ))}
                    </div>
                </div>

                {/* EXCEPTIONS / HOLIDAYS */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                        <AlertCircle className="text-orange-500" size={24} /> Exceções e Feriados
                    </h2>

                    {/* Add New Form */}
                    {canManage && (
                        <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-200 dark:border-gray-600 mb-6">
                            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Adicionar Nova Data</h3>
                            <div className="space-y-3">
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className="text-xs text-gray-500 mb-1 block">Data</label>
                                        <input
                                            type="date"
                                            value={newException.exception_date}
                                            onChange={(e) => setNewException({ ...newException, exception_date: e.target.value })}
                                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs text-gray-500 mb-1 block">Motivo</label>
                                        <input
                                            type="text"
                                            placeholder="Ex: Natal"
                                            value={newException.reason || ''}
                                            onChange={(e) => setNewException({ ...newException, reason: e.target.value })}
                                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={newException.is_closed}
                                            onChange={(e) => setNewException({ ...newException, is_closed: e.target.checked })}
                                            className="accent-red-500 w-5 h-5"
                                        />
                                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Loja Fechada?</span>
                                    </label>

                                    {!newException.is_closed && (
                                        <div className="flex gap-2">
                                            <input
                                                type="time"
                                                value={newException.open_time || '09:00'}
                                                onChange={(e) => setNewException({ ...newException, open_time: e.target.value })}
                                                className="p-1.5 rounded-lg border text-sm w-24 text-gray-900 dark:text-gray-100"
                                            />
                                            <input
                                                type="time"
                                                value={newException.close_time || '18:00'}
                                                onChange={(e) => setNewException({ ...newException, close_time: e.target.value })}
                                                className="p-1.5 rounded-lg border text-sm w-24 text-gray-900 dark:text-gray-100"
                                            />
                                        </div>
                                    )}

                                    <button
                                        onClick={handleAddException}
                                        disabled={!newException.exception_date}
                                        className="ml-auto bg-[#21A896] text-white p-2 rounded-lg hover:bg-[#1a867a] dark:hover:bg-[#2ec4a6] disabled:opacity-50"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* List */}
                    <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                        {exceptions.length === 0 && (
                            <p className="text-center text-gray-400 py-4 text-sm">Nenhuma exceção cadastrada.</p>
                        )}
                        {exceptions.map(ex => (
                            <div key={ex.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-800 dark:text-white">
                                            {new Date(ex.exception_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                        </span>
                                        {ex.is_closed ? (
                                            <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Fechado</span>
                                        ) : (
                                            <span className="bg-[#21A896]/10 text-[#21A896] text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                                                {ex.open_time?.slice(0, 5)} - {ex.close_time?.slice(0, 5)}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-400">{ex.reason || 'Sem motivo'}</p>
                                </div>
                                {canManage && (
                                    <button
                                        onClick={() => handleDeleteException(ex.id!)}
                                        className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>


                {/* CONFIGURAÇÕES FINAIS */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mt-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <AlertCircle className="text-purple-500" size={24} /> Regras de Funcionamento
                        </h2>

                        {canManage && (
                            <button
                                onClick={async () => {
                                    if (!storeId) return;
                                    if (!window.confirm('URGENTE: Isso cancelará TODOS os pedidos com status "pendente" (reservados). Use isso ao fechar a loja para liberar cronômetros. Confirmar?')) return;

                                    const { error } = await supabase.rpc('cancel_all_pending_orders', { p_store_id: storeId });
                                    if (error) {
                                        toast.error('Erro ao cancelar pedidos: ' + error.message);
                                    } else {
                                        toast.success('Todos os pedidos pendentes foram cancelados.');
                                    }
                                }}
                                className="text-xs font-bold text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:border-red-800 px-3 py-2 rounded-lg transition flex items-center gap-2"
                            >
                                <Trash2 size={14} /> Fechar Loja & Cancelar Pendentes
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Limites e Buffers */}
                        <div>
                            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                                Regras de Abertura e Fechamento
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1 flex justify-between">
                                        Pré-Abertura (Aceitar pedidos antes)
                                        <span className="text-[#21A896]">{storeConfig?.pre_opening_minutes || 0} min</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="60"
                                        step="5"
                                        disabled={!canManage}
                                        className="w-full accent-[#21A896] disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={storeConfig?.pre_opening_minutes || 0}
                                        onChange={e => setStoreConfig({ ...storeConfig, pre_opening_minutes: parseInt(e.target.value) })}
                                    />
                                    <p className="text-xs text-gray-500">Permite que clientes façam pedidos X minutos antes da loja abrir (ex: para agendar).</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1 flex justify-between">
                                        Buffer de Fechamento (Encerrar antes)
                                        <span className="text-red-500">{storeConfig?.closing_buffer_minutes || 0} min</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="60"
                                        step="5"
                                        disabled={!canManage}
                                        className="w-full accent-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={storeConfig?.closing_buffer_minutes || 0}
                                        onChange={e => setStoreConfig({ ...storeConfig, closing_buffer_minutes: parseInt(e.target.value) })}
                                    />
                                    <p className="text-xs text-gray-500">Bloqueia novos pedidos X minutos antes do horário de fechar (para não receber pedidos em cima da hora).</p>
                                </div>
                            </div>
                        </div>

                        {/* Tolerâncias */}
                        <div>
                            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                                Tolerâncias e Avisos
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1 flex justify-between">
                                        Tolerância de Reserva (Expira em)
                                        <span className="text-[#21A896]">{storeConfig?.tolerance_minutes || 5} min</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="30"
                                        disabled={!canManage}
                                        className="w-full accent-[#21A896] disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={storeConfig?.tolerance_minutes || 5}
                                        onChange={e => setStoreConfig({ ...storeConfig, tolerance_minutes: parseInt(e.target.value) })}
                                    />
                                    <p className="text-xs text-gray-500">Tempo que o pedido fica reservado aguardando pagamento/confirmação.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1 flex justify-between">
                                        Tempo de Prorrogação (Extra)
                                        <span className="text-[#21A896]">{storeConfig?.extension_minutes || 3} min</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="15"
                                        disabled={!canManage}
                                        className="w-full accent-[#21A896] disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={storeConfig?.extension_minutes || 3}
                                        onChange={e => setStoreConfig({ ...storeConfig, extension_minutes: parseInt(e.target.value) })}
                                    />
                                    <p className="text-xs text-gray-500">Tempo extra concedido ao clicar em "Pedir Mais Tempo".</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1 flex justify-between">
                                        Aviso "Fechando em Breve"
                                        <span className="text-orange-500">{storeConfig?.pre_order_minutes || 20} min</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="5"
                                        max="60"
                                        disabled={!canManage}
                                        className="w-full accent-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={storeConfig?.pre_order_minutes || 20}
                                        onChange={e => setStoreConfig({ ...storeConfig, pre_order_minutes: parseInt(e.target.value) })}
                                    />
                                    <p className="text-xs text-gray-500">Quantos minutos antes de fechar exibir o aviso amarelo.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end mt-6 border-t border-gray-100 dark:border-gray-700 pt-4">
                        {canManage && (
                            <button
                                onClick={handleSaveHours}
                                disabled={saving}
                                className="bg-[#21A896] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-[#1a867a] dark:hover:bg-[#2ec4a6] transition disabled:opacity-50 shadow-lg shadow-[#21A896]/20 dark:shadow-none"
                            >
                                {saving ? <Loader size={18} className="animate-spin" /> : <Save size={18} />}
                                Salvar Alterações
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-8 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 flex gap-3 text-sm text-blue-700 dark:text-blue-300">
                <Info className="shrink-0" size={20} />
                <p>
                    <strong>Como funciona:</strong> O sistema verifica primeiro se há uma "Exceção" (Feriado) para a data de hoje. Se houver, usa o horário da exceção. Se não houver, usa o horário da "Grade Semanal".
                </p>
            </div>
        </PageContainer>
    );
}
