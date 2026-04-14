import { useState, useEffect, useRef, useMemo } from "react";
import { MapPin, Tag, FileText, Sparkles, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCategories } from "@/hooks/useCategories";
import { KENYAN_LOCATIONS } from "@/lib/kenyanLocations";

type Suggestion = {
  type: "category" | "location" | "keyword" | "correction";
  label: string;
  sublabel?: string;
};

type Props = {
  query: string;
  onSelect: (value: string) => void;
  visible: boolean;
};

const MAX_SUGGESTIONS = 7;

const iconMap: Record<Suggestion["type"], React.ReactNode> = {
  category: <Tag className="w-3.5 h-3.5 text-primary shrink-0" />,
  location: <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
  keyword: <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
  correction: <Search className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
};

const labelMap: Record<string, string> = {
  category: "Category",
  location: "Location",
  keyword: "Video",
  correction: "Did you mean?",
};

/* ─── Levenshtein distance for fuzzy matching ─── */
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

/* Threshold scales with word length */
const fuzzyMatch = (input: string, target: string): number => {
  const a = input.toLowerCase(), b = target.toLowerCase();
  if (b.includes(a)) return 0; // exact substring → perfect
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  // Allow ~30 % edits
  return dist <= Math.max(2, Math.floor(maxLen * 0.35)) ? dist : Infinity;
};

/* Find best fuzzy matches from a dictionary */
const fuzzyBest = (
  input: string,
  dict: { text: string; meta?: string }[],
  limit = 3,
): { text: string; meta?: string; dist: number }[] => {
  const scored = dict
    .map((d) => ({ ...d, dist: fuzzyMatch(input, d.text) }))
    .filter((d) => d.dist > 0 && d.dist < Infinity) // exclude exact & no-match
    .sort((a, b) => a.dist - b.dist);
  return scored.slice(0, limit);
};

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

export const VideoSearchSuggestions = ({ query, onSelect, visible }: Props) => {
  const { data: categories } = useCategories();
  const [videoTitles, setVideoTitles] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Fetch matching video titles with debounce
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
        .select("title")
        .eq("status", "active")
        .ilike("title", `%${trimmed}%`)
        .limit(5);
      const unique = [...new Set((data || []).map((v) => v.title).filter(Boolean))];
      setVideoTitles(unique.slice(0, 5));
    }, 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    const results: Suggestion[] = [];

    // ── Exact substring matches ──
    const catNames = (categories || []).map((c) => c.name);
    const exactCats = catNames.filter((n) => n.toLowerCase().includes(trimmed));
    exactCats.slice(0, 3).forEach((n) => results.push({ type: "category", label: n }));

    const exactLocs = KENYAN_LOCATIONS.filter(
      (l) => l.name.toLowerCase().includes(trimmed) || l.county.toLowerCase().includes(trimmed),
    );
    exactLocs.slice(0, 3).forEach((l) => results.push({ type: "location", label: l.name, sublabel: l.county }));

    const exactVids = videoTitles.filter((t) => t.toLowerCase().includes(trimmed));
    exactVids.slice(0, 3).forEach((t) => results.push({ type: "keyword", label: t }));

    // ── Fuzzy / "Did you mean?" when few exact matches ──
    if (results.length < 2 && trimmed.length >= 3) {
      const dict = [
        ...catNames.map((n) => ({ text: n, meta: "category" })),
        ...KENYAN_LOCATIONS.map((l) => ({ text: l.name, meta: "location" })),
        ...KENYAN_LOCATIONS.map((l) => ({ text: l.county, meta: "location" })),
      ];
      const corrections = fuzzyBest(trimmed, dict, 3);
      const seen = new Set(results.map((r) => r.label.toLowerCase()));
      corrections.forEach((c) => {
        if (!seen.has(c.text.toLowerCase())) {
          seen.add(c.text.toLowerCase());
          results.push({ type: "correction", label: c.text });
        }
      });
    }

    // Deduplicate by label
    const seen = new Set<string>();
    return results.filter((s) => {
      const key = s.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, MAX_SUGGESTIONS);
  }, [query, categories, videoTitles]);

  if (!visible || !query.trim() || suggestions.length === 0) return null;

  // Check if there's a "Did you mean?" correction to highlight
  const hasCorrection = suggestions.some((s) => s.type === "correction");

  return (
    <div className="absolute top-full left-0 right-0 mt-1 mx-1 bg-black/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="px-3 py-2 flex items-center gap-1.5 border-b border-white/5">
        <Sparkles className="w-3 h-3 text-primary" />
        <span className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Suggestions</span>
      </div>

      {/* "Did you mean?" banner when corrections exist */}
      {hasCorrection && (
        <div className="px-4 py-1.5 bg-rose-500/10 border-b border-white/5">
          <p className="text-[11px] text-rose-300 italic">Did you mean…</p>
        </div>
      )}

      {suggestions.map((s, i) => (
        <button
          key={`${s.type}-${s.label}-${i}`}
          onClick={() => onSelect(s.label)}
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
