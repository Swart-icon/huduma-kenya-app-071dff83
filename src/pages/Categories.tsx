import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search } from "lucide-react";
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

        <div className="mb-6 rounded-2xl border border-border bg-card p-1 shadow-sm">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(["services", "goods"] as MarketplaceMode[]).map((option) => {
              const active = mode === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMode(option)}
                  className={`rounded-xl px-3 py-3 text-left transition-all duration-200 ${
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                  }`}
                >
                  <div className="text-sm font-semibold">{MARKETPLACE_MODE_COPY[option].title}</div>
                  <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {MARKETPLACE_MODE_COPY[option].subtitle}
                  </div>
                </button>
              );
            })}
          </div>
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
