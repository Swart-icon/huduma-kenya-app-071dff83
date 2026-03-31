import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search } from "lucide-react";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { useCategories } from "@/hooks/useCategories";
import { CategoryGridSkeleton } from "@/components/Skeletons";

const Categories = () => {
  const navigate = useNavigate();
  const { data: categories = [], isLoading } = useCategories();
  const [search, setSearch] = useState("");

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background px-6 py-6">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          <span>Dashboard</span>
        </button>

        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Browse Services</h1>
        <p className="text-muted-foreground mb-6">Find what you need by category</p>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories..."
            className="h-12 rounded-xl pl-10"
          />
        </div>

        {isLoading ? (
          <CategoryGridSkeleton count={12} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((cat) => (
              <Card
                key={cat.id}
                className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
                onClick={() => navigate(`/categories/${cat.slug}`)}
              >
                <CardContent className="p-4 text-center">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2 mx-auto">{getCategoryIcon(cat.slug)}</div>
                  <p className="text-sm font-semibold text-foreground leading-tight">{cat.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <p className="text-center text-muted-foreground mt-8">No categories found</p>
        )}
      </div>
    </div>
  );
};

export default Categories;
