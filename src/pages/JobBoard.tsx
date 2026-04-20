import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, MapPin, DollarSign, Search, Loader2, Send } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { JobCardSkeleton, ListSkeletons } from "@/components/Skeletons";
import { useUserRegion } from "@/hooks/useUserRegion";
import { RegionBadge } from "@/components/RegionBadge";

type JobPost = {
  id: string;
  title: string;
  description: string | null;
  budget: number | null;
  budget_type: string;
  city: string | null;
  county: string | null;
  status: string;
  created_at: string;
  category_id: string;
  location_rank?: number;
};

const PAGE_SIZE = 15;

const JobBoard = () => {
  const navigate = useNavigate();
  const { data: categoriesArr = [] } = useCategories();
  const region = useUserRegion();
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const categories = Object.fromEntries(categoriesArr.map((c) => [c.id, c]));

  useEffect(() => {
    setPage(0);
    fetchJobs(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, region.city, region.county]);

  const fetchJobs = async (pageNum: number, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);

    const { data, error } = await supabase.rpc("ranked_jobs", {
      _user_city: region.city,
      _user_county: region.county,
      _category_id: selectedCategory !== "all" ? selectedCategory : null,
      _limit_count: PAGE_SIZE,
      _offset_count: pageNum * PAGE_SIZE,
    });

    if (error) console.error("ranked_jobs error:", error);
    const results = (data as JobPost[]) || [];

    if (append) {
      setJobs((prev) => [...prev, ...results]);
    } else {
      setJobs(results);
    }
    setHasMore(results.length === PAGE_SIZE);
    if (append) setLoadingMore(false); else setLoading(false);
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchJobs(next, true);
  };

  const filtered = jobs.filter((j) =>
    j.title.toLowerCase().includes(search.toLowerCase()) ||
    (j.description || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background px-6 py-6 pb-24">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          <span>Dashboard</span>
        </button>

        <h1 className="font-display text-2xl font-bold text-foreground mb-1">Job Board</h1>
        {(region.city || region.county) && (
          <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            Showing jobs near {region.city || region.county} first
          </p>
        )}

        {/* Category Filter */}
        <div className="mb-3">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-12 rounded-xl">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categoriesArr.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search jobs..." className="h-12 rounded-xl pl-10" />
        </div>

        {loading ? (
          <ListSkeletons Component={JobCardSkeleton} count={5} />
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No open jobs found</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {filtered.map((job) => (
                <Card key={job.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      {categories[job.category_id] && (
                        <Badge variant="secondary" className="text-[10px]">
                          {categories[job.category_id].icon} {categories[job.category_id].name}
                        </Badge>
                      )}
                      {(region.city || region.county) && <RegionBadge rank={job.location_rank} />}
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">{job.title}</h3>
                    {job.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{job.description}</p>}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                      {(job.city || job.county) && (
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[job.city, job.county].filter(Boolean).join(", ")}</span>
                      )}
                      {job.budget && (
                        <span className="flex items-center gap-1 font-semibold text-foreground"><DollarSign className="w-3 h-3" />KSh {job.budget.toLocaleString()}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="rounded-xl flex-1 gap-1.5" onClick={() => navigate(`/jobs/${job.id}`)}>
                        <Send className="w-3.5 h-3.5" /> Apply
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => navigate(`/jobs/${job.id}`)}>
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {hasMore && (
              <div className="text-center mt-4">
                <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore} className="rounded-xl">
                  {loadingMore ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default JobBoard;
