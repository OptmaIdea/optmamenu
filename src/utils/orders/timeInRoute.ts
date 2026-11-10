/**
 * Tempo decorrido desde a transição confirmada para "Saiu para entrega".
 * Não usa updated_at, que pode mudar sem um novo despacho.
 */
export function formatTimeInRoute(dispatchedAt: string | null | undefined, now: Date = new Date()): string {
    if (!dispatchedAt) return 'Horário de saída não registrado';
    const started = new Date(dispatchedAt).getTime();
    const elapsed = Math.floor((now.getTime() - started) / 60000);
    if (!Number.isFinite(started) || !Number.isFinite(elapsed) || elapsed < 0) {
        return 'Horário de saída não registrado';
    }
    if (elapsed < 60) return `Em rota há ${elapsed} min`;
    const hours = Math.floor(elapsed / 60);
    const minutes = elapsed % 60;
    return `Em rota há ${hours}h${minutes > 0 ? ` ${minutes}min` : ''}`;
}
