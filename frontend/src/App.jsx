import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import PrivateRoute from "./components/PrivateRoute";
import AdminLayout from "./components/AdminLayout";

// Public / Customer / Organizer pages
import Home from "./pages/Home";
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import EventDetails from "./pages/EventDetails";
import Login from "./pages/Login";
import Register from "./pages/Register";
import MyTickets from "./pages/MyTickets";
import Waitlist from "./pages/Waitlist";
import CheckIn from "./pages/CheckIn";
import OrganizerDashboard from "./pages/OrganizeDashboard";
import CreateEvent from "./pages/CreateEvent";
import EventAttendees from "./pages/EventAttendees";

// Admin pages
import AdminOverview   from "./pages/admin/AdminOverview";
import AdminOrganizers from "./pages/admin/AdminOrganizers";
import AdminCustomers  from "./pages/admin/AdminCustomers";
import AdminEvents     from "./pages/admin/AdminEvents";
import AdminProfile    from "./pages/admin/AdminProfile";
import AdminSettings   from "./pages/admin/AdminSettings";

/** Wraps a component inside AdminLayout, protected by requireAdmin */
function AdminRoute({ children }) {
    return (
        <PrivateRoute requireAdmin>
            <AdminLayout>{children}</AdminLayout>
        </PrivateRoute>
    );
}

function App() {
    return (
        <BrowserRouter>
            <Navbar />
            <Routes>
                {/* ── Public ── */}
                <Route path="/"            element={<Home />} />
                <Route path="/events/:id"  element={<EventDetails />} />
                <Route path="/login"       element={<Login />} />
                <Route path="/register"    element={<Register />} />

                {/* ── Customer ── */}
                <Route path="/my-tickets" element={
                    <PrivateRoute><MyTickets /></PrivateRoute>
                } />
                <Route path="/customer/dashboard" element={
                    <PrivateRoute><CustomerDashboard /></PrivateRoute>
                } />
                <Route path="/events/:id/waitlist" element={
                    <PrivateRoute><Waitlist /></PrivateRoute>
                } />

                {/* ── Organizer ── */}
                <Route path="/organizer/dashboard" element={
                    <PrivateRoute requireOrganizer><OrganizerDashboard /></PrivateRoute>
                } />
                <Route path="/organizer/create-event" element={
                    <PrivateRoute requireOrganizer><CreateEvent /></PrivateRoute>
                } />
                <Route path="/organizer/events/:id/attendees" element={
                    <PrivateRoute requireOrganizer><EventAttendees /></PrivateRoute>
                } />
                <Route path="/check-in" element={
                    <PrivateRoute requireOrganizer><CheckIn /></PrivateRoute>
                } />

                {/* ── Admin (sidebar layout) ── */}
                <Route path="/admin/dashboard"   element={<AdminRoute><AdminOverview /></AdminRoute>} />
                <Route path="/admin/organizers"  element={<AdminRoute><AdminOrganizers /></AdminRoute>} />
                <Route path="/admin/customers"   element={<AdminRoute><AdminCustomers /></AdminRoute>} />
                <Route path="/admin/events"      element={<AdminRoute><AdminEvents /></AdminRoute>} />
                <Route path="/admin/profile"     element={<AdminRoute><AdminProfile /></AdminRoute>} />
                <Route path="/admin/settings"    element={<AdminRoute><AdminSettings /></AdminRoute>} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
