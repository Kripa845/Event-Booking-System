import axios from "axios";
import { clearSavedTickets } from "../utils/offlineTickets";

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

const NOTICE_KEY = "eh-auth-notice";

/**
 * Log out and go to the login page, which shows `message`.
 * Used when the server says an organizer account is no longer approved.
 */
export function forceLogout(message) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    clearSavedTickets();
    try { sessionStorage.setItem(NOTICE_KEY, message); } catch { /* storage unavailable */ }
    window.location.href = "/login";
}

/** Read (and clear) the message left by forceLogout, if any. */
export function takeAuthNotice() {
    try {
        const message = sessionStorage.getItem(NOTICE_KEY);
        sessionStorage.removeItem(NOTICE_KEY);
        return message || "";
    } catch {
        return "";
    }
}

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

        // Organizer pending, rejected or suspended: their token no longer works for organizer pages.
        const code = error.response?.data?.code;
        if (error.response?.status === 403 && typeof code === "string" && code.startsWith("organizer_")) {
            forceLogout(error.response.data.error);
            return Promise.reject(error);
        }

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
