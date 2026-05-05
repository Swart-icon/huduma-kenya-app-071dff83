import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type RoleType = "provider" | "job_seeker";

export const SUBSCRIPTION_PRICES: Record<RoleType, number> = {
  provider: 200,
  job_seeker: 200,
};

export const useSubscription = (roleType?: RoleType) => {
  const { user, role } = useAuth();
  const effectiveRole = (roleType ?? role) as RoleType | null;

  return useQuery({
    queryKey: ["subscription", user?.id, effectiveRole],
    queryFn: async () => {
      if (!user || !effectiveRole || (effectiveRole !== "provider" && effectiveRole !== "job_seeker")) {
        return null;
      }
      const { data, error } = await supabase
        .from("premium_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("role_type", effectiveRole)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!effectiveRole,
    staleTime: 1000 * 60, // 1 min
  });
};

export const useIsPremium = (roleType?: RoleType) => {
  const { data, isLoading } = useSubscription(roleType);
  return { isPremium: !!data, loading: isLoading, expiresAt: data?.expires_at ?? null };
};
