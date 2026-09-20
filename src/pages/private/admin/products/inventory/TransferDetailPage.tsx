import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ArrowLeft, CheckCircle2, RotateCcw, Send, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import LoadingSpinner from '@/components/common/LoadingSpinner';
import PageContainer from '@/components/common/PageContainer';
import TransferDetailHeader from './components/TransferDetailHeader';
import TransferItemsTable from './components/TransferItemsTable';
import { useStockTransferDetail } from './hooks/useStockTransferDetail';
import { stockService, reverseReceivedStockTransfer } from '@/services/stockService';
import { downloadCsv } from '@/utils/export/csv';
import OperationalTimeline from './components/OperationalTimeline';
import { useOperationalTimeline } from './hooks/useOperationalTimeline';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { usePermissions } from '@/hooks/usePermissions';
import { formatNumberPtBr, formatCurrencyPtBr } from '@/utils/export/formatters';
import { formatDateTimeForExportPtBr, getLocalDateInputValue } from '@/utils/dateTime';

type ReceiveRowState = {
    receivedQty: number;
    divergenceResolution: 'loss' | 'return_to_origin' | 'accepted_shortage' | '';
    divergenceReason: string;
    divergenceNotes: string;
};

type TransferItem = {
    id: string;
    product_id: string;
    product_name: string;
    requested_qty: number;
    shipped_qty: number;
    received_qty: number;
    divergence_qty: number;
    unit_cost: number | null;
    notes: string | null;
};

const getTransferStatusLabel = (status: string | null | undefined) => {
    switch (status) {
        case 'draft': return 'Rascunho';
        case 'approved': return 'Aprovada';
        case 'shipped': return 'Enviada';
        case 'received': return 'Recebida';
        case 'cancelled': return 'Cancelada';
        case 'divergent': return 'Divergente';
        default: return status ?? '';
    }
};

function getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null && 'message' in error) {
        return String((error as { message?: unknown }).message ?? '');
    }
    return '';
}

function getFriendlyShipError(error: unknown, items: TransferItem[]) {
    const message = getErrorMessage(error);
    const insufficientMatch = message.match(/Saldo insuficiente na origem para o produto ([0-9a-f-]+)\. Disponível: ([\d.,-]+), solicitado: ([\d.,-]+)/i);
    const missingBalanceMatch = message.match(/Produto ([0-9a-f-]+) sem saldo na origem/i);

    if (insufficientMatch) {
        const [, productId, available, requested] = insufficientMatch;
        const productName = items.find((item) => item.product_id === productId)?.product_name || 'Produto';
        return {
            expected: true,
            title: 'Saldo insuficiente na origem',
            description: `${productName} possui ${available} unidade(s) disponível(is), mas a transferência solicita ${requested}. Ajuste a quantidade ou reponha o estoque antes de enviar.`,
        };
    }

    if (missingBalanceMatch) {
        const productId = missingBalanceMatch[1];
        const productName = items.find((item) => item.product_id === productId)?.product_name || 'Produto';
        return {
            expected: true,
            title: 'Produto sem saldo na origem',
            description: `${productName} não possui saldo registrado no local de origem. Ajuste o estoque ou remova o item da transferência.`,
        };
    }

    if (/Apenas transferências em rascunho podem ser enviadas/i.test(message)) {
        return {
            expected: true,
            title: 'Transferência não pode ser enviada',
            description: 'Somente transferências em rascunho podem ser enviadas. Atualize a tela para conferir o estado atual.',
        };
    }

    return {
        expected: false,
        title: 'Não foi possível enviar a transferência',
        description: message || 'Ocorreu uma falha inesperada ao enviar a transferência.',
    };
}

