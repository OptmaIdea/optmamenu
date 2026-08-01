import { Boxes, Eye, EyeOff, Store } from 'lucide-react';
import type { OnlineOrderSettingsPayload, StockLocationOption } from '@/services/onlineOrderSettingsService';

interface OnlineStockPolicySectionProps {
    locations: StockLocationOption[];
    publicSalesLocationId: string;
    onPublicSalesLocationChange: (locationId: string) => void;
    settings: OnlineOrderSettingsPayload;
    onChange: (partial: OnlineOrderSettingsPayload) => void;
    disabled?: boolean;
}

function numberValue(value: unknown, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export default function OnlineStockPolicySection({
    locations,
    publicSalesLocationId,
    onPublicSalesLocationChange,
    settings,
    onChange,
    disabled = false,
}: OnlineStockPolicySectionProps) {
    const reserve = numberValue(settings.online_stock_local_reserve_default, 0);
    const threshold = numberValue(settings.online_stock_low_threshold, 5);
    const onlineLimit = settings.online_stock_limit_default;
    const selectedLocation = locations.find((location) => location.id === publicSalesLocationId);

    return (
        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-2">
                <Boxes size={18} className="text-emerald-600" />
                <h2 className="text-lg font-black text-gray-900 dark:text-white">Estoque da loja pública</h2>
            </div>

            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                A slug usa somente o saldo disponível do local escolhido. O estoque global e os demais locais não entram no cálculo público.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-200">Local de estoque vinculado à slug</label>
                    <select
                        value={publicSalesLocationId}
                        onChange={(event) => onPublicSalesLocationChange(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                        disabled={disabled}
                    >
                        <option value="">Selecionar automaticamente</option>
                        {locations.map((location) => (
                            <option key={location.id} value={location.id}>
                                {location.name}{location.code ? ` — ${location.code}` : ''}{location.is_default ? ' — padrão' : ''}
                            </option>
                        ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                        {selectedLocation
                            ? `A disponibilidade pública será calculada em ${selectedLocation.name}.`
                            : 'Sem seleção explícita, o backend tenta usar o local padrão ativo da loja.'}
                    </p>
                </div>

                <div>
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-200">Reserva mínima para venda local</label>
                    <input
                        type="number"
                        min="0"
                        step="1"
                        value={reserve}
                        onChange={(event) => onChange({ online_stock_local_reserve_default: Math.max(0, numberValue(event.target.value, 0)) })}
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                        disabled={disabled}
                    />
                    <p className="mt-1 text-xs text-gray-500">Quantidade protegida para vendas presenciais antes de liberar saldo online.</p>
                </div>

                <div>
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-200">Limite máximo disponível online</label>
                    <input
                        type="number"
                        min="0"
                        step="1"
                        value={onlineLimit === null || onlineLimit === undefined ? '' : String(onlineLimit)}
                        onChange={(event) => onChange({
                            online_stock_limit_default: event.target.value === ''
                                ? null
                                : Math.max(0, numberValue(event.target.value, 0)),
                        })}
                        placeholder="Sem limite"
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                        disabled={disabled}
                    />
                    <p className="mt-1 text-xs text-gray-500">Em branco, todo o saldo restante após a reserva local poderá ser vendido online.</p>
                </div>

                <div>
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-200">Mostrar “Poucas unidades” até</label>
                    <input
                        type="number"
                        min="0"
                        step="1"
                        value={threshold}
                        onChange={(event) => onChange({ online_stock_low_threshold: Math.max(0, numberValue(event.target.value, 0)) })}
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                        disabled={disabled}
                    />
                    <p className="mt-1 text-xs text-gray-500">Zero desativa o aviso de poucas unidades.</p>
                </div>

                <label className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                                {settings.online_stock_show_exact ? <Eye size={16} /> : <EyeOff size={16} />}
                                Mostrar quantidade exata
                            </p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Quando desligado, o catálogo mostra apenas o estado público.</p>
                        </div>
                        <input
                            type="checkbox"
                            checked={Boolean(settings.online_stock_show_exact)}
                            onChange={(event) => onChange({ online_stock_show_exact: event.target.checked })}
                            className="h-5 w-5"
                            disabled={disabled}
                        />
                    </div>
                </label>

                <label className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800 sm:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                                <Store size={16} /> Publicar produtos por padrão
                            </p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Produtos ativos entram na slug por padrão. Exceções individuais serão administradas na grade própria da loja pública.
                            </p>
                        </div>
                        <input
                            type="checkbox"
                            checked={Boolean(settings.online_stock_publish_products_by_default)}
                            onChange={(event) => onChange({ online_stock_publish_products_by_default: event.target.checked })}
                            className="h-5 w-5"
                            disabled={disabled}
                        />
                    </div>
                </label>
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs leading-5 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
                <strong>Cálculo:</strong> disponível online = saldo disponível no local − reserva para venda local, limitado pelo teto online quando configurado. O resultado nunca fica negativo.
            </div>
        </section>
    );
}
