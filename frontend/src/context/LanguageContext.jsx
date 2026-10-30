import { createContext, useContext, useEffect, useState } from "react";

const KEY = "eh-lang";

// English and Nepali text for the most-used screens. Missing keys fall back to English.
const TEXT = {
    en: {
        "nav.events": "Events", "nav.dashboard": "Dashboard", "nav.myTickets": "My Tickets", "nav.mySky": "My Sky",
        "nav.create": "+ Create", "nav.checkIn": "Check-In", "nav.login": "Login", "nav.signUp": "Sign Up", "nav.signOut": "Sign out",
        "browse.title": "Find something worth staying up for",
        "browse.keywords": "Keywords", "browse.plain": "✨ Plain English",
        "browse.placeholder": "Search events, locations, organizers…",
        "browse.placeholderSmart": "e.g. free tech workshops this weekend in Lalitpur",
        "browse.search": "Search", "browse.ask": "Ask", "browse.upcoming": "Upcoming Events",
        "browse.clear": "✕ Clear filters", "browse.none": "No events found", "browse.noneHint": "Try a different search or category.",
        "browse.results": "Results for", "browse.eventsSuffix": "Events",
        "cat.all": "All Events", "cat.WORKSHOP": "🛠️ Workshop", "cat.HACKATHON": "🏆 Hackathon", "cat.CONCERT": "🎵 Concert",
        "cat.CONFERENCE": "🎙️ Conference", "cat.SEMINAR": "📚 Seminar", "cat.SPORTS": "⚽ Sports", "cat.FESTIVAL": "🎉 Festival", "cat.MEETUP": "☕ Meetup",
        "card.free": "Free", "card.soldOut": "Sold Out", "card.seatsLeft": "seats left", "card.view": "View →",
        "card.early": "Early bird", "card.left": "left",
        "event.about": "About this event", "event.organizedBy": "Organized by",
        "event.book": "Book Ticket", "event.registerFree": "Register Free", "event.booking": "Booking...",
        "event.waitlist": "📋 Join Waitlist", "event.noSeats": "😔 No seats available", "event.seatsRemaining": "seats remaining",
        "event.of": "of", "event.perTicket": "/ ticket", "event.viewTickets": "View My Tickets →", "event.calendar": "📅 Add to calendar",
        "tickets.title": "My Tickets", "tickets.subtitle": "All your event bookings in one place.", "tickets.browse": "Browse Events",
    },
    np: {
        "nav.events": "कार्यक्रमहरू", "nav.dashboard": "ड्यासबोर्ड", "nav.myTickets": "मेरा टिकटहरू", "nav.mySky": "मेरो आकाश",
        "nav.create": "+ नयाँ", "nav.checkIn": "चेक-इन", "nav.login": "लगइन", "nav.signUp": "साइन अप", "nav.signOut": "साइन आउट",
        "browse.title": "जाग्राम बस्न लायक कार्यक्रम खोज्नुहोस्",
        "browse.keywords": "शब्दहरू", "browse.plain": "✨ सामान्य भाषामा",
        "browse.placeholder": "कार्यक्रम, ठाउँ वा आयोजक खोज्नुहोस्…",
        "browse.placeholderSmart": "जस्तै: यो हप्ता ललितपुरमा निःशुल्क टेक कार्यशाला",
        "browse.search": "खोज्नुहोस्", "browse.ask": "सोध्नुहोस्", "browse.upcoming": "आगामी कार्यक्रमहरू",
        "browse.clear": "✕ फिल्टर हटाउनुहोस्", "browse.none": "कुनै कार्यक्रम भेटिएन", "browse.noneHint": "अर्को शब्द वा श्रेणी प्रयास गर्नुहोस्।",
        "browse.results": "खोज नतिजा:", "browse.eventsSuffix": "कार्यक्रमहरू",
        "cat.all": "सबै कार्यक्रम", "cat.WORKSHOP": "🛠️ कार्यशाला", "cat.HACKATHON": "🏆 ह्याकाथन", "cat.CONCERT": "🎵 कन्सर्ट",
        "cat.CONFERENCE": "🎙️ सम्मेलन", "cat.SEMINAR": "📚 गोष्ठी", "cat.SPORTS": "⚽ खेलकुद", "cat.FESTIVAL": "🎉 महोत्सव", "cat.MEETUP": "☕ भेटघाट",
        "card.free": "निःशुल्क", "card.soldOut": "सबै बिक्यो", "card.seatsLeft": "सिट बाँकी", "card.view": "हेर्नुहोस् →",
        "card.early": "अर्ली बर्ड", "card.left": "बाँकी",
        "event.about": "कार्यक्रमको बारेमा", "event.organizedBy": "आयोजक:",
        "event.book": "टिकट बुक गर्नुहोस्", "event.registerFree": "निःशुल्क दर्ता", "event.booking": "बुक हुँदैछ...",
        "event.waitlist": "📋 प्रतीक्षा सूचीमा जानुहोस्", "event.noSeats": "😔 सिट उपलब्ध छैन", "event.seatsRemaining": "सिट बाँकी",
        "event.of": "मध्ये", "event.perTicket": "/ टिकट", "event.viewTickets": "मेरा टिकटहरू हेर्नुहोस् →", "event.calendar": "📅 क्यालेन्डरमा थप्नुहोस्",
        "tickets.title": "मेरा टिकटहरू", "tickets.subtitle": "तपाईंका सबै बुकिङ एकै ठाउँमा।", "tickets.browse": "कार्यक्रम हेर्नुहोस्",
    },
};

const LanguageContext = createContext({ lang: "en", setLang: () => {}, t: (k) => TEXT.en[k] ?? k });

export function LanguageProvider({ children }) {
    const [lang, setLang] = useState(() => {
        try { return localStorage.getItem(KEY) === "np" ? "np" : "en"; } catch { return "en"; }
    });

    useEffect(() => {
        try { localStorage.setItem(KEY, lang); } catch { /* storage unavailable */ }
        document.documentElement.lang = lang === "np" ? "ne" : "en";
    }, [lang]);

    const t = (key) => TEXT[lang][key] ?? TEXT.en[key] ?? key;

    return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function useLang() { return useContext(LanguageContext); }

/** EN / ने switch for the navbar. */
export function LanguageToggle() {
    const { lang, setLang } = useLang();
    return (
        <button
            type="button" className="lang-toggle"
            onClick={() => setLang(lang === "en" ? "np" : "en")}
            aria-label={lang === "en" ? "नेपालीमा हेर्नुहोस्" : "Switch to English"}
            title={lang === "en" ? "नेपाली" : "English"}
        >
            {lang === "en" ? "ने" : "EN"}
        </button>
    );
}
