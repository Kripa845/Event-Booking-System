import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api, { forceLogout } from "../services/api";
import { clearSavedTickets } from "../utils/offlineTickets";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [accessToken, setAccessToken] = useState(localStorage.getItem("access_token"));
    const [user, setUser] = useState(null);
    const [profileLoading, setProfileLoading] = useState(!!localStorage.getItem("access_token"));

    const fetchProfile = useCallback(async (token) => {
        try {
            const res = await api.get("auth/profile/", {
                headers: { Authorization: `Bearer ${token}` },
            });
            // An organizer who was suspended (or never approved) is signed out right away.
            if (res.data.role === "ORGANIZER" && res.data.organizer_status && res.data.organizer_status !== "APPROVED") {
                forceLogout(res.data.organizer_status === "SUSPENDED"
                    ? "Your organizer account has been suspended."
                    : "Your organizer account is not approved.");
                return;
            }
            setUser(res.data);
        } catch {
            setUser(null);
        } finally {
            setProfileLoading(false);
        }
    }, []);

    useEffect(() => {
        if (accessToken) {
            fetchProfile(accessToken);
        } else {
            setUser(null);
            setProfileLoading(false);
        }
    }, [accessToken, fetchProfile]);

    // email + password login
    const login = async (email, password) => {
        const res = await api.post("auth/login/", { email, password });
        const token = res.data.access;
        localStorage.setItem("access_token", token);
        if (res.data.refresh) localStorage.setItem("refresh_token", res.data.refresh);
        setAccessToken(token);
        await fetchProfile(token);
        return res.data;
    };

    const logout = () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        clearSavedTickets();
        setAccessToken(null);
        setUser(null);
    };

    const refreshProfile = () => accessToken && fetchProfile(accessToken);

    return (
        <AuthContext.Provider value={{
            accessToken, user, profileLoading,
            login, logout, refreshProfile,
            isAuthenticated: !!accessToken,
            isOrganizer: user?.role === "ORGANIZER",
            isAdmin:     user?.role === "ADMIN",
            isCustomer:  user?.role === "CUSTOMER",
            isDoorStaff: !!user?.is_door_staff,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() { return useContext(AuthContext); }
