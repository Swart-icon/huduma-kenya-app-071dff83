import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number;
};

export const useCategories = () => {
  return useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_categories")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 30, // 30 min — categories rarely change
    gcTime: 1000 * 60 * 60,
  });
};
