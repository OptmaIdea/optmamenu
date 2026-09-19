import { supabase } from '@/lib/supabase';

export interface ReassignFinancialAccountMovementsInput {
  storeId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  entryIds: string[];
  reason?: string | null;
}

export interface ReassignFinancialAccountMovementsResult {
  requestedCount: number;
  movedCount: number;
  neutralizedTransferCount: number;
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const FinancialAccountReassignmentService = {
  async reassignBulk(input: ReassignFinancialAccountMovementsInput): Promise<ReassignFinancialAccountMovementsResult> {
    const { data, error } = await supabase.rpc('reassign_financial_account_movements_bulk_safe', {
      p_store_id: input.storeId,
      p_source_account_id: input.sourceAccountId,
      p_destination_account_id: input.destinationAccountId,
      p_entry_ids: input.entryIds,
      p_reason: input.reason?.trim() || null,
    });

    if (error) throw error;
    if (!data?.ok) {
      const messages: Record<string, string> = {
        access_denied: 'Você não tem permissão para reatribuir lançamentos financeiros.',
        missing_parameters: 'Faltam dados para concluir a reatribuição.',
        same_account: 'Escolha uma conta de destino diferente da conta de origem.',
        empty_selection: 'Selecione ao menos um lançamento.',
        too_many_entries: 'Selecione no máximo 500 lançamentos por vez.',
        source_account_not_found: 'A conta de origem não foi encontrada.',
        invalid_destination_account: 'A conta de destino precisa existir e estar ativa.',
        selection_contains_invalid_entries: 'A seleção contém lançamento que não pertence mais à conta de origem ou não pode ser alterado.',
        destination_does_not_accept_all_payment_methods: 'A conta de destino não aceita todas as formas de pagamento presentes na seleção.',
      };
      throw new Error(messages[String(data?.error || '')] || data?.message || data?.error || 'Erro ao reatribuir lançamentos em lote.');
    }

    return {
      requestedCount: numberValue(data.requested_count),
      movedCount: numberValue(data.moved_count),
      neutralizedTransferCount: numberValue(data.neutralized_transfer_count),
    };
  },
};
