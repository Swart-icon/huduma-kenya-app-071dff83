import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { LocationProvider } from "@/contexts/LocationContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { showErrorToast } from "@/lib/errorHandler";
import Index from "./pages/Index";
import Onboarding from "./pages/Onboarding";
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
import SessionManagement from "./pages/SessionManagement";
import SearchServices from "./pages/SearchServices";
import AdminPanel from "./pages/AdminPanel";
import ServiceMap from "./pages/ServiceMap";
import NearbyServices from "./pages/NearbyServices";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import JobSeekerDashboard from "./pages/JobSeekerDashboard";
import JobSeekerProfile from "./pages/JobSeekerProfile";
import MyApplications from "./pages/MyApplications";
import SavedJobs from "./pages/SavedJobs";
import ProviderPublicProfile from "./pages/ProviderPublicProfile";
import VideoFeed from "./pages/VideoFeed";
import HelpCenter from "./pages/HelpCenter";
import { OfflineBanner } from "@/components/OfflineBanner";

// Keep React Query's online status in sync with browser events
onlineManager.setEventListener((setOnline) => {
  const onlineHandler = () => setOnline(true);
  const offlineHandler = () => setOnline(false);
  window.addEventListener("online", onlineHandler);
  window.addEventListener("offline", offlineHandler);
  return () => {
    window.removeEventListener("online", onlineHandler);
    window.removeEventListener("offline", offlineHandler);
  };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15000),
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 30,
      refetchOnReconnect: "always",
      networkMode: "offlineFirst",
    },
    mutations: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      networkMode: "offlineFirst",
      onError: (error) => {
        showErrorToast(error, "saving data");
      },
    },
  },
});

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" storageKey="huduma-theme" enableSystem>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <LocationProvider>
          <OfflineBanner />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/provider-profile/edit" element={<ProviderProfileEdit />} />
            <Route path="/provider-profile/preview" element={<ProviderProfilePreview />} />
            <Route path="/search" element={<SearchServices />} />
            <Route path="/map" element={<ServiceMap />} />
            <Route path="/nearby" element={<NearbyServices />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/categories/:slug" element={<CategoryServices />} />
            <Route path="/services/:id" element={<ServiceDetailPage />} />
            <Route path="/my-services" element={<MyServices />} />
            <Route path="/services/new" element={<CreateService />} />
            <Route path="/jobs/new" element={<PostJob />} />
            <Route path="/my-jobs" element={<MyJobs />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/job-seeker" element={<JobSeekerDashboard />} />
            <Route path="/job-seeker-profile" element={<JobSeekerProfile />} />
            <Route path="/my-applications" element={<MyApplications />} />
            <Route path="/saved-jobs" element={<SavedJobs />} />
            <Route path="/job-board" element={<JobBoard />} />
            <Route path="/book/:serviceId" element={<BookService />} />
            <Route path="/my-bookings" element={<MyBookings />} />
            <Route path="/conversations" element={<Conversations />} />
            <Route path="/chat/:conversationId" element={<Chat />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/payment/:bookingId" element={<PaymentScreen />} />
            <Route path="/review/:bookingId" element={<ReviewForm />} />
            <Route path="/provider/:providerId/reviews" element={<ProviderReviews />} />
            <Route path="/provider/:providerId" element={<ProviderPublicProfile />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/report/:userId" element={<ReportUser />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/security" element={<SessionManagement />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/videos" element={<VideoFeed />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </LocationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
