import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from '@/types';

interface AuthState {
    user: User | null;
    session: Session | null;
    profile: Profile | null;
    loading: boolean;
    setSession: (session: Session | null) => void;
    setUser: (user: User | null) => void;
    setProfile: (profile: Profile | null) => void;
    setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    session: null,
    profile: null,
    loading: true,
    setSession: (session) => set({ session, user: session?.user ?? null }),
    setUser: (user) => set({ user }),
    setProfile: (profile) => set({ profile }),
    setLoading: (loading) => set({ loading }),
}));
