import axios from 'axios';
import { useAuthStore } from '../store/auth-store';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
});

api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    const isAuthRequest = config.url?.includes('/auth/login') || config.url?.includes('/auth/register');

    if (token && !isAuthRequest) {
        if (config.headers && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            useAuthStore.getState().logout();
            // Opcjonalnie: przekierowanie, ale w Next.js router w pliku lib może być problematyczny,
            // lepiej polegać na reaktywności komponentów na zmianę stanu tokena w store.
            if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
