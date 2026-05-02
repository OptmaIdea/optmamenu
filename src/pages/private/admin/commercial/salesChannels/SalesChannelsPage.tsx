import { useEffect, useMemo, useState } from 'react';
import {
    MessageCircle,
    ShoppingBag,
    QrCode,
    Handshake,
    Phone,
    Store,
    MoreHorizontal,
    RefreshCw,
    ToggleLeft,
    ToggleRight,
} from 'lucide-react';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import {
    SalesChannelsService,
    type StoreSalesChannel,
    type SalesChannelCode,
} from '@/services/salesChannelsService';

const CHANNEL_ICONS: Record<SalesChannelCode, any> = {
    whatsapp: MessageCircle,
    public_store: ShoppingBag,
    qr_table: QrCode,
    direct: Handshake,
    phone: Phone,
    in_person: Store,
    other: MoreHorizontal,
};

const CHANNEL_HINTS: Record<SalesChannelCode, string> = {
    whatsapp: 'Canal principal da Fase 8. Já usado no cardápio público.',
    public_store: 'Base da loja por slug. Será usado no carrinho/pedido seguro.',
    qr_table: 'Preparação para garçom digital e QR Code na loja.',
    direct: 'Venda registrada manualmente pela equipe.',
    phone: 'Atendimento iniciado por ligação.',
    in_person: 'Venda presencial/balcão.',
    other: 'Canal reserva para exceções.',
};

function statusBadge(active: boolean) {
    return active
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
}

export default function SalesChannelsPage() {
    const { storeId, loading: loadingStore } = useCurrentStore();
    const [channels, setChannels] = useState<StoreSalesChannel[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const publicChannelsCount = useMemo(
        () => channels.filter((channel) => channel.active && channel.public_enabled).length,
        [channels]
    );

    const activeChannelsCount = useMemo(
        () => channels.filter((channel) => channel.active).length,
        [channels]
    );

    async function loadChannels() {
        if (!storeId) return;

        try {
            setLoading(true);
            setError(null);
            const data = await SalesChannelsService.listByStore(storeId);
            setChannels(data);
        } catch (err: any) {
            console.error('Erro ao carregar canais:', err);
            setError(err?.message || 'Erro ao carregar canais de venda.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!loadingStore && storeId) {
            loadChannels();
        }
    }, [loadingStore, storeId]);

    async function toggleChannel(
        channel: StoreSalesChannel,
        field: 'active' | 'public_enabled'
    ) {
        try {
            setSavingId(channel.id);

            const updated = await SalesChannelsService.update({
                id: channel.id,
                [field]: !channel[field],
            });

            setChannels((prev) =>
                prev.map((item) => (item.id === updated.id ? updated : item))
            );
        } catch (err: any) {
            console.error('Erro ao atualizar canal:', err);
            alert(err?.message || 'Erro ao atualizar canal.');
        } finally {
            setSavingId(null);
        }
    }

    if (loadingStore || loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse rounded-3xl bg-white p-8 shadow-sm dark:bg-gray-800">
                    <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="mt-4 h-4 w-96 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            Comercial
                        </div>

                        <h1 className="mt-3 text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                            Canais de venda
                        </h1>

                        <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
                            Configure por onde a loja recebe vendas. Esta base será usada nos pedidos,
                            WhatsApp, loja pública, QR Code e vendas diretas.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={loadChannels}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                        <RefreshCw size={16} />
                        Atualizar
                    </button>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800">
                        <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                            Canais cadastrados
                        </p>
                        <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
                            {channels.length}
                        </p>
                    </div>

                    <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-900/20">
                        <p className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                            Ativos
                        </p>
                        <p className="mt-2 text-2xl font-black text-emerald-900 dark:text-emerald-100">
                            {activeChannelsCount}
                        </p>
                    </div>

                    <div className="rounded-2xl bg-blue-50 p-4 dark:bg-blue-900/20">
                        <p className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">
                            Públicos
                        </p>
                        <p className="mt-2 text-2xl font-black text-blue-900 dark:text-blue-100">
                            {publicChannelsCount}
                        </p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {channels.map((channel) => {
                    const Icon = CHANNEL_ICONS[channel.code] || MoreHorizontal;
                    const disabled = savingId === channel.id;

                    return (
                        <div
                            key={channel.id}
                            className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                        >
                            <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100">
                                    <Icon size={24} />
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h2 className="text-lg font-black text-gray-900 dark:text-white">
                                                {channel.name}
                                            </h2>
                                            <p className="mt-1 text-xs font-mono text-gray-400">
                                                {channel.code}
                                            </p>
                                        </div>

                                        <span
                                            className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${statusBadge(
                                                channel.active
                                            )}`}
                                        >
                                            {channel.active ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </div>

                                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                                        {channel.description || CHANNEL_HINTS[channel.code]}
                                    </p>

                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                                        {CHANNEL_HINTS[channel.code]}
                                    </p>

                                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => toggleChannel(channel, 'active')}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                        >
                                            {channel.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                            {channel.active ? 'Desativar canal' : 'Ativar canal'}
                                        </button>

                                        <button
                                            type="button"
                                            disabled={disabled || !channel.active}
                                            onClick={() => toggleChannel(channel, 'public_enabled')}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                        >
                                            {channel.public_enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                            {channel.public_enabled ? 'Ocultar no público' : 'Exibir no público'}
                                        </button>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {channel.requires_customer && (
                                            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                                exige cliente
                                            </span>
                                        )}

                                        {channel.requires_address && (
                                            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                                exige endereço
                                            </span>
                                        )}

                                        {channel.requires_table && (
                                            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                                exige mesa/comanda
                                            </span>
                                        )}

                                        {channel.public_enabled && (
                                            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                público
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                <strong>Nota da Fase 8:</strong> esta tela ainda não cria pedidos. Ela prepara
                a classificação dos pedidos para a Sprint 8.4 e o garçom digital da 8.8.
            </div>
        </div>
    );
}