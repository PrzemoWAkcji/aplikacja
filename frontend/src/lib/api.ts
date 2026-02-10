import axios from 'axios';
import { useAuthStore } from '../store/auth-store';

const api = axios.create({
    baseURL: 'http://localhost:3000', // Adjust if backend runs on a different port or host
});

api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
