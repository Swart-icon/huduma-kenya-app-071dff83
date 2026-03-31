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
import NotFound from "./pages/NotFound";

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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
