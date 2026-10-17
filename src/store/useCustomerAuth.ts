import { create } from 'zustand';
import type { Customer } from '@/types';

// Re-export Customer type for backward compatibility.
export type { Customer };

interface CustomerAuthState {
    customer: Customer | null;
    token: string | null;
    isAuthenticated: boolean;
    sessionRestored: boolean;
    login: (customer: Customer) => void;
    logout: () => void;
    markSessionRestored: () => void;
    updatePoints: (newPoints: number) => void;
}

// Authentication truth is intentionally kept out of persisted Zustand storage.
// A page reload must revalidate the Supabase Auth session through AuthService.restoreSession().
export const useCustomerAuth = create<CustomerAuthState>((set) => ({
    customer: null,
    token: null,
    isAuthenticated: false,
    sessionRestored: false,

    login: (customer) => set({
        customer,
        isAuthenticated: true,
        sessionRestored: true,
    }),

    logout: () => set({
        customer: null,
        token: null,
        isAuthenticated: false,
        sessionRestored: true,
    }),

    markSessionRestored: () => set({ sessionRestored: true }),

    updatePoints: (newPoints) => set((state) => ({
        customer: state.customer
            ? { ...state.customer, loyalty_points: newPoints }
            : null,
    })),
}));
