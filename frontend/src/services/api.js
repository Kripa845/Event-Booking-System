import axios from "axios";

// Where the Django backend runs. Override with VITE_API_URL in frontend/.env.local,
// e.g. VITE_API_URL=http://127.0.0.1:8001 when port 8000 is taken by another app.
const BASE_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

export function getImageUrl(path) {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return `${BASE_URL}${path}`;
}

const api = axios.create({
    baseURL: `${BASE_URL}/api/`,
});

let isRefreshing = false;
let pendingRequests = [];

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("access_token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    pendingRequests.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                }).catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const refreshToken = localStorage.getItem("refresh_token");
                if (!refreshToken) {
                    throw new Error("No refresh token");
                }
                const res = await axios.post(
                    `${BASE_URL}/api/auth/refresh/`,
                    { refresh: refreshToken }
                );
                const newToken = res.data.access;
                localStorage.setItem("access_token", newToken);
                originalRequest.headers.Authorization = `Bearer ${newToken}`;

                pendingRequests.forEach(({ resolve }) => resolve(newToken));
                pendingRequests = [];

                return api(originalRequest);
            } catch (refreshError) {
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                pendingRequests.forEach(({ reject }) => reject(refreshError));
                pendingRequests = [];
                window.location.href = "/login";
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;
