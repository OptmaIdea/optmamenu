export interface CustomerDeletionFailure {
    error?: string;
    activeOrderCount?: number;
}

export function isCustomerDeletionPending(status?: string | null): boolean {
    return status === 'pending' || status === 'processing';
}

export function customerDeletionStatusLabel(status?: string | null): string {
    switch (status) {
        case 'pending': return 'Aguardando processamento';
        case 'processing': return 'Em processamento';
        case 'executed': return 'Conta excluída';
        case 'failed': return 'Não concluída';
        default: return status || 'Não informado';
    }
}

export function customerDeletionErrorMessage(payload?: CustomerDeletionFailure | null, httpStatus = 0): string {
    if (httpStatus === 401 || payload?.error === 'access_denied' || payload?.error === 'customer_identity_not_found') {
        return 'Sua sessão expirou. Entre novamente para concluir a exclusão.';
    }
    if (payload?.error === 'active_orders_exist') {
        const count = Number(payload.activeOrderCount);
        const validCount = Number.isSafeInteger(count) && count > 0 ? count : 0;
        return validCount
            ? 'Sua conta possui ' + validCount + ' pedido(s) ainda em andamento. Conclua ou cancele esses pedidos antes da exclusão definitiva.'
            : 'Há pedidos em andamento vinculados à conta. Conclua-os antes de tentar novamente.';
    }
    if (payload?.error === 'deletion_request_not_found') {
        return 'Não encontramos uma solicitação pendente. Atualize a área de privacidade antes de continuar.';
    }
    if (payload?.error === 'request_lookup_failed' || payload?.error === 'deletion_failed') {
        return 'A solicitação permanece registrada, mas não foi possível concluir a exclusão agora. Tente novamente mais tarde.';
    }
    return 'Não foi possível concluir a exclusão da conta agora. Se a solicitação foi registrada, ela permanece disponível para acompanhamento.';
}

export function formatCustomerOrderTimelineStatus(status?: string | null): string | null {
    if (!status) return null;
    const labels: Record<string, string> = {
        draft: 'Rascunho', pending: 'Pendente', reserved: 'Reservado',
        confirmed: 'Confirmado', preparing: 'Em preparo', ready: 'Pronto',
        out_for_delivery: 'Saiu para entrega', completed: 'Concluído',
        cancelled: 'Cancelado', expired: 'Expirado', rejected: 'Recusado',
    };
    return labels[status] || status;
}
