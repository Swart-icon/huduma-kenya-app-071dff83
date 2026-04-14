import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { MapPin, Tag, FileText, Sparkles, Search, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCategories } from "@/hooks/useCategories";
import { KENYAN_LOCATIONS } from "@/lib/kenyanLocations";
import { useLocation } from "@/contexts/LocationContext";
import { getDistanceKm } from "@/hooks/useGeolocation";

type Suggestion = {
  type: "category" | "location" | "keyword" | "correction" | "recent";
  label: string;
  sublabel?: string;
  score: number; // higher = better
};

type Props = {
  query: string;
  onSelect: (value: string) => void;
  visible: boolean;
};

const MAX_SUGGESTIONS = 8;
const HISTORY_KEY = "huduma_search_history";
const MAX_HISTORY = 10;

/* ─── Search history helpers ─── */
const getSearchHistory = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]").slice(0, MAX_HISTORY);
  } catch { return []; }
};

export const saveSearchTerm = (term: string) => {
  if (!term.trim()) return;
  const history = getSearchHistory().filter((h) => h.toLowerCase() !== term.toLowerCase());
  history.unshift(term.trim());
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
};

const iconMap: Record<Suggestion["type"], React.ReactNode> = {
  category: <Tag className="w-3.5 h-3.5 text-primary shrink-0" />,
  location: <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
  keyword: <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
  correction: <Search className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
  recent: <Clock className="w-3.5 h-3.5 text-white/50 shrink-0" />,
};

const labelMap: Record<string, string> = {
  category: "Category",
  location: "Location",
  keyword: "Video",
  correction: "Did you mean?",
  recent: "Recent",
};

/* ─── Levenshtein ─── */
const levenshtein = (a: string, b: string): number => {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
};

const fuzzyMatch = (input: string, target: string): number => {
  const a = input.toLowerCase(), b = target.toLowerCase();
  if (b.includes(a)) return 0;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return dist <= Math.max(2, Math.floor(maxLen * 0.35)) ? dist : Infinity;
};

const fuzzyBest = (
  input: string,
  dict: { text: string }[],
  limit = 3,
) => dict
  .map((d) => ({ ...d, dist: fuzzyMatch(input, d.text) }))
  .filter((d) => d.dist > 0 && d.dist < Infinity)
  .sort((a, b) => a.dist - b.dist)
  .slice(0, limit);

const highlightMatch = (text: string, query: string) => {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-primary font-semibold">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
};

/* ─── Category popularity cache (video counts) ─── */
type CatPopularity = Record<string, number>;

