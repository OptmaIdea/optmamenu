import { Link } from 'react-router-dom';
import { Clock3, ShoppingBag, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useOrderMonitor } from '@/hooks/useOrderMonitor';

interface PendingOrdersFloatingAlertProps {
    storeId?: string | null;
    enabled?: boolean;
}

function compactCode(value?: string | null) {
    const suffix = String(value || '').split('-').pop();
    return suffix ? `#${suffix}` : '#PEDIDO';
}

export default function PendingOrdersFloatingAlert({
    storeId,
    enabled = true,
}: PendingOrdersFloatingAlertProps) {
    const { orders, pendingCount } = useOrderMonitor({
        storeId,
        enabled,
        intervalMs: 15_000,
    });
    const [dismissedSignature, setDismissedSignature] = useState<string | null>(null);

    const signature = useMemo(
        () => orders.map((order) => order.id).sort().join('|'),
        [orders],
    );

    if (!enabled || pendingCount === 0 || (signature && signature === dismissedSignature)) {
        return null;
    }

    const oldest = orders[0];
    const elapsedMinutes = oldest?.created_at
        ? Math.max(0, Math.floor((Date.now() - new Date(oldest.created_at).getTime()) / 60000))
        : 0;

    return (
        <div className="fixed bottom-5 right-5 z-[90] w-[calc(100%-2.5rem)] max-w-sm rounded-2xl border border-amber-300 bg-white p-4 shadow-2xl dark:border-amber-700 dark:bg-gray-850">
            <button
                type="button"
                onClick={() => setDismissedSignature(signature)}
                className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700"
                title="Ocultar até chegar outro pedido"
            >
                <X size={16} />
            </button>

            <div className="flex items-start gap-3 pr-7">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                    <ShoppingBag size={22} />
                    <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">
                        {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                </div>

                <div className="min-w-0 flex-1">
                    <p className="font-black text-gray-900 dark:text-white">
                        {pendingCount === 1 ? 'Novo pedido aguardando' : `${pendingCount} pedidos aguardando`}
                    </p>
                    <p className="mt-1 truncate text-sm text-gray-600 dark:text-gray-300">
                        {oldest?.customer_name || 'Cliente'} · {compactCode(oldest?.order_code)}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                        <Clock3 size={13} /> aguardando há {elapsedMinutes} min
                    </p>
                </div>
            </div>

            <Link
                to="/admin/orders"
                className="mt-4 flex w-full items-center justify-center rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-gray-950 transition hover:bg-amber-400"
            >
                Abrir pedidos
            </Link>
        </div>
    );
}
