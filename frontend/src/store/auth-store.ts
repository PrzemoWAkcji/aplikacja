import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
}

interface AuthState {
    token: string | null;
    refreshToken: string | null;
    user: User | null;
    _hasHydrated: boolean;
    setAuth: (token: string, refreshToken: string, user: User) => void;
    setAccessToken: (token: string, refreshToken: string) => void;
    logout: () => void;
    setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            refreshToken: null,
            user: null,
            _hasHydrated: false,
            setAuth: (token, refreshToken, user) => set({ token, refreshToken, user }),
            setAccessToken: (token, refreshToken) => set({ token, refreshToken }),
            logout: () => set({ token: null, refreshToken: null, user: null }),
            setHasHydrated: (state) => set({ _hasHydrated: state }),
        }),
        {
            name: 'auth-storage',
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true);
            },
        }
    )
);
