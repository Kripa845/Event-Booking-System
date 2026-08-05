import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import EventDetails from "./pages/EventDetails";
import Login from "./pages/Login";
import Register from "./pages/Register";
import MyTickets from "./pages/MyTickets";
import Waitlist from "./pages/Waitlist";
import CheckIn from "./pages/CheckIn";
import OrganizerDashboard from "./pages/OrganizeDashboard";
function App() {

    return (
        <BrowserRouter>
             <Navbar />
            <Routes>

                <Route
                    path="/"
                    element={<Home />}
                />
               <Route
    path="/events/:id"
    element={<EventDetails />}
/>
       <Route
    path="/login"
    element={<Login />}
/>
       <Route
    path="/register"
    element={<Register />}
/>
        <Route
    path="/my-tickets"
    element={<MyTickets />}
/>
<Route
    path="/events/:id/waitlist"
    element={<Waitlist />}
/>
<Route
    path="/check-in"
    element={<CheckIn />}
/>
<Route
    path="/organizer/dashboard"
    element={<OrganizerDashboard />}
/>
            </Routes>

        </BrowserRouter>
    );
}

export default App;