import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';

// Layouts
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import OrganiserLayout from './components/OrganiserLayout';

// Public pages
import Home from './pages/Home';
import EventList from './pages/EventList';
import EventDetail from './pages/EventDetail';
import ShowDetail from './pages/ShowDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import WaitlistAccept from './pages/WaitlistAccept';

// Customer pages
import Checkout from './pages/Checkout';
import BookingHistory from './pages/BookingHistory';
import OrderDetail from './pages/OrderDetail';
import WaitlistPage from './pages/WaitlistPage';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminVenues from './pages/admin/Venues';
import AdminVenueDetail from './pages/admin/VenueDetail';

// Organiser pages
import OrganiserDashboard from './pages/organiser/Dashboard';
import OrganiserEvents from './pages/organiser/Events';
import OrganiserEventDetail from './pages/organiser/EventDetail';
import OrganiserShowDetail from './pages/organiser/ShowDetail';

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="events" element={<EventList />} />
          <Route path="events/:id" element={<EventDetail />} />
          <Route path="shows/:showId" element={<ShowDetail />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="verify-email" element={<VerifyEmail />} />
          <Route path="waitlist/accept/:offerId" element={<WaitlistAccept />} />

          {/* Customer */}
          <Route path="checkout" element={<ProtectedRoute role="customer"><Checkout /></ProtectedRoute>} />
          <Route path="bookings" element={<ProtectedRoute role="customer"><BookingHistory /></ProtectedRoute>} />
          <Route path="orders/:id" element={<ProtectedRoute role="customer"><OrderDetail /></ProtectedRoute>} />
          <Route path="waitlist" element={<ProtectedRoute role="customer"><WaitlistPage /></ProtectedRoute>} />
        </Route>

        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="venues" element={<AdminVenues />} />
          <Route path="venues/:id" element={<AdminVenueDetail />} />
        </Route>

        {/* Organiser */}
        <Route path="/organiser" element={<ProtectedRoute role="organiser"><OrganiserLayout /></ProtectedRoute>}>
          <Route index element={<OrganiserDashboard />} />
          <Route path="events" element={<OrganiserEvents />} />
          <Route path="events/:id" element={<OrganiserEventDetail />} />
          <Route path="events/:eventId/shows/:showId" element={<OrganiserShowDetail />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