export default function TransferDetailPage() {
    const { id } = useParams();
    const { data, loading, refresh } = useStockTransferDetail(id);
    const { storeId } = useCurrentStore();
    const { hasPermission } = usePermissions(storeId ?? null);
    const canConfirmTransfers = hasPermission('transfers.confirm');
    const canCancelTransfers = hasPermission('transfers.cancel');

    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [showReceiveForm, setShowReceiveForm] = useState(false);
    const [receiveRows, setReceiveRows] = useState<Record<string, ReceiveRowState>>({});

    const transfer = data.header;
    const items = data.items as TransferItem[];

    const {
        events: transferTimelineEvents,
        loading: loadingTransferTimeline,
        refetch: refetchTransferTimeline,
    } = useOperationalTimeline({
        enabled: Boolean(transfer?.id),
        storeId: transfer?.store_id ?? null,
        entityType: 'stock_transfer',
        relatedStockTransferId: transfer?.id ?? null,
        limit: 30,
    });

    useEffect(() => {
        setPortalContainer(document.getElementById('quick-access-actions-portal'));
    }, []);

    useEffect(() => {
        if (!items.length) return;
        setReceiveRows(items.reduce<Record<string, ReceiveRowState>>((acc, item) => {
            acc[item.id] = {
                receivedQty: Number(item.shipped_qty ?? item.requested_qty ?? 0),
                divergenceResolution: '',
                divergenceReason: '',
                divergenceNotes: '',
            };
            return acc;
        }, {}));
    }, [transfer?.id, items]);

    const handleExportCsv = () => {
        if (!transfer) return;
        downloadCsv({
            filename: `transferencia_${transfer.transfer_code || transfer.id}_${getLocalDateInputValue()}.csv`,
            headers: ['Código', 'Origem', 'Destino', 'Status', 'Solicitada em', 'Produto', 'Solicitado', 'Enviado', 'Recebido', 'Divergência', 'Custo unitário', 'Observações do item'],
            rows: items.map((item) => [
                transfer.transfer_code ?? '',
                transfer.source_location_name ?? '',
                transfer.destination_location_name ?? '',
                getTransferStatusLabel(transfer.status),
                formatDateTimeForExportPtBr(transfer.requested_at),
                item.product_name ?? '',
                formatNumberPtBr(item.requested_qty),
                formatNumberPtBr(item.shipped_qty),
                formatNumberPtBr(item.received_qty),
                formatNumberPtBr(item.divergence_qty),
                formatCurrencyPtBr(item.unit_cost ?? 0),
                item.notes ?? '',
            ]),
        });
    };

    const handleShipTransfer = async () => {
        if (!transfer?.id) return;
        if (!canConfirmTransfers) {
            toast.error('Você não tem permissão para enviar transferências.');
            return;
        }
        if (!window.confirm('Enviar esta transferência agora? O estoque será baixado da origem e a ação não deve ser feita se a remessa ainda não saiu fisicamente.')) return;

        try {
            setActionLoading(true);
            const result = await stockService.shipStockTransfer({ transferId: transfer.id, notes: 'Transferência enviada pela tela de detalhe.' });
            toast.success(`Transferência ${result.transfer_code} enviada com sucesso.`);
            await Promise.all([refresh(), refetchTransferTimeline()]);
        } catch (error: unknown) {
            const feedback = getFriendlyShipError(error, items);
            if (!feedback.expected) console.error('Falha inesperada ao enviar transferência:', error);
            toast.error(feedback.title, { description: feedback.description, duration: 8000 });
        } finally {
            setActionLoading(false);
        }
    };

    const handleCancelTransfer = async () => {
        if (!transfer?.id) return;
        if (!canCancelTransfers) {
            toast.error('Você não tem permissão para cancelar transferências.');
            return;
        }
        const reason = window.prompt('Informe o motivo do cancelamento:');
        if (!reason?.trim()) {
            toast.warning('Informe o motivo do cancelamento.');
            return;
        }
        try {
            setActionLoading(true);
            const result = await stockService.cancelStockTransfer({ transferId: transfer.id, reason });
            toast.success(`Transferência ${result.transfer_code} cancelada.`);
            await Promise.all([refresh(), refetchTransferTimeline()]);
        } catch (error: unknown) {
            console.error('Erro ao cancelar transferência:', error);
            toast.error(getErrorMessage(error) || 'Não foi possível cancelar a transferência.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReverseReceivedTransfer = async () => {
        if (!transfer?.id) return;
        if (!canCancelTransfers) {
            toast.error('Você não tem permissão para estornar transferências recebidas.');
            return;
        }
        const reason = window.prompt('Informe o motivo do estorno do recebimento:');
        if (!reason?.trim()) {
            toast.warning('Informe o motivo do estorno.');
            return;
        }
        if (!window.confirm('Estornar o recebimento desta transferência? O sistema vai retirar o saldo do destino e devolver para a origem, mantendo o histórico.')) return;

        try {
            setActionLoading(true);
            const result = await reverseReceivedStockTransfer({ transferId: transfer.id, reason: reason.trim() });
            toast.success(`Transferência ${result.transfer_code ?? transfer.transfer_code ?? ''} estornada com sucesso.`);
            await Promise.all([refresh(), refetchTransferTimeline()]);
        } catch (error: unknown) {
            console.error('Erro ao estornar transferência recebida:', error);
            toast.error(getErrorMessage(error) || 'Não foi possível estornar a transferência recebida.');
        } finally {
            setActionLoading(false);
        }
    };

    const updateRow = (itemId: string, patch: Partial<ReceiveRowState>) => {
        setReceiveRows((current) => ({ ...current, [itemId]: { ...current[itemId], ...patch } }));
    };

    const handleReceiveTransfer = async () => {
        if (!transfer?.id || !items.length) return;
        if (!canConfirmTransfers) {
            toast.error('Você não tem permissão para receber transferências.');
            return;
        }

        const mappedItems = items.map((item) => {
            const row = receiveRows[item.id];
            const shippedQty = Number(item.shipped_qty ?? 0);
            const receivedQty = Number(row?.receivedQty ?? 0);
            const hasDivergence = receivedQty < shippedQty;
            return {
                itemId: item.id,
                receivedQty,
                divergenceResolution: hasDivergence ? (row?.divergenceResolution || null) : null,
                divergenceReason: hasDivergence ? row?.divergenceReason || null : null,
                divergenceNotes: hasDivergence ? row?.divergenceNotes || null : null,
            };
        });

        const invalid = mappedItems.some((item) => {
            const original = items.find((row) => row.id === item.itemId);
            const shippedQty = Number(original?.shipped_qty ?? 0);
            if (item.receivedQty < 0 || item.receivedQty > shippedQty) return true;
            return item.receivedQty < shippedQty && (!item.divergenceResolution || !item.divergenceReason);
        });

        if (invalid) {
            toast.warning('Revise as quantidades recebidas. Divergências precisam de resolução e motivo.');
            return;
        }

        try {
            setActionLoading(true);
            const result = await stockService.receiveStockTransfer({ transferId: transfer.id, items: mappedItems, notes: 'Recebimento registrado pela tela de detalhe.' });
            toast.success(result.status === 'divergent' ? 'Transferência recebida com divergência.' : 'Transferência recebida com sucesso.');
            setShowReceiveForm(false);
            await Promise.all([refresh(), refetchTransferTimeline()]);
        } catch (error: unknown) {
            console.error('Erro ao receber transferência:', error);
            toast.error(getErrorMessage(error) || 'Não foi possível receber a transferência.');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <LoadingSpinner />;

    if (!transfer) {
        return (
            <PageContainer title="Detalhes da transferência" withoutHeader>
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Transferência não encontrada</h1>
                </div>
            </PageContainer>
        );
    }

    return (
        <>
            {portalContainer && createPortal(
                <div className="flex items-center gap-2">
                    <Link to="/admin/transfers" className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold text-gray-500 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800">
                        <ArrowLeft size={13} /><span>Transferências</span>
                    </Link>
                    {transfer.status === 'draft' && canConfirmTransfers && (
                        <button type="button" onClick={handleShipTransfer} disabled={actionLoading} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60">
                            <Send size={13} /><span>Enviar</span>
                        </button>
                    )}
                    {transfer.status === 'draft' && canCancelTransfers && (
                        <button type="button" onClick={handleCancelTransfer} disabled={actionLoading} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-60 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                            <XCircle size={13} /><span>Cancelar</span>
                        </button>
                    )}
                    {transfer.status === 'shipped' && canConfirmTransfers && (
                        <button type="button" onClick={() => setShowReceiveForm((value) => !value)} disabled={actionLoading} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60">
                            <CheckCircle2 size={13} /><span>Receber</span>
                        </button>
                    )}
                    {transfer.status === 'received' && canCancelTransfers && (
                        <button type="button" onClick={handleReverseReceivedTransfer} disabled={actionLoading} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                            <RotateCcw size={13} /><span>Estornar recebimento</span>
                        </button>
                    )}
                    <button type="button" onClick={handleExportCsv} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800">
                        Exportar itens
                    </button>
                </div>,
                portalContainer,
            )}

            <PageContainer title="Detalhes da transferência" withoutHeader>
                <TransferDetailHeader header={transfer} />

                <OperationalTimeline
                    compact
                    className="mt-6"
                    title="Andamento da transferência"
                    description="Histórico operacional desta transferência, incluindo criação, envio, recebimento e cancelamento."
                    emptyTitle="Nenhum andamento registrado"
                    emptyDescription="Os eventos desta transferência aparecerão aqui conforme o fluxo for executado."
                    events={transferTimelineEvents}
                    loading={loadingTransferTimeline}
                    onRefresh={() => void refetchTransferTimeline()}
                />

                {showReceiveForm && transfer.status === 'shipped' && canConfirmTransfers && (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-emerald-800 dark:text-emerald-200">Receber transferência</h2>
                                <p className="mt-1 text-sm text-emerald-700/80 dark:text-emerald-300/80">Informe quanto chegou ao destino. Se houver diferença, selecione o destino da divergência.</p>
                            </div>
                            <button type="button" onClick={handleReceiveTransfer} disabled={actionLoading} className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                                {actionLoading ? 'Recebendo...' : 'Confirmar recebimento'}
                            </button>
                        </div>
                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full min-w-[980px] text-sm">
                                <thead><tr className="text-left text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300"><th className="py-2 pr-3">Produto</th><th className="py-2 pr-3">Enviado</th><th className="py-2 pr-3">Recebido</th><th className="py-2 pr-3">Divergência</th><th className="py-2 pr-3">Destino da divergência</th><th className="py-2 pr-3">Motivo</th><th className="py-2 pr-3">Observação</th></tr></thead>
                                <tbody>
                                    {items.map((item) => {
                                        const row = receiveRows[item.id];
                                        const shippedQty = Number(item.shipped_qty ?? 0);
                                        const receivedQty = Number(row?.receivedQty ?? 0);
                                        const divergenceQty = Math.max(0, shippedQty - receivedQty);
                                        const hasDivergence = divergenceQty > 0;
                                        return (
                                            <tr key={item.id} className="border-t border-emerald-100 dark:border-emerald-900/40">
                                                <td className="py-2 pr-3 font-medium text-gray-900 dark:text-gray-100">{item.product_name}</td>
                                                <td className="py-2 pr-3">{shippedQty}</td>
                                                <td className="py-2 pr-3"><input type="number" min={0} max={shippedQty} value={receivedQty} onChange={(event) => updateRow(item.id, { receivedQty: Math.max(0, Math.min(shippedQty, Number(event.target.value) || 0)) })} className="w-24 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-sm dark:border-emerald-900 dark:bg-gray-950" /></td>
                                                <td className="py-2 pr-3">{hasDivergence ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">{divergenceQty}</span> : <span className="text-gray-400">0</span>}</td>
                                                <td className="py-2 pr-3"><select value={row?.divergenceResolution ?? ''} disabled={!hasDivergence} onChange={(event) => updateRow(item.id, { divergenceResolution: event.target.value as ReceiveRowState['divergenceResolution'] })} className="w-44 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-sm disabled:opacity-50 dark:border-emerald-900 dark:bg-gray-950"><option value="">Selecione</option><option value="loss">Perda/Avaria</option><option value="return_to_origin">Retornar para origem</option><option value="accepted_shortage">Falta aceita</option></select></td>
                                                <td className="py-2 pr-3"><select value={row?.divergenceReason ?? ''} disabled={!hasDivergence} onChange={(event) => updateRow(item.id, { divergenceReason: event.target.value })} className="w-40 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-sm disabled:opacity-50 dark:border-emerald-900 dark:bg-gray-950"><option value="">Selecione</option><option value="derretimento">Derretimento</option><option value="quebra">Quebra/Avaria</option><option value="recusa_destino">Recusa no destino</option><option value="extravio">Extravio</option><option value="erro_separacao">Erro de separação</option><option value="outro">Outro</option></select></td>
                                                <td className="py-2 pr-3"><input value={row?.divergenceNotes ?? ''} disabled={!hasDivergence} onChange={(event) => updateRow(item.id, { divergenceNotes: event.target.value })} placeholder="Observação" className="w-56 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-sm disabled:opacity-50 dark:border-emerald-900 dark:bg-gray-950" /></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-3 rounded-xl bg-white/70 p-3 text-xs text-emerald-800 dark:bg-gray-900/40 dark:text-emerald-200"><strong>Regra:</strong> o destino recebe apenas a quantidade informada como recebida. “Perda/Avaria” e “Falta aceita” reduzem o estoque global; “Retornar para origem” devolve a diferença à origem.</div>
                    </div>
                )}

                {transfer.status === 'draft' && !canConfirmTransfers && !canCancelTransfers && <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">Você pode visualizar esta transferência, mas não tem permissão para enviar ou cancelar.</p>}
                {transfer.status === 'shipped' && !canConfirmTransfers && <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">Você pode visualizar esta transferência, mas não tem permissão para receber ou tratar divergências.</p>}
                {transfer.status === 'received' && !canCancelTransfers && <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">Você pode visualizar esta transferência recebida, mas não tem permissão para estornar o recebimento.</p>}

                <TransferItemsTable items={items} />
            </PageContainer>
        </>
    );
}
