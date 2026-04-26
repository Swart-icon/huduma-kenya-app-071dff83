export type VideoItem = {
  id: string;
  user_id: string;
  title: string;
  category_id: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  status: string;
  created_at: string;
  allow_downloads?: boolean;
  profile?: { full_name: string | null; avatar_url: string | null } | null;
  category?: { name: string; icon: string | null } | null;
  providerPhone?: string | null;
  providerCity?: string | null;
  providerCounty?: string | null;
};

export type FeedTab = "all" | "nearby" | "jobseeker" | "client" | "service";
