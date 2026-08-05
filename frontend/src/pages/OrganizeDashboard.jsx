import { useEffect, useState } from "react";

import api from "../services/api";

function OrganizerDashboard() {

    const [events, setEvents] = useState([]);

    useEffect(() => {

        const fetchEvents = async () => {

            try {

                const response = await api.get(
                    "events/"
                );

                setEvents(response.data);

            } catch (error) {

                console.error(error);

            }
        };

        fetchEvents();

    }, []);

    return (
        <main>

            <h1>Organizer Dashboard</h1>

            <div>

                <h2>My Events</h2>

                {events.map((event) => (

                    <div
                        key={event.id}
                        className="event-card"
                    >

                        <h3>
                            {event.title}
                        </h3>

                        <p>
                            Capacity:
                            {" "}
                            {event.capacity}
                        </p>

                        <p>
                            Available:
                            {" "}
                            {event.available_seats}
                        </p>

                        <p>
                            Sold:
                            {" "}
                            {event.capacity -
                                event.available_seats}
                        </p>

                    </div>

                ))}

            </div>

        </main>
    );
}

export default OrganizerDashboard;