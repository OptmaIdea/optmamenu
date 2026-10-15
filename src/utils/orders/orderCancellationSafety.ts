/**
 * Não utilizar cancelamento de reservas para reverter estoque baixado no despacho
 * nem como substituto de um estorno financeiro comprovado.
 */
export function getUnsafeCancelReason(
    status: string | null | undefined,
    paymentStatus: string | null | undefined,
): 'delivery_return_reversal_required' | 'refund_workflow_required' | null {
    if (status === 'out_for_delivery') return 'delivery_return_reversal_required';
    if (!['pending', 'failed'].includes(paymentStatus || 'pending')) return 'refund_workflow_required';
    return null;
}
