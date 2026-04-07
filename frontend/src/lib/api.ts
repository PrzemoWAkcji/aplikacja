import axios, { AxiosInstance } from 'axios';
import { useAuthStore } from '../store/auth-store';

const api: AxiosInstance = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
});

// Flaga zapobiegająca równoległemu odświeżaniu wielu tokenów naraz
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) {
            reject(error);
        } else {
            resolve(token);
        }
    });
    failedQueue = [];
};

// Request interceptor — dołącz Bearer token
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    const isAuthRequest =
        config.url?.includes('/auth/login') ||
        config.url?.includes('/auth/register') ||
        config.url?.includes('/auth/refresh');

    if (token && !isAuthRequest) {
        if (config.headers && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

// Response interceptor — na 401 spróbuj odświeżyć token
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Odśwież tylko przy 401 i tylko raz (nie dla requestów auth)
        if (
            error.response?.status === 401 &&
            !originalRequest._retry &&
            !originalRequest.url?.includes('/auth/')
        ) {
            const { refreshToken } = useAuthStore.getState();

            if (!refreshToken) {
                useAuthStore.getState().logout();
                redirectToLogin();
                return Promise.reject(error);
            }

            if (isRefreshing) {
                // Poczekaj na zakończenie trwającego odświeżania
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const response = await axios.post(
                    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/auth/refresh`,
                    { refresh_token: refreshToken },
                );

                const { access_token, refresh_token: newRefreshToken } = response.data;
                useAuthStore.getState().setAccessToken(access_token, newRefreshToken);
                processQueue(null, access_token);

                originalRequest.headers.Authorization = `Bearer ${access_token}`;
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                useAuthStore.getState().logout();
                redirectToLogin();
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

function redirectToLogin() {
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
    }
}

export default api;
