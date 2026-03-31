import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Welcome from "./pages/Welcome";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import ProviderProfileEdit from "./pages/ProviderProfileEdit";
import ProviderProfilePreview from "./pages/ProviderProfilePreview";
import Categories from "./pages/Categories";
import CategoryServices from "./pages/CategoryServices";
import ServiceDetailPage from "./pages/ServiceDetail";
import MyServices from "./pages/MyServices";
import CreateService from "./pages/CreateService";
import PostJob from "./pages/PostJob";
import MyJobs from "./pages/MyJobs";
import JobDetail from "./pages/JobDetail";
import JobBoard from "./pages/JobBoard";
import BookService from "./pages/BookService";
import MyBookings from "./pages/MyBookings";
import Conversations from "./pages/Conversations";
import Chat from "./pages/Chat";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";
import PaymentScreen from "./pages/PaymentScreen";
import ReviewForm from "./pages/ReviewForm";
import ProviderReviews from "./pages/ProviderReviews";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ReportUser from "./pages/ReportUser";
import AdminPanel from "./pages/AdminPanel";
import SessionManagement from "./pages/SessionManagement";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/provider-profile/edit" element={<ProviderProfileEdit />} />
            <Route path="/provider-profile/preview" element={<ProviderProfilePreview />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/categories/:slug" element={<CategoryServices />} />
            <Route path="/services/:id" element={<ServiceDetailPage />} />
            <Route path="/my-services" element={<MyServices />} />
            <Route path="/services/new" element={<CreateService />} />
            <Route path="/jobs/new" element={<PostJob />} />
            <Route path="/my-jobs" element={<MyJobs />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/job-board" element={<JobBoard />} />
            <Route path="/book/:serviceId" element={<BookService />} />
            <Route path="/my-bookings" element={<MyBookings />} />
            <Route path="/conversations" element={<Conversations />} />
            <Route path="/chat/:conversationId" element={<Chat />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/payment/:bookingId" element={<PaymentScreen />} />
            <Route path="/review/:bookingId" element={<ReviewForm />} />
            <Route path="/provider/:providerId/reviews" element={<ProviderReviews />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/report/:userId" element={<ReportUser />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/security" element={<SessionManagement />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
