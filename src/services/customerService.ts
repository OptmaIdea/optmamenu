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

type SelfRpcPayload = {
    ok?: boolean;
    error?: string;
    message?: string;
    [key: string]: unknown;
};

type SelfAddress = {
    id?: string;
    customer_id?: string;
    zip_code: string;
    street: string;
    number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
    is_default: boolean;
    created_at?: string;
};

type SelfAddressPatch = Partial<SelfAddress> & { customer_id?: string };

function selfServiceError(payload: SelfRpcPayload | null | undefined, fallback: string) {
    switch (payload?.error) {
        case 'access_denied':
            return new Error('Sua sessão de cliente expirou. Entre novamente.');
        case 'customer_not_found':
            return new Error('Não foi possível localizar seu cadastro.');
        case 'customer_not_editable':
            return new Error('Este cadastro não pode ser alterado neste momento.');
        case 'cpf_locked':
            return new Error('O CPF já confirmado não pode ser alterado por aqui.');
        case 'birth_date_locked':
            return new Error('A data de nascimento já confirmada não pode ser alterada por aqui.');
        case 'invalid_cpf':
            return new Error('Informe um CPF com 11 dígitos.');
        case 'invalid_address':
            return new Error('Confira CEP, rua, número, bairro, cidade e estado.');
        case 'address_limit_reached':
            return new Error('Você pode manter no máximo 3 endereços salvos.');
        case 'address_not_found':
            return new Error('Este endereço não foi encontrado na sua conta.');
        default:
            return new Error(payload?.message || fallback);
    }
}

function normalizeSelfAddress(item: Record<string, unknown>): SelfAddress {
    return {
        id: item.id ? String(item.id) : undefined,
        zip_code: String(item.zip_code ?? ''),
        street: String(item.street ?? ''),
        number: String(item.number ?? ''),
        complement: String(item.complement ?? ''),
        district: String(item.district ?? ''),
        city: String(item.city ?? ''),
        state: String(item.state ?? ''),
        is_default: Boolean(item.is_default),
        created_at: item.created_at ? String(item.created_at) : undefined,
    };
}

async function upsertSelfAddress(addressId: string | null, address: SelfAddressPatch) {
    const { data, error } = await supabaseCustomer.rpc('upsert_customer_self_address_safe', {
        p_address_id: addressId,
        p_zip_code: address.zip_code ?? null,
        p_street: address.street ?? null,
        p_number: address.number ?? null,
        p_complement: address.complement ?? null,
        p_district: address.district ?? null,
        p_city: address.city ?? null,
        p_state: address.state ?? null,
        p_is_default: Boolean(address.is_default),
    });

    if (error) throw new Error('Não foi possível salvar o endereço.');
    const payload = data as SelfRpcPayload | null;
    if (!payload?.ok) throw selfServiceError(payload, 'Não foi possível salvar o endereço.');
    return payload;
}

