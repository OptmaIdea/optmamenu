import { supabaseCustomer, supabasePublic } from '@/lib/supabase';

export type PublicFulfillmentType = 'pickup' | 'delivery' | 'qr_table' | 'dine_in' | 'other';
export type PublicOrderFulfillmentInput = PublicFulfillmentType | 'table';

export type PublicSalesChannel =
    | 'whatsapp'
    | 'public_store'
    | 'qr_table'
    | 'direct'
    | 'phone'
    | 'in_person'
    | 'other';

export type PublicPaymentTiming = 'pay_now' | 'pay_on_fulfillment';
export type PublicPromisedPaymentMethod = 'pix' | 'card' | 'cash';

export interface PublicCheckoutPayNowMethod {
    code: string;
    base_code: string;
    name: string;
    description?: string | null;
    requires_proof: boolean;
    confirmation_mode: 'manual_proof' | 'api' | string;
    integration_enabled: boolean;
}

export interface PublicCheckoutPayOnFulfillmentMethod {
    code: PublicPromisedPaymentMethod;
    name: string;
    requires_change_for: boolean;
}

export interface PublicCheckoutPaymentOptionsResponse {
    ok: boolean;
    error?: string;
    fulfillment_type?: PublicFulfillmentType;
    pay_now: PublicCheckoutPayNowMethod[];
    pay_on_fulfillment: {
        enabled: boolean;
        label: string;
        requires_method_choice: boolean;
        methods: PublicCheckoutPayOnFulfillmentMethod[];
    };
}

export interface PublicPaymentSelectionInput {
    timing: PublicPaymentTiming;
    method_code?: string | null;
    promised_method_code?: PublicPromisedPaymentMethod | null;
    change_for?: number | null;
}

export interface PublicOrderItemInput {
    product_id: string;
    quantity: number;
}

export interface PublicDeliveryAddressInput {
    street?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    reference?: string;
}

export interface CreatePublicOrderInput {
    slug: string;
    customer_name: string;
    customer_phone: string;
    fulfillment_type: PublicOrderFulfillmentInput;
    sales_channel: PublicSalesChannel;
    payment_method_code?: string;
    payment_selection?: PublicPaymentSelectionInput;
    delivery_method_code?: string;
    items: PublicOrderItemInput[];
    delivery_address?: PublicDeliveryAddressInput;
    table_code?: string | null;
    notes?: string | null;
}

export interface PublicOrderPricingItem {
    product_id: string;
    product_name: string;
    category_id?: string | null;
    category_name?: string | null;
    quantity: number;
    pricing_quantity: number;
    base_price: number;
    unit_price: number;
    discount_total: number;
    line_total: number;
    pricing_source:
        | 'category_combined_volume'
        | 'category_standard'
        | 'product_volume'
        | 'product_standard'
        | 'product_base_price';
    applied_tier?: {
        min: number;
        price: number;
    } | null;
}

export interface PublicOrderPricingResponse {
    ok: boolean;
    error?: string;
    items?: PublicOrderPricingItem[];
    subtotal?: number;
    base_subtotal?: number;
    total_discount?: number;
}

export interface CreatePublicOrderResponse {
    ok: boolean;
    error?: string;
    message?: string;
    minimum_order_value?: number;
    current_total?: number;
    product_id?: string;
    product_name?: string;
    pricing?: PublicOrderPricingResponse;
    order?: {
        id: string;
        order_code: string;
        subtotal?: number;
        delivery_fee?: number;
        total: number;
        status: string;
        sales_channel: PublicSalesChannel;
        fulfillment_type: PublicFulfillmentType;
        delivery_method_code?: string;
        delivery_method_name?: string;
        payment_method_code?: string;
        payment_timing?: PublicPaymentTiming;
        promised_payment_method_code?: PublicPromisedPaymentMethod | null;
        payment_confirmation_mode?: string;
        requires_proof?: boolean;
        expires_at: string;
        reservation_minutes: number;
        public_order_token: string;
    };
    whatsapp?: {
        digits?: string;
        message?: string;
        url?: string;
    };
}

export interface PublicOrderTrackingItem {
    name: string;
    quantity: number;
    unit_price: number;
    discount: number;
    line_total: number;
}

export interface PublicOrderTrackingResponse {
    ok: boolean;
    error?: string;
    store?: {
        name: string;
        slug: string;
        logo_url?: string | null;
    };
    order?: {
        order_code: string;
        status: string;
        customer_name?: string | null;
        subtotal: number;
        delivery_fee: number;
        total: number;
        sales_channel: string;
        fulfillment_type: string;
        delivery_method_name?: string | null;
        payment_method_name?: string | null;
        table_code?: string | null;
        created_at: string;
        confirmed_at?: string | null;
        completed_at?: string | null;
        expires_at?: string | null;
        items: PublicOrderTrackingItem[];
    };
}

