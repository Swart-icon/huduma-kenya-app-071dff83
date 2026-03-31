import { supabase } from "@/integrations/supabase/client";

/**
 * Get or create a conversation between two users.
 * Ensures participant_one < participant_two for uniqueness.
 */
export const getOrCreateConversation = async (
  currentUserId: string,
  otherUserId: string,
  bookingId?: string
): Promise<string | null> => {
  const [p1, p2] = currentUserId < otherUserId
    ? [currentUserId, otherUserId]
    : [otherUserId, currentUserId];

  // Check existing
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("participant_one", p1)
    .eq("participant_two", p2)
    .maybeSingle();

  if (existing) return existing.id;

  // Create new
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      participant_one: p1,
      participant_two: p2,
      ...(bookingId ? { booking_id: bookingId } : {}),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating conversation:", error);
    return null;
  }

  return data.id;
};
