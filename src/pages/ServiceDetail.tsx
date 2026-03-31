import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, MapPin, Phone, Mail, User, Tag, Calendar, MessageCircle } from "lucide-react";
import { getOrCreateConversation } from "@/lib/conversations";

type ServiceDetail = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  price_type: string;
  city: string | null;
  county: string | null;
  provider_id: string;
  category_id: string;
  created_at: string;
};

type ProviderInfo = {
  business_name: string;
  profile_image_url: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  availability_status: string;
};

type CategoryInfo = {
  name: string;
  icon: string | null;
};

const priceLabel = (price: number | null, type: string) => {
  if (!price) return "Price on request";
  const formatted = `KSh ${price.toLocaleString()}`;
  if (type === "starting_from") return `From ${formatted}`;
  if (type === "negotiable") return `${formatted} (negotiable)`;
  return formatted;
};

const BookButton = ({ serviceId }: { serviceId: string }) => {
  const { role } = useAuth();
  const navigate = useNavigate();
  if (role !== "client") return null;
  return (
    <Button onClick={() => navigate(`/book/${serviceId}`)} className="w-full h-14 text-lg font-bold rounded-xl" size="lg">
      <Calendar className="w-5 h-5 mr-2" /> Book This Service
    </Button>
  );
};

const MessageButton = ({ providerId }: { providerId: string }) => {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  if (!user || user.id === providerId || role === "provider") return null;

  const handleMessage = async () => {
    setLoading(true);
    const conversationId = await getOrCreateConversation(user.id, providerId);
    setLoading(false);
    if (conversationId) navigate(`/chat/${conversationId}`);
  };

  return (
    <Button onClick={handleMessage} disabled={loading} variant="outline" className="w-full h-14 text-lg font-bold rounded-xl" size="lg">
      <MessageCircle className="w-5 h-5 mr-2" /> {loading ? "Opening..." : "Message Provider"}
    </Button>
  );
};

const ServiceDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [category, setCategory] = useState<CategoryInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: svc } = await supabase
        .from("services")
        .select("*")
        .eq("id", id!)
        .maybeSingle();

      if (!svc) { setLoading(false); return; }
      setService(svc);

      // Fetch provider and category in parallel
      const [provRes, catRes] = await Promise.all([
        supabase.from("provider_profiles").select("business_name, profile_image_url, contact_phone, contact_email, availability_status").eq("user_id", svc.provider_id).maybeSingle(),
        supabase.from("service_categories").select("name, icon").eq("id", svc.category_id).maybeSingle(),
      ]);

      setProvider(provRes.data);
      setCategory(catRes.data);
      setLoading(false);
    };
    fetch();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-background px-6 py-8 text-center">
        <p className="text-muted-foreground">Service not found</p>
        <Button variant="link" onClick={() => navigate("/categories")}>Browse categories</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-6 pb-24">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        {/* Category badge */}
        {category && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary mb-3">
            <Tag className="w-3 h-3" />
            {category.icon} {category.name}
          </span>
        )}

        <h1 className="font-display text-2xl font-bold text-foreground mb-2">{service.title}</h1>

        {/* Price */}
        <p className="text-xl font-bold text-primary mb-4">
          {priceLabel(service.price, service.price_type)}
        </p>

        {/* Location */}
        {(service.city || service.county) && (
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <MapPin className="w-4 h-4" />
            <span className="text-sm">{[service.city, service.county].filter(Boolean).join(", ")}</span>
          </div>
        )}

        {/* Description */}
        {service.description && (
          <div className="mb-6">
            <h3 className="font-semibold text-foreground mb-2">About this service</h3>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{service.description}</p>
          </div>
        )}

        {/* Provider card */}
        {provider && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <h3 className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-3">Service Provider</h3>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden shrink-0">
                  {provider.profile_image_url ? (
                    <img src={provider.profile_image_url} alt={provider.business_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{provider.business_name}</p>
                  <span className={`text-xs font-medium ${provider.availability_status === 'available' ? 'text-primary' : 'text-muted-foreground'}`}>
                    {provider.availability_status === 'available' ? '🟢 Available' : provider.availability_status === 'busy' ? '🟡 Busy' : '🔴 Offline'}
                  </span>
                </div>
              </div>

              {provider.contact_phone && (
                <a href={`tel:${provider.contact_phone}`} className="flex items-center gap-2 text-sm text-foreground mb-2">
                  <Phone className="w-4 h-4 text-primary" /> {provider.contact_phone}
                </a>
              )}
              {provider.contact_email && (
                <a href={`mailto:${provider.contact_email}`} className="flex items-center gap-2 text-sm text-foreground">
                  <Mail className="w-4 h-4 text-primary" /> {provider.contact_email}
                </a>
              )}
            </CardContent>
          </Card>
        )}

        {/* Book & Contact CTAs */}
        <div className="space-y-3">
          <BookButton serviceId={service.id} />
          {provider?.contact_phone && (
            <Button asChild variant="outline" className="w-full h-14 text-lg font-bold rounded-xl" size="lg">
              <a href={`tel:${provider.contact_phone}`}>
                <Phone className="w-5 h-5 mr-2" />
                Call Provider
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceDetailPage;
