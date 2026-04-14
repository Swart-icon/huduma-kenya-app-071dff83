import { useState, useEffect, useRef, useMemo } from "react";
import { MapPin, Tag, FileText, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCategories } from "@/hooks/useCategories";
import { KENYAN_LOCATIONS } from "@/lib/kenyanLocations";

type Suggestion = {
  type: "category" | "location" | "keyword";
  label: string;
  sublabel?: string;
};

type Props = {
  query: string;
  onSelect: (value: string) => void;
  visible: boolean;
};

const MAX_SUGGESTIONS = 7;

const iconMap = {
  category: <Tag className="w-3.5 h-3.5 text-primary shrink-0" />,
  location: <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
  keyword: <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
};

const labelMap: Record<string, string> = {
  category: "Category",
  location: "Location",
  keyword: "Video",
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

    // Category matches
    (categories || [])
      .filter((c) => c.name.toLowerCase().includes(trimmed))
      .slice(0, 3)
      .forEach((c) => results.push({ type: "category", label: c.name }));

    // Location matches
    KENYAN_LOCATIONS
      .filter((l) => l.name.toLowerCase().includes(trimmed) || l.county.toLowerCase().includes(trimmed))
      .slice(0, 3)
      .forEach((l) => results.push({ type: "location", label: l.name, sublabel: l.county }));

    // Video title matches
    videoTitles
      .filter((t) => t.toLowerCase().includes(trimmed))
      .slice(0, 3)
      .forEach((t) => results.push({ type: "keyword", label: t }));

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

  return (
    <div className="absolute top-full left-0 right-0 mt-1 mx-1 bg-black/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="px-3 py-2 flex items-center gap-1.5 border-b border-white/5">
        <Sparkles className="w-3 h-3 text-primary" />
        <span className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Suggestions</span>
      </div>
      {suggestions.map((s, i) => (
        <button
          key={`${s.type}-${s.label}-${i}`}
          onClick={() => onSelect(s.label)}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 active:bg-white/15 transition-colors text-left"
        >
          {iconMap[s.type]}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{highlightMatch(s.label, query)}</p>
            {s.sublabel && (
              <p className="text-[11px] text-white/40 truncate">{s.sublabel}</p>
            )}
          </div>
          <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full shrink-0">
            {labelMap[s.type]}
          </span>
        </button>
      ))}
    </div>
  );
};
