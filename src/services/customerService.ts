import { supabase } from '@/lib/supabase';

export const CustomerService = {
    // --- Profile Management ---
    async updateProfile(customerId: string, data: { full_name?: string, cpf?: string, email?: string, birth_date?: string, phone?: string, loyalty_opt_in?: boolean }) {
        console.log(`[CUSTOMER_SERVICE] Atualizando perfil para ${customerId}:`, data);
        const { error } = await supabase
            .from('customers')
            .update(data)
            .eq('id', customerId);

        if (error) {
            console.error(`[CUSTOMER_SERVICE] ERRO em updateProfile:`, error);
            if (error.code === '23505') { // Unique violation
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
        // If default, unset others first
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
        // If setting to default, unset others first
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

    async addNotification(notification: { customer_id: string, store_id: string, title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error' }) {
        console.log(`[CUSTOMER_SERVICE] Adicionando notificação para ${notification.customer_id}:`, notification.title);
        const { error } = await supabase
            .from('customer_notifications')
            .insert(notification);
        if (error) {
            console.error(`[CUSTOMER_SERVICE] ERRO em addNotification:`, error);
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

    // --- Consent Logging ---
    async logConsent(customerId: string, consentType: string, action: 'granted' | 'revoked') {
        const { error } = await supabase
            .from('customer_consent_logs')
            .insert({
                customer_id: customerId,
                consent_type: consentType,
                action: action,
                user_agent: navigator.userAgent
            });

        if (error) console.error('Erro ao registrar consentimento:', error);
    },

    // --- Order History ---
    async getOrders(customerId: string) {
        // Use phone number for now as relation, or if we have customer_id in orders table use that.
        // Based on previous conversations/schema, orders link to store. 
        // We typically link via customer details or if there is a customer_id column.
        // For this implementation, I will assume we might need to filter by phone number 
        // if customer_id isn't strictly enforced yet, BUT `customers` table exists now.
        // Let's check if `orders` has `customer_id`. The Orders interface in Orders.tsx didn't show it but it might be there.
        // Safest bet for now: Filter by customer_phone matching customer.phone

        // Wait, better to check if we can link by ID.
        // If not, fall back to phone.
        // Let's try fetching by customer_id column first.

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
            .or(`customer_id.eq.${customerId}`) // If customer_id exists
            .order('created_at', { ascending: false });

        // If error or empty, we might need phone fallback logic, 
        // but let's assume we are migrating to use customer_id.
        // Note: The user just ran migrations for customers table.
        // Existing orders might NOT have customer_id.

        if (error) throw new Error('Erro ao buscar pedidos.');
        return data || [];
    }
};
