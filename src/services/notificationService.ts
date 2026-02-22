import { CustomerService } from '@/services/customerService';

export const NotificationService = {
    // 1. Welcome Message
    async sendWelcome(customerId: string, storeId: string, storeName: string) {
        return await CustomerService.addNotification({
            customer_id: customerId,
            store_id: storeId,
            title: 'Bem-vindo(a)! 🎉',
            message: `Que alegria ter você aqui na ${storeName}! Aproveite nossas ofertas e delícias.`,
            type: 'success'
        });
    },

    // 2. Happy Birthday
    async sendBirthday(customerId: string, storeId: string) {
        return await CustomerService.addNotification({
            customer_id: customerId,
            store_id: storeId,
            title: 'Feliz Aniversário! 🎂',
            message: 'Hoje é o seu dia! Desejamos muitas felicidades e doces momentos.',
            type: 'success'
        });
    },

    // 3. Loyalty Join
    async sendLoyaltyJoin(customerId: string, storeId: string, bonusPoints: number) {
        return await CustomerService.addNotification({
            customer_id: customerId,
            store_id: storeId,
            title: 'Fidelidade Ativada! 💎',
            message: `Você entrou para o nosso Clube de Fidelidade e já ganhou ${bonusPoints} pontos de presente!`,
            type: 'success'
        });
    },

    // 4. Loyalty Points Update (Generic)
    async sendLoyaltyPointsUpdate(customerId: string, storeId: string, points: number, type: 'credit' | 'debit', reason?: string) {
        const title = type === 'credit' ? 'Pontos Ganhos! 🚀' : 'Pontos Utilizados 🎁';
        const msg = type === 'credit'
            ? `Você ganhou ${points} pontos de fidelidade.${reason ? ` Motivo: ${reason}` : ''}`
            : `Você utilizou ${points} pontos.${reason ? ` Motivo: ${reason}` : ''}`;

        return await CustomerService.addNotification({
            customer_id: customerId,
            store_id: storeId,
            title: title,
            message: msg,
            type: type === 'credit' ? 'success' : 'info'
        });
    },

    // 5. Loyalty Opt-Out
    async sendLoyaltyExit(customerId: string, storeId: string) {
        return await CustomerService.addNotification({
            customer_id: customerId,
            store_id: storeId,
            title: 'Fidelidade Cancelada 😢',
            message: 'Você saiu do programa de fidelidade. Se mudar de ideia, estaremos aqui!',
            type: 'warning'
        });
    },

    // 6. Profile Update
    async sendProfileUpdate(customerId: string, storeId: string) {
        return await CustomerService.addNotification({
            customer_id: customerId,
            store_id: storeId,
            title: 'Perfil Atualizado! 📝',
            message: 'Seus dados de cadastro foram atualizados com sucesso.',
            type: 'info' // Using default or info
        });
    },

    // 7. Address Update
    async sendAddressUpdate(customerId: string, storeId: string, action: 'add' | 'update' | 'delete') {
        const messages = {
            add: 'Novo endereço adicionado com sucesso 🏠',
            update: 'Endereço atualizado com sucesso 📝',
            delete: 'Endereço removido da sua conta 🗑️'
        };

        return await CustomerService.addNotification({
            customer_id: customerId,
            store_id: storeId,
            title: 'Endereços Atualizados',
            message: messages[action],
            type: 'info'
        });
    },

    // 8. Pending Data Warning
    async sendPendingDataWarning(customerId: string, storeId: string, missingFields: string[]) {
        return await CustomerService.addNotification({
            customer_id: customerId,
            store_id: storeId,
            title: 'Complete seu Cadastro ⚠️',
            message: `Faltam alguns dados: ${missingFields.join(', ')}. Complete para ter acesso total!`,
            type: 'warning'
        });
    }
};
