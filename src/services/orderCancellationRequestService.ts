import { supabase, supabaseCustomer } from '@/lib/supabase';

export type CancellationRequestStatus =
  | 'received' | 'under_review' | 'awaiting_return'
  | 'refund_processing' | 'approved' | 'rejected';

export interface CancellationRequestEvent {
  id: string;
  status: CancellationRequestStatus;
  note: string | null;
  at: string;
}
export interface CancellationRequest {
  id: string;
  order_id: string;
  order_code?: string;
  order_status?: string;
  payment_status?: string;
  status: CancellationRequestStatus;
  request_type: 'cancellation' | 'post_delivery_occurrence';
  reason: string;
  requested_at: string;
  updated_at?: string;
  decision_at?: string | null;
  decision_note?: string | null;
  events?: CancellationRequestEvent[];
}
export const CANCELLATION_STATUS_LABELS: Record<CancellationRequestStatus, string> = {
  received: 'Solicitação recebida',
  under_review: 'Em análise',
  awaiting_return: 'Aguardando retorno e conferência',
  refund_processing: 'Estorno em processamento',
  approved: 'Aprovada',
  rejected: 'Recusada',
};
export const CANCELLATION_ACTIVE_STATUSES: CancellationRequestStatus[] = [
  'received','under_review','awaiting_return','refund_processing',
];

export const OrderCancellationRequestService = {
  async myRequests(): Promise<CancellationRequest[]> {
    const { data, error } = await supabaseCustomer.rpc('get_customer_self_order_cancellation_requests_safe', { p_limit: 150 });
    if (error || !data?.ok) throw new Error('Não foi possível consultar as solicitações. Tente atualizar.');
    return Array.isArray(data.requests) ? data.requests as CancellationRequest[] : [];
  },

  async request(orderId: string, reason: string) {
    const trimmed = reason.trim();
    if (trimmed.length < 8 || trimmed.length > 700) {
      throw new Error('Descreva o motivo com 8 a 700 caracteres.');
    }
    const { data, error } = await supabaseCustomer.rpc('request_customer_self_order_cancellation_safe', {
      p_order_id: orderId, p_reason: trimmed,
    });
    if (error || !data?.ok) {
      const labels: Record<string,string> = {
        access_denied: 'Sua sessão expirou. Entre novamente.',
        order_not_found: 'Esse pedido não pertence à sua conta nesta loja.',
        already_cancelled: 'O pedido já foi cancelado.',
        invalid_reason: 'Informe um motivo entre 8 e 700 caracteres.',
      };
      throw new Error(labels[String(data?.error || '')] || 'Não foi possível registrar sua solicitação.');
    }
    return data as { ok: true; request_id: string; status: CancellationRequestStatus; already_exists: boolean };
  },

  async adminRequests(storeId: string): Promise<CancellationRequest[]> {
    const { data, error } = await supabase.rpc('get_admin_order_cancellation_requests_safe', { p_store_id: storeId, p_limit: 150 });
    if (error || !data?.ok) throw new Error('Não foi possível carregar solicitações de cancelamento.');
    return Array.isArray(data.requests) ? data.requests as CancellationRequest[] : [];
  },

  async review(requestId: string, status: 'under_review' | 'awaiting_return' | 'rejected', note: string) {
    const { data, error } = await supabase.rpc('review_admin_order_cancellation_request_safe', {
      p_request_id: requestId, p_status: status, p_note: note.trim() || null,
    });
    if (error || !data?.ok) {
      const labels: Record<string,string> = {
        access_denied: 'Sua permissão não autoriza essa decisão.',
        invalid_transition: 'Esta mudança de situação não é permitida.',
        invalid_decision_note: 'Informe uma justificativa com pelo menos 8 caracteres.',
        request_no_longer_reviewable: 'A solicitação já foi encerrada ou avançou para outra etapa.',
        delivery_return_not_applicable: 'Aguardando retorno só vale para pedido em rota.',
        order_already_cancelled_requires_reconciliation: 'O pedido já foi cancelado; reconcilie o registro com Pedidos/Financeiro.',
      };
      throw new Error(labels[String(data?.error || '')] || 'A situação não pôde ser atualizada.');
    }
    return data as {ok: true;status: CancellationRequestStatus};
  },
};
