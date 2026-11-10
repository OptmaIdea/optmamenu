export type CustomerMessageFilterItem = {
    id: string;
    title?: string | null;
    message?: string | null;
    category?: string | null;
    read?: boolean;
};

function normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

/** Pure local filter; never query notifications across a store or customer. */
export function filterCustomerInbox<T extends CustomerMessageFilterItem>(
    notifications: readonly T[],
    category: string,
    unreadOnly: boolean,
    search: string,
): T[] {
    const needle = normalize(search);
    return notifications.filter((notification) => (
        (category === 'all' || (notification.category || 'system') === category)
        && (!unreadOnly || !notification.read)
        && (!needle || normalize(`${notification.title || ''} ${notification.message || ''}`).includes(needle))
    ));
}

export type CustomerMessageAction = {
    tab: 'orders' | 'loyalty' | 'security' | 'profile' | 'communications';
    label: string;
};

/** Navigate by category; never trust an order ID or URL embedded in message text. */
export function customerMessageAction(category?: string | null): CustomerMessageAction | null {
    switch (category) {
        case 'orders': return { tab: 'orders', label: 'Ver meus pedidos' };
        case 'loyalty': return { tab: 'loyalty', label: 'Ver minha fidelidade' };
        case 'security': return { tab: 'security', label: 'Abrir segurança' };
        case 'profile': return { tab: 'profile', label: 'Ver meus dados' };
        case 'marketing': return { tab: 'communications', label: 'Minhas preferências' };
        default: return null;
    }
}
