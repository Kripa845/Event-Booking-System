import { useEffect, useState } from "react";

import api from "../services/api";
import "../index.css";
import EventCard from "../components/EventCard";

function Home() {

    const [events, setEvents] = useState([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);

    const fetchEvents = async (searchValue = "") => {

        try {

            setLoading(true);

            const response = await api.get("events/", {
                params: {
                    search: searchValue,
                },
            });

            setEvents(response.data);

        } catch (error) {

            console.error(error);

        } finally {

            setLoading(false);

        }
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    const handleSearch = (event) => {

        event.preventDefault();

        fetchEvents(search);
    };

    return (
        <main>

            <section>
                <h1>
                    Discover Amazing Events
                </h1>

                <p>
                    Find workshops, conferences,
                    concerts and more.
                </p>

                <form onSubmit={handleSearch}>

                    <input
                        type="text"
                        placeholder="Search events..."
                        value={search}
                        onChange={(e) =>
                            setSearch(e.target.value)
                        }
                    />

                    <button type="submit">
                        Search
                    </button>

                </form>
            </section>

            <section>

                <h2>Upcoming Events</h2>

                {loading ? (

                    <p>Loading events...</p>

                ) : events.length === 0 ? (

                    <p>No events found.</p>

                ) : (

                    <div>
                        {events.map((event) => (
                            <EventCard
                                key={event.id}
                                event={event}
                            />
                        ))}
                    </div>

                )}

            </section>

        </main>
    );
}

export default Home;