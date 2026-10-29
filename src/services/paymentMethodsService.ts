import { supabase } from '@/lib/supabase';

export type BasePaymentMethodCode =
    | 'pending'
    | 'cash'
    | 'pix'
    | 'debit_card'
    | 'credit_card'
    | 'bank_transfer'
    | 'voucher'
    | 'other';

export type PaymentMethodCode = string;

export interface StorePaymentMethod {
    id: string;
    store_id: string;
    code: PaymentMethodCode;
    base_code: BasePaymentMethodCode;
    name: string;
    description?: string | null;
    active: boolean;
    public_enabled: boolean;
    sort_order: number;
    icon?: string | null;
    color?: string | null;
    requires_proof: boolean;
    requires_change_for: boolean;
    affects_cashbook: boolean;
    preferred_financial_account_id?: string | null;
    preferred_financial_account_name?: string | null;
    is_custom_variant?: boolean;
    metadata: Record<string, unknown>;
    created_at?: string;
    updated_at?: string;
}

export interface UpdatePaymentMethodInput {
    id: string;
    name?: string;
    description?: string | null;
    active?: boolean;
    public_enabled?: boolean;
    sort_order?: number;
    requires_proof?: boolean;
    requires_change_for?: boolean;
    affects_cashbook?: boolean;
    metadata?: Record<string, unknown>;
}

export interface SavePaymentMethodVariantInput {
    storeId: string;
    methodId?: string | null;
    name: string;
    baseCode: Exclude<BasePaymentMethodCode, 'pending'>;
    code?: string | null;
    description?: string | null;
    preferredFinancialAccountId?: string | null;
    active?: boolean;
    publicEnabled?: boolean;
    requiresProof?: boolean;
    requiresChangeFor?: boolean;
    affectsCashbook?: boolean;
    sortOrder?: number;
}

function normalizeMethod(method: Record<string, unknown>): StorePaymentMethod {
    const code = String(method.code || 'other');
    const baseCode = String(method.base_code || code) as BasePaymentMethodCode;
    return {
        ...(method as unknown as StorePaymentMethod),
        code,
        base_code: baseCode,
        is_custom_variant: typeof method.is_custom_variant === 'boolean' ? method.is_custom_variant : code !== baseCode,
        preferred_financial_account_id: typeof method.preferred_financial_account_id === 'string'
            ? method.preferred_financial_account_id
            : null,
        preferred_financial_account_name: typeof method.preferred_financial_account_name === 'string'
            ? method.preferred_financial_account_name
            : null,
        metadata: (method.metadata && typeof method.metadata === 'object' ? method.metadata : {}) as Record<string, unknown>,
    };
}

export const PaymentMethodsService = {
    async listByStore(storeId: string): Promise<StorePaymentMethod[]> {
        const { data, error } = await supabase.rpc('list_store_payment_methods_with_routing_safe', {
            p_store_id: storeId,
        });

        if (error) throw error;
        if (!data?.ok) throw new Error(data?.message || data?.error || 'Erro ao carregar formas de pagamento.');

        return ((data.items || []) as Array<Record<string, unknown>>).map(normalizeMethod);
    },

    async listCheckoutPrepaymentDestinations(storeId: string): Promise<Record<string,string>> {
        const { data, error } = await supabase.from('store_order_payment_account_routes')
            .select('payment_method_code,destination_financial_account_id')
            .eq('store_id',storeId)
            .eq('scope','public_store')
            .eq('fulfillment_type','pickup')
            .eq('payment_timing','advance')
            .eq('active',true);
        if (error) throw error;
        return Object.fromEntries((data || [])
            .filter((item) => item.destination_financial_account_id)
            .map((item) => [item.payment_method_code, item.destination_financial_account_id as string]));
    },

    async configureCheckoutPrepayment(input: {
        storeId: string;
        methodCode: string;
        enabled: boolean;
        destinationAccountId: string | null;
    }): Promise<void> {
        const { data, error } = await supabase.rpc('configure_store_checkout_prepayment_safe', {
            p_store_id: input.storeId,
            p_method_code: input.methodCode,
            p_enabled: input.enabled,
            p_destination_account_id: input.destinationAccountId,
        });
        if (error) throw error;
        if (!data?.ok) {
            const descriptions: Record<string,string> = {
                access_denied: 'Apenas o proprietário ou um administrador autorizado pode configurar antecipações.',
                unsupported_method: 'Esta forma de pagamento ainda não possui fluxo de antecipação homologado.',
                payment_method_not_found: 'Forma de pagamento não encontrada para esta loja.',
                invalid_destination_account: 'Selecione uma conta de recebimento ativa desta loja.',
                manual_proof_not_configured: 'PIX manual exige envio e conferência de comprovante antes de confirmar o pagamento.',
                provider_capability_unavailable: 'Este tipo de cobrança online não está liberado pela integração da loja. Para receber antecipadamente sem provedor, utilize PIX manual com comprovante.',
            };
            throw new Error(descriptions[data?.error] || data?.message || data?.error || 'Não foi possível configurar o checkout.');
        }
    },

    async update(input: UpdatePaymentMethodInput): Promise<StorePaymentMethod> {
        const { id, ...patch } = input;
        const { data, error } = await supabase
            .from('store_payment_methods')
            .update(patch)
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;
        return normalizeMethod(data as Record<string, unknown>);
    },

    async saveVariant(input: SavePaymentMethodVariantInput): Promise<StorePaymentMethod> {
        const { data, error } = await supabase.rpc('upsert_store_payment_method_variant_safe', {
            p_store_id: input.storeId,
            p_method_id: input.methodId || null,
            p_name: input.name.trim(),
            p_base_code: input.baseCode,
            p_code: input.code?.trim() || null,
            p_description: input.description?.trim() || null,
            p_preferred_financial_account_id: input.preferredFinancialAccountId || null,
            p_active: input.active ?? true,
            p_public_enabled: input.publicEnabled ?? false,
            p_requires_proof: input.requiresProof ?? false,
            p_requires_change_for: input.requiresChangeFor ?? false,
            p_affects_cashbook: input.affectsCashbook ?? true,
            p_sort_order: input.sortOrder ?? 500,
        });

        if (error) throw error;
        if (!data?.ok) {
            const messages: Record<string, string> = {
                access_denied: 'Você não tem permissão para criar ou editar formas específicas de pagamento.',
                invalid_base_code: 'Selecione um tipo-base válido.',
                invalid_preferred_financial_account: 'A conta financeira vinculada é inválida ou está inativa.',
                invalid_code: 'Não foi possível gerar um código interno válido para esta forma.',
                payment_method_not_found: 'A forma de pagamento não foi encontrada.',
            };
            throw new Error(messages[data?.error] || data?.message || data?.error || 'Erro ao salvar forma específica de pagamento.');
        }

        return normalizeMethod(data.method as Record<string, unknown>);
    },
};
