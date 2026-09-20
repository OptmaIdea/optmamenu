import { supabase, supabaseCustomer } from '@/lib/supabase';
import { getCustomerToken } from '@/lib/jwt';
import type { Order } from '@/types';

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
    unchanged?: boolean;
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
        case 'invalid_email':
            return new Error('Informe um e-mail válido.');
        case 'invalid_birth_date':
            return new Error('Informe uma data de nascimento válida.');
        case 'email_verification_required':
            return new Error('Confirme seu e-mail com a loja antes de continuar.');
        case 'loyalty_data_responsibility_required':
            return new Error('Confirme a responsabilidade pelas informações fornecidas antes de aderir ao programa.');
        case 'loyalty_age_restricted':
            return new Error('O programa de fidelidade desta loja é destinado apenas a clientes com 18 anos ou mais.');
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
        if (!payload?.ok) console.error('Erro ao marcar todas as notificações como lida:', payload?.error);
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

    // --- Loyalty self-service ---
    async getSelfLoyaltyTransactions(limit = 100) {
        const { data, error } = await supabaseCustomer.rpc(
            'get_customer_self_loyalty_transactions_safe',
            { p_limit: limit },
        );
        if (error) throw new Error('Não foi possível carregar o extrato de pontos.');
        const payload = data as (SelfRpcPayload & { transactions?: unknown[] }) | null;
        if (!payload?.ok) throw selfServiceError(payload, 'Não foi possível carregar o extrato de pontos.');
        return Array.isArray(payload.transactions) ? payload.transactions : [];
    },

    async getSelfLoyaltyProgram() {
        const { data, error } = await supabaseCustomer.rpc('get_customer_self_loyalty_program_safe');
        if (error) throw new Error('Não foi possível carregar as regras do programa de fidelidade.');
        const payload = data as (SelfRpcPayload & {
            membership_blocked?: boolean;
            block_reason?: string | null;
            program?: Record<string, unknown> | null;
        }) | null;
        if (!payload?.ok) throw selfServiceError(payload, 'Não foi possível carregar as regras do programa de fidelidade.');
        return {
            membershipBlocked: Boolean(payload.membership_blocked),
            blockReason: payload.block_reason ? String(payload.block_reason) : null,
            program: payload.program && typeof payload.program === 'object' ? payload.program : null,
        };
    },

    async leaveSelfLoyalty() {
        const { data, error } = await supabaseCustomer.rpc('leave_customer_self_loyalty_safe');
        if (error) throw new Error('Não foi possível encerrar sua participação no programa.');
        const payload = data as SelfRpcPayload | null;
        if (!payload?.ok) throw selfServiceError(payload, 'Não foi possível encerrar sua participação no programa.');
        return payload;
    },

    async joinSelfLoyalty(options: {
        acceptTerms: boolean;
        dataResponsibility: boolean;
        marketingWhatsapp: boolean;
        marketingEmail: boolean;
        marketingSms: boolean;
    }) {
        const { data, error } = await supabaseCustomer.rpc('join_customer_self_loyalty_safe', {
            p_accept_terms: options.acceptTerms,
            p_data_responsibility: options.dataResponsibility,
            p_marketing_whatsapp: options.marketingWhatsapp,
            p_marketing_email: options.marketingEmail,
            p_marketing_sms: options.marketingSms,
        });

        if (error) throw new Error('Não foi possível concluir sua adesão ao programa.');
        const payload = data as SelfRpcPayload | null;
        if (!payload?.ok) throw selfServiceError(payload, 'Não foi possível concluir sua adesão ao programa.');
        return payload;
    },

    async requestSelfEmailVerification() {
        const tryVercelFallback = async () => {
            const token = getCustomerToken();
            if (!token) throw new Error('Sua sessão expirou. Entre novamente para confirmar o e-mail.');

            const response = await fetch('/api/customer-email-verification', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: '{}',
            });

            const text = await response.text();
            let payload: {
                ok?: boolean;
                error?: string;
                alreadyVerified?: boolean;
                email?: string;
                expiresAt?: string;
                storeName?: string;
                providerKeyDetected?: boolean;
                senderDetected?: boolean;
                runtime?: string;
                providerStatus?: number;
                providerCode?: string | null;
                providerMessage?: string | null;
            } | null = null;
            try {
                payload = text ? JSON.parse(text) : null;
            } catch {
                payload = null;
            }

            if (response.ok && payload?.ok) return payload;

            if (payload?.error === 'email_provider_not_configured') {
                if (payload.providerKeyDetected === false && payload.senderDetected === false) {
                    throw new Error('A confirmação de e-mail não encontrou chave de provedor nem remetente no runtime da Vercel.');
                }
                if (payload.providerKeyDetected === false) {
                    throw new Error('A confirmação de e-mail não encontrou a chave do provedor no runtime da Vercel.');
                }
                if (payload.senderDetected === false) {
                    throw new Error('A confirmação de e-mail encontrou o provedor na Vercel, mas não encontrou o remetente.');
                }
            }

            if (payload?.error === 'email_delivery_failed' && payload.providerMessage) {
                const detail = payload.providerCode
                    ? `${payload.providerCode}: ${payload.providerMessage}`
                    : payload.providerMessage;
                throw new Error(`O serviço de e-mail recusou o envio: ${detail}`);
            }

            const labels: Record<string, string> = {
                vercel_supabase_not_configured: 'A função de e-mail da Vercel não encontrou a configuração do Supabase.',
                valid_email_required: 'Cadastre e salve um e-mail válido antes de solicitar a confirmação.',
                rate_limited: 'Aguarde um pouco antes de solicitar outro e-mail de confirmação.',
                email_delivery_failed: 'A loja não conseguiu entregar o e-mail de confirmação agora.',
                access_denied: 'Sua sessão expirou. Entre novamente para confirmar o e-mail.',
            };
            throw new Error(labels[payload?.error || ''] || 'Não foi possível enviar a confirmação de e-mail pela Vercel.');
        };

        // Vercel é o caminho primário para e-mail transacional nesta instalação.
        // A Edge Function do Supabase fica como contingência quando o runtime Vercel
        // não possui a configuração necessária.
        try {
            return await tryVercelFallback();
        } catch (vercelError) {
            const message = vercelError instanceof Error ? vercelError.message : '';
            const configurationUnavailable =
                message.includes('não encontrou chave de provedor')
                || message.includes('não encontrou a chave do provedor')
                || message.includes('não encontrou o remetente')
                || message.includes('não encontrou a configuração do Supabase');

            if (!configurationUnavailable) throw vercelError;
        }

        const { data, error } = await supabaseCustomer.functions.invoke('request-customer-email-verification', {
            body: {},
        });

        if (error) {
            let providerError = '';
            let providerKeyDetected: boolean | null = null;
            let senderDetected: boolean | null = null;
            const context = (error as { context?: Response }).context;
            if (context && typeof context.clone === 'function') {
                try {
                    const errorPayload = await context.clone().json() as {
                        error?: string;
                        providerKeyDetected?: boolean;
                        senderDetected?: boolean;
                    };
                    providerError = String(errorPayload?.error || '');
                    providerKeyDetected = typeof errorPayload?.providerKeyDetected === 'boolean'
                        ? errorPayload.providerKeyDetected
                        : null;
                    senderDetected = typeof errorPayload?.senderDetected === 'boolean'
                        ? errorPayload.senderDetected
                        : null;
                } catch {
                    providerError = '';
                }
            }

            if (providerError === 'email_provider_not_configured') {
                try {
                    return await tryVercelFallback();
                } catch (fallbackError) {
                    if (fallbackError instanceof Error) throw fallbackError;
                }

                if (providerKeyDetected === false && senderDetected === false) {
                    throw new Error('A Edge Function não encontrou chave do provedor nem remetente de e-mail nos Secrets do Supabase.');
                }
                if (providerKeyDetected === false) {
                    throw new Error('A Edge Function não encontrou a chave do provedor de e-mail nos Secrets do Supabase.');
                }
                if (senderDetected === false) {
                    throw new Error('A Edge Function encontrou o provedor, mas não encontrou o remetente de e-mail nos Secrets do Supabase.');
                }
            }

            const labels: Record<string, string> = {
                valid_email_required: 'Cadastre e salve um e-mail válido antes de solicitar a confirmação.',
                rate_limited: 'Aguarde um pouco antes de solicitar outro e-mail de confirmação.',
                email_delivery_failed: 'A loja não conseguiu enviar o e-mail de confirmação agora. Tente novamente mais tarde.',
                access_denied: 'Sua sessão expirou. Entre novamente para confirmar o e-mail.',
            };
            throw new Error(labels[providerError] || 'Não foi possível enviar a confirmação de e-mail agora.');
        }

        const payload = data as {
            ok?: boolean;
            error?: string;
            alreadyVerified?: boolean;
            email?: string;
            expiresAt?: string;
            storeName?: string;
        } | null;

        if (!payload?.ok) {
            if (payload?.error === 'email_provider_not_configured') {
                return tryVercelFallback();
            }

            const labels: Record<string, string> = {
                valid_email_required: 'Cadastre e salve um e-mail válido antes de solicitar a confirmação.',
                rate_limited: 'Aguarde um pouco antes de solicitar outro e-mail de confirmação.',
                email_delivery_failed: 'A loja não conseguiu enviar o e-mail de confirmação agora. Tente novamente mais tarde.',
                access_denied: 'Sua sessão expirou. Entre novamente para confirmar o e-mail.',
            };
            throw new Error(labels[payload?.error || ''] || 'Não foi possível enviar a confirmação de e-mail agora.');
        }

        return payload;
    },

    // --- Direitos do titular ---
    async exportSelfData() {
        const { data, error } = await supabaseCustomer.rpc('export_customer_self_data_safe');
        if (error) throw new Error('Não foi possível exportar seus dados agora.');

        const payload = data as (SelfRpcPayload & { export?: Record<string, unknown> }) | null;
        if (!payload?.ok) throw selfServiceError(payload, 'Não foi possível exportar seus dados agora.');
        return payload.export && typeof payload.export === 'object' ? payload.export : {};
    },

    // --- Shared cart draft ---
    async getSelfCartDraft() {
        const { data, error } = await supabaseCustomer.rpc('get_customer_self_cart_draft_safe');
        if (error) throw new Error('Não foi possível recuperar seu carrinho compartilhado.');
        const payload = data as (SelfRpcPayload & {
            cart?: Record<string, unknown>;
            updated_at?: string | null;
            revision?: number | string | null;
        }) | null;
        if (!payload?.ok) throw selfServiceError(payload, 'Não foi possível recuperar seu carrinho compartilhado.');
        return {
            cart: payload.cart && typeof payload.cart === 'object' ? payload.cart : {},
            updatedAt: payload.updated_at ? String(payload.updated_at) : null,
            revision: Number(payload.revision || 0),
        };
    },

    async saveSelfCartDraft(cart: Record<string, unknown>) {
        const { data, error } = await supabaseCustomer.rpc('save_customer_self_cart_draft_safe', {
            p_cart: cart,
        });
        if (error) throw new Error('Não foi possível sincronizar seu carrinho.');
        const payload = data as SelfRpcPayload | null;
        if (!payload?.ok) throw selfServiceError(payload, 'Não foi possível sincronizar seu carrinho.');
        return payload;
    },

    async clearSelfCartDraft() {
        const { data, error } = await supabaseCustomer.rpc('clear_customer_self_cart_draft_safe');
        if (error) throw new Error('Não foi possível limpar o carrinho compartilhado.');
        const payload = data as (SelfRpcPayload & {
            updated_at?: string | null;
            revision?: number | string | null;
        }) | null;
        if (!payload?.ok) throw selfServiceError(payload, 'Não foi possível limpar o carrinho compartilhado.');
        return {
            ok: true,
            updatedAt: payload.updated_at ? String(payload.updated_at) : null,
            revision: Number(payload.revision || 0),
        };
    },

    // --- Order History ---
    async getOrders(_customerId?: string): Promise<Order[]> {
        const { data, error } = await supabaseCustomer.rpc('get_customer_self_orders_safe', {
            p_limit: 100,
        });

        if (error) throw new Error('Erro ao buscar pedidos.');
        const payload = data as (SelfRpcPayload & { orders?: unknown[] }) | null;
        if (!payload?.ok) throw selfServiceError(payload, 'Erro ao buscar pedidos.');
        return (Array.isArray(payload.orders) ? payload.orders : []) as Order[];
    },
};