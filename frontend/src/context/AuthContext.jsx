import { createContext, useContext, useState } from "react";
import api from "../services/api";

const AuthContext = createContext();

export function AuthProvider({ children }) {

    const [accessToken, setAccessToken] = useState(
        localStorage.getItem("access_token")
    );

    const login = async (username, password) => {

        const response = await api.post(
            "auth/login/",
            {
                username,
                password,
            }
        );

        const token = response.data.access;

        localStorage.setItem(
            "access_token",
            token
        );

        if (response.data.refresh) {
            localStorage.setItem(
                "refresh_token",
                response.data.refresh
            );
        }

        setAccessToken(token);

        return response.data;
    };

    const logout = () => {

        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");

        setAccessToken(null);
    };

    return (
        <AuthContext.Provider
            value={{
                accessToken,
                login,
                logout,
                isAuthenticated: !!accessToken,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}