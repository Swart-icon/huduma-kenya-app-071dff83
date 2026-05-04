import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Wrench, ShoppingBag, Sparkles } from "lucide-react";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { useCategories } from "@/hooks/useCategories";
import { CategoryGridSkeleton } from "@/components/Skeletons";
import {
  DEFAULT_MARKETPLACE_MODE,
  MARKETPLACE_MODE_COPY,
  type MarketplaceMode,
  getMarketplaceCategories,
} from "@/lib/marketplace";

const Categories = () => {
  const navigate = useNavigate();
  const { data: categories = [], isLoading } = useCategories();
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<MarketplaceMode>(DEFAULT_MARKETPLACE_MODE);

  const filtered = useMemo(
    () => getMarketplaceCategories(categories, mode, search),
    [categories, mode, search],
  );

  return (
    <div className="min-h-screen bg-background px-6 py-6">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-muted-foreground">
          <ArrowLeft className="h-5 w-5" />
          <span>Dashboard</span>
        </button>

        <h1 className="mb-2 font-display text-2xl font-bold text-foreground">Browse Services</h1>
        <p className="mb-6 text-muted-foreground">Choose whether you want to hire providers or shop from sellers.</p>

        <div className="mb-6 grid grid-cols-2 gap-3">
          {(["services", "goods"] as MarketplaceMode[]).map((option) => {
            const active = mode === option;
            const Icon = option === "services" ? Wrench : ShoppingBag;
            const gradient =
              option === "services"
                ? "from-primary via-primary to-primary/80"
                : "from-accent via-accent to-accent/80";
            return (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                aria-pressed={active}
                className={`group relative overflow-hidden rounded-2xl p-4 text-left transition-all duration-300 ease-out ${
                  active
                    ? `bg-gradient-to-br ${gradient} text-primary-foreground shadow-lg shadow-primary/30 -translate-y-0.5 scale-[1.02] ring-2 ring-primary/40`
                    : "border border-border bg-card text-foreground hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
                }`}
              >
                {active && (
                  <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/20 blur-2xl" />
                )}
                <div className="relative flex items-center gap-2">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${
                      active ? "bg-white/20 backdrop-blur-sm" : "bg-primary/10"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? "text-primary-foreground" : "text-primary"}`} />
                  </span>
                  {active && <Sparkles className="ml-auto h-4 w-4 animate-pulse text-primary-foreground/90" />}
                </div>
                <div className="relative mt-3 text-sm font-bold leading-tight">
                  {MARKETPLACE_MODE_COPY[option].title}
                </div>
                <div
                  className={`relative mt-1 text-[11px] leading-relaxed ${
                    active ? "text-primary-foreground/85" : "text-muted-foreground"
                  }`}
                >
                  {MARKETPLACE_MODE_COPY[option].subtitle}
                </div>
              </button>
            );
          })}
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={mode === "goods" ? "Search goods categories..." : "Search service categories..."}
            className="h-12 rounded-xl pl-10"
          />
        </div>

        <p className="mb-6 text-xs text-muted-foreground">
          {mode === "goods"
            ? "Showing product-selling categories and seller marketplaces."
            : "Showing service-based categories and professional providers."}
        </p>

        {isLoading ? (
          <CategoryGridSkeleton count={12} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((cat) => (
              <Card
                key={`${mode}-${cat.id}`}
                className="cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98]"
                onClick={() => navigate(`/categories/${cat.slug}?mode=${mode}`)}
              >
                <CardContent className="p-4 text-center">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    {getCategoryIcon(cat.slug)}
                  </div>
                  <p className="text-sm font-semibold leading-tight text-foreground">{cat.displayName}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{cat.helperText}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <p className="mt-8 text-center text-muted-foreground">
            No {mode === "goods" ? "goods" : "service"} categories found
          </p>
        )}
      </div>
    </div>
  );
};

export default Categories;
