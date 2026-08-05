import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Register.css";
import api from "../services/api";

function Register() {

    const navigate = useNavigate();

    const [form, setForm] = useState({
        username: "",
        email: "",
        password: "",
    });

    const [error, setError] = useState("");

    const handleChange = (e) => {

        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e) => {

        e.preventDefault();

        setError("");

        try {

            await api.post(
                "auth/register/",
                form
            );

            navigate("/login");

        } catch (error) {

            console.error(error);

            setError(
                "Registration failed."
            );
        }
    };

    return (
        <main>

            <h1>Create Account</h1>

            {error && (
                <p>{error}</p>
            )}

            <form onSubmit={handleSubmit}>

                <input
                    name="username"
                    placeholder="Username"
                    value={form.username}
                    onChange={handleChange}
                />

                <input
                    name="email"
                    type="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={handleChange}
                />

                <input
                    name="password"
                    type="password"
                    placeholder="Password"
                    value={form.password}
                    onChange={handleChange}
                />

                <button type="submit">
                    Register
                </button>

            </form>

        </main>
    );
}

export default Register;