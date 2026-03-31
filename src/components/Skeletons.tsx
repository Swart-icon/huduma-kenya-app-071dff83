import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export const ServiceCardSkeleton = () => (
  <Card className="border-0 shadow-sm rounded-2xl">
    <CardContent className="p-4 space-y-2">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-4 w-14 rounded-full" />
      </div>
      <Skeleton className="h-3 w-2/5" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <div className="flex justify-between pt-1">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
    </CardContent>
  </Card>
);

export const CategoryGridSkeleton = ({ count = 8 }: { count?: number }) => (
  <div className="grid grid-cols-4 gap-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex flex-col items-center gap-1.5 p-2">
        <Skeleton className="w-11 h-11 rounded-xl" />
        <Skeleton className="h-3 w-12" />
      </div>
    ))}
  </div>
);

export const ProviderCardSkeleton = () => (
  <Card className="min-w-[160px] max-w-[160px] shrink-0 border-0 shadow-md rounded-2xl">
    <CardContent className="p-3 flex flex-col items-center">
      <Skeleton className="w-14 h-14 rounded-full mb-2" />
      <Skeleton className="h-3 w-20 mb-1" />
      <Skeleton className="h-2.5 w-14" />
    </CardContent>
  </Card>
);

export const ConversationSkeleton = () => (
  <Card className="border-0 shadow-sm rounded-2xl">
    <CardContent className="flex items-center gap-4 p-4">
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-2.5 w-16" />
      </div>
    </CardContent>
  </Card>
);

export const JobCardSkeleton = () => (
  <Card className="border-0 shadow-sm rounded-2xl">
    <CardContent className="p-4 space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-full" />
      <div className="flex gap-3 pt-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </CardContent>
  </Card>
);

export const ListSkeletons = ({
  Component,
  count = 5,
}: {
  Component: React.ComponentType;
  count?: number;
}) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <Component key={i} />
    ))}
  </div>
);