export const VideoSearchSuggestions = ({ query, onSelect, visible }: Props) => {
  const { data: categories } = useCategories();
  const { location: userLocation } = useLocation();
  const [videoTitles, setVideoTitles] = useState<{ title: string; views: number; likes: number }[]>([]);
  const [catPopularity, setCatPopularity] = useState<CatPopularity>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Fetch category popularity once
  useEffect(() => {
    supabase
      .from("videos")
      .select("category_id")
      .eq("status", "active")
      .then(({ data }) => {
        const counts: CatPopularity = {};
        (data || []).forEach((v) => {
          if (v.category_id) counts[v.category_id] = (counts[v.category_id] || 0) + 1;
        });
        setCatPopularity(counts);
      });
  }, []);

  // Fetch matching video titles with engagement data
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setVideoTitles([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from("videos")
        .select("title, view_count, like_count")
        .eq("status", "active")
        .ilike("title", `%${trimmed}%`)
        .order("view_count", { ascending: false })
        .limit(8);
      const seen = new Set<string>();
      const unique = (data || []).filter((v) => {
        const key = v.title.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setVideoTitles(unique.slice(0, 5).map((v) => ({
        title: v.title,
        views: v.view_count || 0,
        likes: v.like_count || 0,
      })));
    }, 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  /* ─── Score a location by proximity to user ─── */
  const locationScore = useCallback((locName: string): number => {
    if (!userLocation) return 0;
    const loc = KENYAN_LOCATIONS.find((l) => l.name.toLowerCase() === locName.toLowerCase());
    if (!loc) return 0;
    const dist = getDistanceKm(userLocation.latitude, userLocation.longitude, loc.lat, loc.lng);
    // Closer = higher score. Max 50 pts for <5km, decaying
    if (dist < 5) return 50;
    if (dist < 20) return 40;
    if (dist < 50) return 30;
    if (dist < 100) return 15;
    return 5;
  }, [userLocation]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const trimmed = query.trim().toLowerCase();
    const results: Suggestion[] = [];

    // ── Recent searches (show when empty query) ──
    if (!trimmed) {
      getSearchHistory().slice(0, 5).forEach((h, i) => {
        results.push({ type: "recent", label: h, score: 100 - i });
      });
      return results.slice(0, MAX_SUGGESTIONS);
    }

    // ── Category matches (scored by popularity) ──
    const catNames = (categories || []);
    catNames
      .filter((c) => c.name.toLowerCase().includes(trimmed))
      .forEach((c) => {
        const popularity = catPopularity[c.id] || 0;
        // Base 60 for exact match + popularity bonus (max ~30) + sort order bonus
        results.push({
          type: "category",
          label: c.name,
          score: 60 + Math.min(popularity * 2, 30) + (10 - c.sort_order * 0.5),
        });
      });

    // ── Location matches (scored by proximity) ──
    KENYAN_LOCATIONS
      .filter((l) => l.name.toLowerCase().includes(trimmed) || l.county.toLowerCase().includes(trimmed))
      .forEach((l) => {
        const proxScore = locationScore(l.name);
        results.push({
          type: "location",
          label: l.name,
          sublabel: l.county,
          score: 50 + proxScore,
        });
      });

    // ── Video title matches (scored by engagement) ──
    videoTitles
      .filter((t) => t.title.toLowerCase().includes(trimmed))
      .forEach((t) => {
        const engagement = Math.min(Math.log2((t.views || 1) + (t.likes || 1) * 5) * 5, 30);
        results.push({
          type: "keyword",
          label: t.title,
          sublabel: `${t.views} views · ${t.likes} likes`,
          score: 40 + engagement,
        });
      });

    // ── Boost results matching recent searches ──
    const history = getSearchHistory().map((h) => h.toLowerCase());
    results.forEach((r) => {
      if (history.some((h) => r.label.toLowerCase().includes(h) || h.includes(r.label.toLowerCase()))) {
        r.score += 15; // recency boost
      }
    });

    // ── Fuzzy / "Did you mean?" when few exact matches ──
    if (results.length < 2 && trimmed.length >= 3) {
      const dict = [
        ...catNames.map((c) => ({ text: c.name })),
        ...KENYAN_LOCATIONS.map((l) => ({ text: l.name })),
        ...KENYAN_LOCATIONS.map((l) => ({ text: l.county })),
      ];
      const corrections = fuzzyBest(trimmed, dict, 3);
      const seen = new Set(results.map((r) => r.label.toLowerCase()));
      corrections.forEach((c) => {
        if (!seen.has(c.text.toLowerCase())) {
          seen.add(c.text.toLowerCase());
          results.push({ type: "correction", label: c.text, score: 30 - c.dist * 5 });
        }
      });
    }

    // Sort by score descending, deduplicate
    results.sort((a, b) => b.score - a.score);
    const seen = new Set<string>();
    return results.filter((s) => {
      const key = s.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, MAX_SUGGESTIONS);
  }, [query, categories, videoTitles, catPopularity, locationScore]);

  if (!visible || suggestions.length === 0) return null;

  const hasCorrection = suggestions.some((s) => s.type === "correction");
  const isRecent = suggestions.length > 0 && suggestions[0].type === "recent";

  return (
    <div className="absolute top-full left-0 right-0 mt-1 mx-1 bg-black/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="px-3 py-2 flex items-center gap-1.5 border-b border-white/5">
        {isRecent ? (
          <Clock className="w-3 h-3 text-white/40" />
        ) : (
          <Sparkles className="w-3 h-3 text-primary" />
        )}
        <span className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
          {isRecent ? "Recent Searches" : "Suggestions"}
        </span>
      </div>

      {hasCorrection && (
        <div className="px-4 py-1.5 bg-rose-500/10 border-b border-white/5">
          <p className="text-[11px] text-rose-300 italic">Did you mean…</p>
        </div>
      )}

      {suggestions.map((s, i) => (
        <button
          key={`${s.type}-${s.label}-${i}`}
          onClick={() => {
            saveSearchTerm(s.label);
            onSelect(s.label);
          }}
          className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 active:bg-white/15 transition-colors text-left ${
            s.type === "correction" ? "bg-rose-500/5" : ""
          }`}
        >
          {iconMap[s.type]}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">
              {s.type === "correction" ? (
                <span className="text-rose-300 font-medium">{s.label}</span>
              ) : (
                highlightMatch(s.label, query)
              )}
            </p>
            {s.sublabel && (
              <p className="text-[11px] text-white/40 truncate">{s.sublabel}</p>
            )}
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
            s.type === "correction"
              ? "text-rose-300/70 bg-rose-500/10"
              : "text-white/30 bg-white/5"
          }`}>
            {labelMap[s.type]}
          </span>
        </button>
      ))}
    </div>
  );
};
