import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Customer } from '@/types';


// Re-export Customer type for backward compatibility
export type { Customer };

interface CustomerAuthState {
    customer: Customer | null;
    token: string | null; // For future real Auth integration
    isAuthenticated: boolean;

    // Actions
    login: (customer: Customer) => void;
    logout: () => void;
    updatePoints: (newPoints: number) => void;
}

export const useCustomerAuth = create<CustomerAuthState>()(
    persist(
        (set) => ({
            customer: null,
            token: null,
            isAuthenticated: false,

            login: (customer) => set({ customer, isAuthenticated: true }),

            logout: () => set({ customer: null, isAuthenticated: false }),

            updatePoints: (newPoints) => set((state) => ({
                customer: state.customer ? { ...state.customer, loyalty_points: newPoints } : null
            }))
        }),
        {
            name: 'optma-customer-auth', // LocalStorage key
            partialize: (state) => ({ customer: state.customer, isAuthenticated: state.isAuthenticated }), // Persist only necessary data
        }
    )
);
