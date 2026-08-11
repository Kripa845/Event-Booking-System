import { useNavigate } from "react-router-dom";

function BackButton({ label = "← Back", className = "", style }) {
    const navigate = useNavigate();
    return (
        <button
            onClick={() => navigate(-1)}
            className={`back-btn ${className}`}
            style={style}
            type="button"
        >
            {label}
        </button>
    );
}

export default BackButton;