export type PublicPaymentProofStatus = 'submitted' | 'confirmed' | 'rejected' | 'superseded' | 'expired';

export interface PublicPaymentProofSummary {
    id: string;
    status: PublicPaymentProofStatus;
    original_file_name?: string | null;
    declared_amount?: number | null;
    declared_paid_at?: string | null;
    submitted_at?: string | null;
    decided_at?: string | null;
    decision_notes?: string | null;
}

export interface PublicPaymentProofState {
    ok: boolean;
    error?: string;
    eligible: boolean;
    order_code?: string;
    order_status?: string;
    payment_status?: string;
    payment_method_code?: string | null;
    payment_method_name?: string | null;
    requires_proof?: boolean;
    order_total?: number;
    proofs: PublicPaymentProofSummary[];
}

interface PublicPaymentProofTicket {
    ok: boolean;
    error?: string;
    proof_id?: string;
    storage_bucket?: string;
    storage_path?: string;
    upload_expires_at?: string;
    max_file_size?: number;
    allowed_content_types?: string[];
}

const PROOF_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const PROOF_MAX_SIZE = 8 * 1024 * 1024;

function proofError(code?: string) {
    const messages: Record<string, string> = {
        invalid_token: 'O link deste pedido não é válido para envio de comprovante.',
        order_not_found: 'Pedido não encontrado.',
        order_not_eligible: 'Este pedido não aceita mais comprovante de pagamento.',
        payment_already_confirmed: 'O pagamento deste pedido já foi confirmado.',
        not_pix_order: 'Este pedido não está configurado para pagamento por PIX.',
        proof_not_required: 'Esta forma de pagamento é confirmada automaticamente e não aceita envio manual de comprovante.',
        invalid_content_type: 'Envie uma imagem JPG, PNG, WebP ou um arquivo PDF.',
        invalid_declared_amount: 'Informe um valor de pagamento válido.',
        invalid_declared_paid_at: 'A data/hora informada para o pagamento não é válida.',
        too_many_proof_attempts: 'Houve muitas tentativas de envio. Aguarde um pouco antes de tentar novamente.',
        upload_ticket_expired: 'O prazo deste envio expirou. Selecione o arquivo novamente.',
        proof_file_not_found: 'O arquivo não foi recebido. Tente enviar novamente.',
    };
    return new Error(messages[code || ''] || code || 'Não foi possível enviar o comprovante.');
}

