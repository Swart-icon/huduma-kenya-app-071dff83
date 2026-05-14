import { lazy, Suspense, useEffect } from "react";
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

// Critical / above-the-fold routes — keep eager
import Index from "./pages/Index";
import VideoFeed from "./pages/VideoFeed";
import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Lazy-load everything else to shrink initial bundle
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const ProviderProfileEdit = lazy(() => import("./pages/ProviderProfileEdit"));
const ProviderProfilePreview = lazy(() => import("./pages/ProviderProfilePreview"));
const Categories = lazy(() => import("./pages/Categories"));
const CategoryServices = lazy(() => import("./pages/CategoryServices"));
const ServiceDetailPage = lazy(() => import("./pages/ServiceDetail"));
const MyServices = lazy(() => import("./pages/MyServices"));
const CreateService = lazy(() => import("./pages/CreateService"));
const MyGoods = lazy(() => import("./pages/MyGoods"));
const CreateGood = lazy(() => import("./pages/CreateGood"));
const GoodDetail = lazy(() => import("./pages/GoodDetail"));
const PostJob = lazy(() => import("./pages/PostJob"));
const MyJobs = lazy(() => import("./pages/MyJobs"));
const JobDetail = lazy(() => import("./pages/JobDetail"));
const JobBoard = lazy(() => import("./pages/JobBoard"));
const BookService = lazy(() => import("./pages/BookService"));
const MyBookings = lazy(() => import("./pages/MyBookings"));
const Conversations = lazy(() => import("./pages/Conversations"));
const Chat = lazy(() => import("./pages/Chat"));
const Notifications = lazy(() => import("./pages/Notifications"));
const PaymentScreen = lazy(() => import("./pages/PaymentScreen"));
const ReviewForm = lazy(() => import("./pages/ReviewForm"));
const ProviderReviews = lazy(() => import("./pages/ProviderReviews"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ReportUser = lazy(() => import("./pages/ReportUser"));
const SessionManagement = lazy(() => import("./pages/SessionManagement"));
const SearchServices = lazy(() => import("./pages/SearchServices"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const ServiceMap = lazy(() => import("./pages/ServiceMap"));
const NearbyServices = lazy(() => import("./pages/NearbyServices"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const JobSeekerDashboard = lazy(() => import("./pages/JobSeekerDashboard"));
const JobSeekerProfile = lazy(() => import("./pages/JobSeekerProfile"));
const MyApplications = lazy(() => import("./pages/MyApplications"));
const ClientApplications = lazy(() => import("./pages/ClientApplications"));
const SavedJobs = lazy(() => import("./pages/SavedJobs"));
const ProviderPublicProfile = lazy(() => import("./pages/ProviderPublicProfile"));
const UserVideos = lazy(() => import("./pages/UserVideos"));
const RecordVideo = lazy(() => import("./pages/RecordVideo"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const Upgrade = lazy(() => import("./pages/Upgrade"));
const GoLive = lazy(() => import("./pages/GoLive"));
const LiveViewer = lazy(() => import("./pages/LiveViewer"));
const Inbox = lazy(() => import("./pages/Inbox"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const PaymentHistory = lazy(() => import("./pages/PaymentHistory"));
const DeleteAccount = lazy(() => import("./pages/DeleteAccount"));

import { OfflineBanner } from "@/components/OfflineBanner";
import ProfileGuard from "@/components/ProfileGuard";
import { RateUsDialog } from "@/components/RateUsDialog";
import { useRatePrompt } from "@/hooks/useRatePrompt";
import { useAndroidBackButton } from "@/hooks/useAndroidBackButton";
import { useBroadcastNotifications } from "@/hooks/useBroadcastNotifications";
import { MobileMediaRecovery } from "@/hooks/useMobileMediaLifecycle";

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

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const AppInner = () => {
  const ratePrompt = useRatePrompt();
  useAndroidBackButton();
  useBroadcastNotifications();

  // Expose trackAction globally so any page can call it
  useEffect(() => {
    (window as any).__servio_trackAction = ratePrompt.trackAction;
    return () => { delete (window as any).__servio_trackAction; };
  }, [ratePrompt.trackAction]);

  return (
    <>
      <MobileMediaRecovery />
      <OfflineBanner />
      <ProfileGuard>
        <Suspense fallback={<RouteFallback />}>
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
            <Route path="/my-goods" element={<MyGoods />} />
            <Route path="/goods/new" element={<CreateGood />} />
            <Route path="/goods/:id" element={<GoodDetail />} />
            <Route path="/jobs/new" element={<PostJob />} />
            <Route path="/my-jobs" element={<MyJobs />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/job-seeker" element={<JobSeekerDashboard />} />
            <Route path="/job-seeker-profile" element={<JobSeekerProfile />} />
            <Route path="/my-applications" element={<MyApplications />} />
            <Route path="/client-applications" element={<ClientApplications />} />
            <Route path="/saved-jobs" element={<SavedJobs />} />
            <Route path="/job-board" element={<JobBoard />} />
            <Route path="/jobs" element={<JobBoard />} />
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
            <Route path="/videos/record" element={<RecordVideo />} />
            <Route path="/user/:userId/videos" element={<UserVideos />} />
            <Route path="/help" element={<HelpCenter />} />
            <Route path="/upgrade" element={<Upgrade />} />
            <Route path="/go-live" element={<GoLive />} />
            <Route path="/live/:streamId" element={<LiveViewer />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/notification-settings" element={<NotificationSettings />} />
            <Route path="/payment-history" element={<PaymentHistory />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ProfileGuard>
      <RateUsDialog
        open={ratePrompt.open}
        onOpenChange={ratePrompt.setOpen}
        onDismiss={ratePrompt.dismiss}
        onRated={ratePrompt.markRated}
      />
    </>
  );
};

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" storageKey="servio-theme" enableSystem>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <LocationProvider>
            <AppInner />
          </LocationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
