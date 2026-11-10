import { supabase } from '@/lib/supabase';

export interface StoreLoyaltyVoucher {
    id: string;
    code: string;
    status: 'active' | 'used' | 'expired';
    customer_name: string;
    customer_phone?: string | null;
    reward_title: string;
    reward_snapshot: Record<string, unknown>;
    points_cost: number;
    cash_due: number;
    created_at: string;
    expires_at: string;
    used_at?: string | null;
    redeemable: boolean;
    independent_fulfillment: boolean;
}

export const StoreLoyaltyVouchers = {
    async list(storeId: string, code: string | null = null): Promise<StoreLoyaltyVoucher[]> {
        const { data, error } = await supabase.rpc('get_admin_loyalty_vouchers_safe', {
            p_store_id: storeId,
            p_code: code,
            p_limit: 60,
        });
        if (error) throw error;
        if (!data?.ok) throw new Error('Não foi possível consultar os vouchers desta loja.');
        return (data.vouchers || []) as StoreLoyaltyVoucher[];
    },
    async markUsed(storeId: string, voucherId: string): Promise<void> {
        const { data, error } = await supabase.rpc('admin_use_loyalty_voucher_safe', {
            p_store_id: storeId,
            p_voucher_id: voucherId,
        });
        if (error) throw error;
        if (data?.ok) return;
        const messages: Record<string, string> = {
            access_denied: 'Você não tem permissão para validar o voucher.',
            voucher_not_found: 'Voucher não encontrado para esta loja.',
            voucher_already_used: 'Este voucher já foi utilizado.',
            voucher_expired: 'Este voucher está vencido ou indisponível.',
            fulfillment_integration_pending: 'Este tipo de prêmio exige integração financeira, de pedidos ou de estoque.',
        };
        throw new Error(messages[String(data?.error || '')] || 'Não foi possível confirmar o uso do voucher.');
    },
};
