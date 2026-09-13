import { supabase, supabaseCustomer } from '@/lib/supabase';

export type CustomerConsentType =
    | 'loyalty_program'
    | 'marketing_whatsapp'
    | 'marketing_email'
    | 'marketing_sms';

export type CustomerConsentAction = 'granted' | 'revoked';

export interface CustomerSelfConsentEvent {
    consent_type: string;
    action: CustomerConsentAction | string;
    terms_version?: string | null;
    privacy_version?: string | null;
    source?: string | null;
    created_at: string;
    revoked_at?: string | null;
}

export interface CustomerSelfConsentResult {
    ok: boolean;
    error?: string;
    message?: string;
    consent_type?: string;
    action?: CustomerConsentAction;
    marketing_consent?: boolean;
    loyalty_opt_in?: boolean;
}

export const CustomerService = {
    // --- Profile Management ---
    async updateProfile(
        customerId: string,
        data: {
            full_name?: string;
            cpf?: string;
            email?: string;
            birth_date?: string;
            phone?: string;
            loyalty_opt_in?: boolean;
            marketing_consent?: boolean;
        },
    ) {
        console.log(`[CUSTOMER_SERVICE] Atualizando perfil para ${customerId}:`, data);

        const keys = Object.keys(data);
        const isConsentCompatibilityUpdate =
            keys.length > 0
            && keys.every((key) => key === 'loyalty_opt_in' || key === 'marketing_consent');

        // Compatibilidade com componentes antigos: consentimentos são persistidos
        // exclusivamente por logConsent/setSelfConsent, que usam o JWT do cliente e
        // a RPC auditável. Evita a antiga atualização direta da tabela customers.
        if (isConsentCompatibilityUpdate) {
            return true;
        }

        const { error } = await supabase
            .from('customers')
            .update(data)
            .eq('id', customerId);

        if (error) {
            console.error('[CUSTOMER_SERVICE] ERRO em updateProfile:', error);
            if (error.code === '23505') {
                throw new Error('Este número de telefone já está em uso.');
            }
            throw new Error('Erro ao atualizar perfil.');
        }

        console.log(`[CUSTOMER_SERVICE] Perfil atualizado com sucesso para ${customerId}`);
        return true;
    },

    // --- Address Management ---
    async getAddresses(customerId: string) {
        const { data, error } = await supabase
            .from('customer_addresses')
            .select('*')
            .eq('customer_id', customerId)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw new Error('Erro ao buscar endereços.');
        return data || [];
    },

    async addAddress(address: any) {
        if (address.is_default) {
            await supabase
                .from('customer_addresses')
                .update({ is_default: false })
                .eq('customer_id', address.customer_id);
        }

        const { data, error } = await supabase
            .from('customer_addresses')
            .insert(address)
            .select()
            .maybeSingle();

        if (error) throw new Error('Erro ao adicionar endereço.');
        return data;
    },

    async updateAddress(id: string, address: any) {
        if (address.is_default) {
            await supabase
                .from('customer_addresses')
                .update({ is_default: false })
                .eq('customer_id', address.customer_id);
        }

        const { error } = await supabase
            .from('customer_addresses')
            .update(address)
            .eq('id', id);

        if (error) throw new Error('Erro ao atualizar endereço.');
        return true;
    },

    async deleteAddress(addressId: string) {
        const { error } = await supabase.from('customer_addresses').delete().eq('id', addressId);
        if (error) throw error;
    },

    // --- Notifications ---
    async getNotifications(customerId: string) {
        const { data, error } = await supabase
            .from('customer_notifications')
            .select('*')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao buscar notificações:', error);
            return [];
        }
        return data;
    },

    async addNotification(notification: {
        customer_id: string;
        store_id: string;
        title: string;
        message: string;
        type?: 'info' | 'success' | 'warning' | 'error';
    }) {
        console.log(`[CUSTOMER_SERVICE] Adicionando notificação para ${notification.customer_id}:`, notification.title);
        const { error } = await supabase
            .from('customer_notifications')
            .insert(notification);

        if (error) {
            console.error('[CUSTOMER_SERVICE] ERRO em addNotification:', error);
        } else {
            console.log(`[CUSTOMER_SERVICE] Notificação criada para ${notification.customer_id}`);
        }
    },

    async markAsRead(notificationId: string) {
        const { error } = await supabase
            .from('customer_notifications')
            .update({ read: true })
            .eq('id', notificationId);
        if (error) console.error('Erro ao marcar notificação como lida:', error);
    },

    async markAllAsRead(customerId: string) {
        const { error } = await supabase
            .from('customer_notifications')
            .update({ read: true })
            .eq('customer_id', customerId)
            .eq('read', false);
        if (error) console.error('Erro ao marcar todas as notificações como lidas:', error);
    },

    // --- Consentimentos do próprio cliente ---
    async getSelfConsents(): Promise<CustomerSelfConsentEvent[]> {
        const { data, error } = await supabaseCustomer.rpc('get_customer_self_consents_safe');
        if (error) throw error;

        const payload = data as { ok?: boolean; error?: string; consents?: CustomerSelfConsentEvent[] } | null;
        if (!payload?.ok) {
            throw new Error(payload?.error === 'access_denied'
                ? 'Sua sessão de cliente expirou. Entre novamente.'
                : 'Não foi possível carregar seus consentimentos.');
        }

        return Array.isArray(payload.consents) ? payload.consents : [];
    },

    async setSelfConsent(
        consentType: CustomerConsentType,
        granted: boolean,
        options: {
            termsVersion?: string | null;
            privacyVersion?: string | null;
            source?: string;
        } = {},
    ): Promise<CustomerSelfConsentResult> {
        const { data, error } = await supabaseCustomer.rpc('set_customer_self_consent_safe', {
            p_consent_type: consentType,
            p_granted: granted,
            p_terms_version: options.termsVersion ?? null,
            p_privacy_version: options.privacyVersion ?? null,
            p_source: options.source || 'customer_portal',
        });

        if (error) throw error;

        const payload = data as CustomerSelfConsentResult | null;
        if (!payload?.ok) {
            throw new Error(
                payload?.message
                || (payload?.error === 'access_denied'
                    ? 'Sua sessão de cliente expirou. Entre novamente.'
                    : 'Não foi possível atualizar sua preferência.'),
            );
        }

        return payload;
    },

    // Mantido por compatibilidade com componentes existentes. O customerId não
    // é usado para autorização: a identidade válida sempre vem do JWT do cliente.
    async logConsent(
        _customerId: string,
        consentType: CustomerConsentType,
        action: CustomerConsentAction,
    ) {
        return this.setSelfConsent(consentType, action === 'granted');
    },

    // --- Order History ---
    async getOrders(customerId: string) {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (
                    id,
                    quantity,
                    unit_price,
                    product:products (name)
                )
            `)
            .or(`customer_id.eq.${customerId}`)
            .order('created_at', { ascending: false });

        if (error) throw new Error('Erro ao buscar pedidos.');
        return data || [];
    },
};
