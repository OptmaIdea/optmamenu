/** Status que a tela "Pedidos atuais" considera ativos (mesmo contrato do badge SQL). */
export const CURRENT_ORDER_STATUSES = ['reserved', 'confirmed', 'ready', 'out_for_delivery'] as const;

export function isCurrentOrderStatus(status: string): boolean {
    return CURRENT_ORDER_STATUSES.some((current) => current === status);
}
