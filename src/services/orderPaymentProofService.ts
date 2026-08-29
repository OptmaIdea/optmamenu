import { supabase } from '@/lib/supabase';

export type OrderPaymentProofStatus = 'upload_pending' | 'submitted' | 'confirmed' | 'rejected' | 'superseded' | 'expired';

export interface OrderPaymentProof {
  id: string;
  status: OrderPaymentProofStatus;
  storage_bucket: string;
  storage_path: string;
  original_file_name?: string | null;
  content_type: string;
  declared_amount?: number | null;
  declared_paid_at?: string | null;
  submitted_at?: string | null;
  decided_at?: string | null;
  decided_by?: string | null;
  decision_source?: string | null;
  decision_notes?: string | null;
  cashbook_entry_id?: string | null;
  financial_account_id?: string | null;
  created_at: string;
  signedUrl?: string | null;
}

export interface OrderPaymentProofResult {
  canReview: boolean;
  proofs: OrderPaymentProof[];
}

function reviewError(code?: string) {
  const messages: Record<string, string> = {
    access_denied: 'Você não tem permissão para conferir comprovantes.',
    proof_not_found: 'Comprovante não encontrado.',
    proof_not_submitted: 'Este comprovante não está aguardando conferência.',
    rejection_reason_required: 'Informe o motivo da rejeição.',
    order_not_eligible: 'Este pedido não pode mais receber confirmação antecipada.',
    payment_already_confirmed: 'O pagamento deste pedido já foi confirmado.',
    not_pix_order: 'O pedido não está configurado para pagamento PIX.',
    financial_account_required: 'Selecione uma conta financeira para receber o PIX.',
    invalid_financial_account: 'A conta financeira selecionada não pertence à loja.',
    financial_account_inactive: 'Selecione uma conta financeira ativa.',
    account_does_not_accept_pix: 'A conta selecionada não aceita PIX.',
    financial_entry_already_exists: 'Este pedido já possui um recebimento financeiro confirmado.',
    order_not_found: 'Pedido não encontrado.',
  };
  return new Error(messages[code || ''] || code || 'Não foi possível revisar o comprovante.');
}

export const OrderPaymentProofService = {
  async getForOrder(storeId: string, orderId: string): Promise<OrderPaymentProofResult> {
    const { data, error } = await supabase.rpc('get_order_payment_proofs_safe', {
      p_store_id: storeId,
      p_order_id: orderId,
    });
    if (error) throw error;
    if (!data?.ok) throw reviewError(data?.error);

    const proofs = ((data.proofs || []) as Array<Record<string, unknown>>).map((proof) => ({
      ...proof,
      id: String(proof.id || ''),
      status: String(proof.status || 'expired') as OrderPaymentProofStatus,
      storage_bucket: String(proof.storage_bucket || ''),
      storage_path: String(proof.storage_path || ''),
      content_type: String(proof.content_type || ''),
      declared_amount: proof.declared_amount == null ? null : Number(proof.declared_amount),
      created_at: String(proof.created_at || ''),
    })) as OrderPaymentProof[];

    const withUrls = await Promise.all(proofs.map(async (proof) => {
      if (!proof.storage_bucket || !proof.storage_path || proof.status === 'upload_pending') return proof;
      const { data: signed, error: signedError } = await supabase.storage
        .from(proof.storage_bucket)
        .createSignedUrl(proof.storage_path, 600);
      if (signedError) return { ...proof, signedUrl: null };
      return { ...proof, signedUrl: signed.signedUrl };
    }));

    return { canReview: Boolean(data.can_review), proofs: withUrls };
  },

  async review(params: {
    storeId: string;
    proofId: string;
    decision: 'confirm' | 'reject';
    financialAccountId?: string | null;
    notes?: string | null;
  }): Promise<Record<string, unknown>> {
    const { data, error } = await supabase.rpc('review_order_payment_proof_safe', {
      p_store_id: params.storeId,
      p_proof_id: params.proofId,
      p_decision: params.decision,
      p_financial_account_id: params.financialAccountId || null,
      p_notes: params.notes?.trim() || null,
    });
    if (error) throw error;
    if (!data?.ok) throw reviewError(data?.error);
    return data as Record<string, unknown>;
  },

  async confirmExternalPixPayment(params: {
    storeId: string;
    orderId: string;
    financialAccountId?: string | null;
    notes?: string | null;
  }): Promise<Record<string, unknown>> {
    const { data, error } = await supabase.rpc('confirm_order_external_pix_payment_safe', {
      p_store_id: params.storeId,
      p_order_id: params.orderId,
      p_financial_account_id: params.financialAccountId || null,
      p_notes: params.notes?.trim() || null,
    });
    if (error) throw error;
    if (!data?.ok) throw reviewError(data?.error);
    return data as Record<string, unknown>;
  },
};
