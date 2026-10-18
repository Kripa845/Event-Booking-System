import TicketIcon from "./TicketIcon";
import { CloudBank, Moon, PaperPlane, Starfield } from "./NightSky";

/** Left-hand brand panel shared by the login and register pages. */
export default function AuthBrand({ title, perks }) {
    return (
        <aside className="auth-brand">
            <Starfield className="auth-brand-stars" count={90} seed={8} />
            <PaperPlane className="auth-brand-plane" size={60} />
            <div className="auth-brand-moon"><Moon size={70} /></div>
            <CloudBank className="auth-brand-clouds" seed={14} height={260} edges={false} />
            <div className="auth-brand-inner">
                <div className="auth-brand-logo">
                    <span className="auth-brand-logo-icon"><TicketIcon size={20} /></span>
                    EventHub
                </div>
                <h2 className="auth-brand-title">{title}</h2>
                <ul className="auth-perks">
                    {perks.map((p) => (
                        <li key={p.title}>
                            <span className="auth-perk-icon">{p.icon}</span>
                            <div>
                                <div className="auth-perk-title">{p.title}</div>
                                <div className="auth-perk-text">{p.text}</div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </aside>
    );
}
