'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/auth-store';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import Link from 'next/link';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();
    const setAuth = useAuthStore((state) => state.setAuth);
    const _hasHydrated = useAuthStore((state) => state._hasHydrated);
    const token = useAuthStore((state) => state.token);

    useEffect(() => {
        if (_hasHydrated && token) {
            router.push('/dashboard');
        }
    }, [_hasHydrated, token, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            // 1. Zaloguj się i pobierz oba tokeny
            const response = await api.post('/auth/login', { email, password });
            const { access_token, refresh_token } = response.data;

            // 2. Pobierz profil (przekazujemy token ręcznie, aby uniknąć opóźnień store)
            const profileResponse = await api.get('/auth/profile', {
                headers: {
                    Authorization: `Bearer ${access_token}`
                }
            });

            // 3. Ustaw pełne dane w store (token, refresh token, dane użytkownika)
            setAuth(access_token, refresh_token, profileResponse.data);

            router.push('/dashboard');
        } catch (err: any) {
            console.error('Błąd logowania:', err);
            setError(err.response?.data?.message || 'Nieudane logowanie');
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
            <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
                        Zaloguj się
                    </h2>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="-space-y-px rounded-md shadow-sm">
                        <div className="mb-4">
                            <label user-select="none" htmlFor="email-address" className="sr-only">
                                Email
                            </label>
                            <Input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="relative block w-full appearance-none rounded-none rounded-t-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                placeholder="Adres email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="password" user-select="none" className="sr-only">
                                Hasło
                            </label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                className="relative block w-full appearance-none rounded-none rounded-b-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                placeholder="Hasło"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="text-sm text-red-500 text-center">
                            {error}
                        </div>
                    )}

                    <div>
                        <Button
                            type="submit"
                            className="group relative flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        >
                            Zaloguj się
                        </Button>
                    </div>
                    <div className="text-center text-sm">
                        <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
                            Nie masz konta? Zarejestruj się
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