export const CustomerService = {
    // --- Profile Management ---
    // customerId é mantido apenas por compatibilidade com componentes antigos.
    // A autorização real vem exclusivamente do JWT da sessão do cliente.
    async updateProfile(
        _customerId: string,
        data: {
            full_name?: string;
            nickname?: string;
            cpf?: string;
            email?: string;
            birth_date?: string;
            phone?: string;
            is_whatsapp?: boolean;
            contact_preference?: 'whatsapp' | 'sms' | 'both';
            loyalty_opt_in?: boolean;
            marketing_consent?: boolean;
        },
    ) {
        const keys = Object.keys(data);
        const isConsentCompatibilityUpdate =
            keys.length > 0
            && keys.every((key) => key === 'loyalty_opt_in' || key === 'marketing_consent');

        // Consentimentos continuam no fluxo auditável próprio. O campo phone é
        // deliberadamente ignorado: troca de telefone exige OTP específico.
        if (isConsentCompatibilityUpdate) return true;

        const args: Record<string, unknown> = {};
        if ('full_name' in data) args.p_full_name = data.full_name ?? null;
        if ('nickname' in data) args.p_nickname = data.nickname ?? null;
        if ('email' in data) args.p_email = data.email ?? null;
        if ('cpf' in data) args.p_cpf = data.cpf ?? null;
        if ('birth_date' in data) args.p_birth_date = data.birth_date || null;
        if ('is_whatsapp' in data) args.p_is_whatsapp = data.is_whatsapp ?? null;
        if ('contact_preference' in data) args.p_contact_preference = data.contact_preference ?? null;
        if ('loyalty_opt_in' in data) args.p_loyalty_opt_in = data.loyalty_opt_in ?? null;

        const { data: result, error } = await supabaseCustomer.rpc(
            'update_customer_self_profile_safe',
            args,
        );

        if (error) {
            console.error('[CUSTOMER_SERVICE] Falha na RPC segura de perfil:', error);
            throw new Error('Não foi possível atualizar seus dados.');
        }

        const payload = result as SelfRpcPayload | null;
        if (!payload?.ok) throw selfServiceError(payload, 'Não foi possível atualizar seus dados.');
        return true;
    },

    async getSelfProfile() {
        const { data, error } = await supabaseCustomer.rpc('get_customer_self_profile_safe');
        if (error) throw new Error('Não foi possível carregar seus dados.');
        const payload = data as (SelfRpcPayload & { customer?: unknown }) | null;
        if (!payload?.ok) throw selfServiceError(payload, 'Não foi possível carregar seus dados.');
        return payload.customer ?? null;
    },

    // --- Address Management ---
    async getAddresses(_customerId?: string): Promise<SelfAddress[]> {
        const { data, error } = await supabaseCustomer.rpc('get_customer_self_addresses_safe');
        if (error) throw new Error('Não foi possível carregar seus endereços.');

        const payload = data as (SelfRpcPayload & { addresses?: Record<string, unknown>[] }) | null;
        if (!payload?.ok) throw selfServiceError(payload, 'Não foi possível carregar seus endereços.');
        return Array.isArray(payload.addresses)
            ? payload.addresses.map(normalizeSelfAddress)
            : [];
    },

    async addAddress(address: SelfAddressPatch) {
        const payload = await upsertSelfAddress(null, address);
        return { id: payload.address_id, ...address };
    },

    async updateAddress(id: string, address: SelfAddressPatch) {
        // Alguns componentes antigos enviam somente { is_default: true }.
        // A RPC segura valida o endereço completo, então mesclamos com o endereço
        // já pertencente à própria sessão antes de persistir.
        let completeAddress: SelfAddressPatch = address;
        const requiredFields = ['zip_code', 'street', 'number', 'district', 'city', 'state'] as const;
        if (requiredFields.some((field) => !String(address[field] ?? '').trim())) {
            const current = await this.getAddresses();
            const existing = current.find((item) => item.id === id);
            if (!existing) throw new Error('Este endereço não foi encontrado na sua conta.');
            completeAddress = { ...existing, ...address };
        }

        await upsertSelfAddress(id, completeAddress);
        return true;
    },

    async deleteAddress(addressId: string) {
        const { data, error } = await supabaseCustomer.rpc('delete_customer_self_address_safe', {
            p_address_id: addressId,
        });
        if (error) throw new Error('Não foi possível excluir o endereço.');
        const payload = data as SelfRpcPayload | null;
        if (!payload?.ok) throw selfServiceError(payload, 'Não foi possível excluir o endereço.');
    },

    // --- Notifications ---
    async getNotifications(_customerId?: string) {
        const { data, error } = await supabaseCustomer.rpc('get_customer_self_notifications_safe', {
            p_limit: 50,
        });
        if (error) {
            console.error('Erro ao buscar notificações:', error);
            return [];
        }

        const payload = data as (SelfRpcPayload & { notifications?: unknown[] }) | null;
        if (!payload?.ok) {
            console.error('Erro ao buscar notificações:', payload?.error);
            return [];
        }
        return Array.isArray(payload.notifications) ? payload.notifications : [];
    },

    // Criação de notificações continua sendo uma operação interna/backoffice.
    async addNotification(notification: {
        customer_id: string;
        store_id: string;
        title: string;
        message: string;
        type?: 'info' | 'success' | 'warning' | 'error';
    }) {
        const { error } = await supabase.from('customer_notifications').insert(notification);
        if (error) console.error('[CUSTOMER_SERVICE] ERRO em addNotification:', error);
    },

    async markAsRead(notificationId: string) {
        const { data, error } = await supabaseCustomer.rpc('mark_customer_self_notification_read_safe', {
            p_notification_id: notificationId,
            p_all: false,
        });
        if (error) {
            console.error('Erro ao marcar notificação como lida:', error);
            return;
        }
        const payload = data as SelfRpcPayload | null;
        if (!payload?.ok) console.error('Erro ao marcar notificação como lida:', payload?.error);
    },

    async markAllAsRead(_customerId?: string) {
        const { data, error } = await supabaseCustomer.rpc('mark_customer_self_notification_read_safe', {
            p_notification_id: null,
            p_all: true,
        });
        if (error) {
            console.error('Erro ao marcar todas as notificações como lidas:', error);
            return;
        }
        const payload = data as SelfRpcPayload | null;
        if (!payload?.ok) console.error('Erro ao marcar todas as notificações como lidas:', payload?.error);
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

    async logConsent(
        _customerId: string,
        consentType: CustomerConsentType,
        action: CustomerConsentAction,
    ) {
        return this.setSelfConsent(consentType, action === 'granted');
    },

    // --- Order History ---
    // Sem customerId do chamador na autorização. As policies customer_select_own
    // resolvem customer/store a partir do JWT e só devolvem os próprios pedidos.
    async getOrders(_customerId?: string) {
        const { data, error } = await supabaseCustomer
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
            .order('created_at', { ascending: false });

        if (error) throw new Error('Erro ao buscar pedidos.');
        return data || [];
    },
};