export const PublicOrderService = {
    async getCheckoutPaymentOptions(
        slug: string,
        fulfillmentType: PublicOrderFulfillmentInput,
    ): Promise<PublicCheckoutPaymentOptionsResponse> {
        const normalizedFulfillmentType: PublicFulfillmentType = fulfillmentType === 'table'
            ? 'qr_table'
            : fulfillmentType;

        const { data, error } = await supabasePublic.rpc('get_public_checkout_payment_options_by_slug', {
            p_slug: slug,
            p_fulfillment_type: normalizedFulfillmentType,
        });

        if (error) throw error;
        if (!data?.ok) {
            return {
                ok: false,
                error: data?.error || 'payment_options_unavailable',
                pay_now: [],
                pay_on_fulfillment: {
                    enabled: false,
                    label: normalizedFulfillmentType === 'delivery' ? 'Pagar na entrega' : 'Pagar na retirada',
                    requires_method_choice: normalizedFulfillmentType === 'delivery',
                    methods: [],
                },
            };
        }

        return {
            ...(data as PublicCheckoutPaymentOptionsResponse),
            pay_now: Array.isArray(data.pay_now) ? data.pay_now : [],
            pay_on_fulfillment: {
                enabled: Boolean(data.pay_on_fulfillment?.enabled),
                label: String(data.pay_on_fulfillment?.label || (normalizedFulfillmentType === 'delivery' ? 'Pagar na entrega' : 'Pagar na retirada')),
                requires_method_choice: Boolean(data.pay_on_fulfillment?.requires_method_choice),
                methods: Array.isArray(data.pay_on_fulfillment?.methods) ? data.pay_on_fulfillment.methods : [],
            },
        };
    },

    async getPublicOrderByToken(token: string): Promise<PublicOrderTrackingResponse> {
        const normalizedToken = decodeURIComponent(token).trim();
        const { data, error } = await supabasePublic.rpc('get_public_order_by_token', {
            p_token: normalizedToken,
        });

        if (error) {
            console.error('get_public_order_by_token error:', {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint,
            });
            throw error;
        }

        return data as PublicOrderTrackingResponse;
    },

    async getPaymentProofState(token: string): Promise<PublicPaymentProofState> {
        const normalizedToken = decodeURIComponent(token).trim();
        const { data, error } = await supabasePublic.rpc('get_public_order_payment_proof_state', {
            p_token: normalizedToken,
        });
        if (error) throw error;
        if (!data?.ok) throw proofError(data?.error);
        return {
            ...(data as PublicPaymentProofState),
            order_total: Number(data.order_total || 0),
            proofs: Array.isArray(data.proofs)
                ? data.proofs.map((proof: PublicPaymentProofSummary) => ({
                    ...proof,
                    declared_amount: proof.declared_amount == null ? null : Number(proof.declared_amount),
                }))
                : [],
        };
    },

    async submitPaymentProof(params: {
        token: string;
        file: File;
        declaredAmount?: number | null;
        declaredPaidAt?: string | null;
    }): Promise<{ proofId: string; status: string }> {
        const { token, file } = params;
        if (!PROOF_ALLOWED_TYPES.includes(file.type)) throw proofError('invalid_content_type');
        if (file.size <= 0 || file.size > PROOF_MAX_SIZE) {
            throw new Error('O comprovante deve ter no máximo 8 MB.');
        }

        const normalizedToken = decodeURIComponent(token).trim();
        const declaredPaidAt = params.declaredPaidAt?.trim()
            ? new Date(params.declaredPaidAt).toISOString()
            : null;

        const { data: ticketData, error: ticketError } = await supabasePublic.rpc(
            'create_public_order_payment_proof_ticket',
            {
                p_token: normalizedToken,
                p_file_name: file.name,
                p_content_type: file.type,
                p_declared_amount: params.declaredAmount ?? null,
                p_declared_paid_at: declaredPaidAt,
            },
        );
        if (ticketError) throw ticketError;

        const ticket = ticketData as PublicPaymentProofTicket;
        if (!ticket?.ok || !ticket.proof_id || !ticket.storage_bucket || !ticket.storage_path) {
            throw proofError(ticket?.error);
        }

        const { error: uploadError } = await supabasePublic.storage
            .from(ticket.storage_bucket)
            .upload(ticket.storage_path, file, {
                contentType: file.type,
                upsert: false,
                cacheControl: '0',
            });
        if (uploadError) throw new Error(`Não foi possível enviar o arquivo: ${uploadError.message}`);

        const { data: finalizeData, error: finalizeError } = await supabasePublic.rpc(
            'finalize_public_order_payment_proof',
            { p_token: normalizedToken, p_proof_id: ticket.proof_id },
        );
        if (finalizeError) throw finalizeError;
        if (!finalizeData?.ok) throw proofError(finalizeData?.error);

        return { proofId: ticket.proof_id, status: String(finalizeData.status || 'submitted') };
    },

    async quotePublicOrder(slug: string, items: PublicOrderItemInput[]): Promise<PublicOrderPricingResponse> {
        const { data, error } = await supabasePublic.rpc('quote_public_order_by_slug', {
            p_slug: slug,
            p_items: items,
        });

        if (error) {
            console.error('quote_public_order_by_slug error:', error);
            throw error;
        }

        return data as PublicOrderPricingResponse;
    },

    async createPublicOrder(input: CreatePublicOrderInput): Promise<CreatePublicOrderResponse> {
        const normalizedFulfillmentType: PublicFulfillmentType = input.fulfillment_type === 'table'
            ? 'qr_table'
            : input.fulfillment_type;

        const fallbackSelection: PublicPaymentSelectionInput = input.payment_method_code && input.payment_method_code !== 'pending'
            ? {
                timing: 'pay_now',
                method_code: input.payment_method_code,
            }
            : {
                timing: 'pay_on_fulfillment',
            };

        const { data, error } = await supabaseCustomer.rpc('create_public_order_by_slug_v3', {
            p_slug: input.slug,
            p_customer_name: input.customer_name,
            p_customer_phone: input.customer_phone,
            p_fulfillment_type: normalizedFulfillmentType,
            p_sales_channel: input.sales_channel,
            p_items: input.items,
            p_delivery_address: input.delivery_address || {},
            p_table_code: input.table_code || null,
            p_notes: input.notes || null,
            p_payment_selection: input.payment_selection || fallbackSelection,
            p_delivery_method_code: input.delivery_method_code || null,
        });

        if (error) {
            console.error('create_public_order_by_slug_v3 error:', error);
            throw error;
        }

        return data as CreatePublicOrderResponse;
    },
};
