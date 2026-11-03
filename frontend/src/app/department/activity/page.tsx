"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { ActivityFeed } from "@/components/activity-feed";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";

const PAGE_SIZE = 15;

export default function DepartmentActivityPage() {
  const [page, setPage] = useState(1);
  const { data, error, reload } = useAsync(() => api.getDepartmentActivity(page), page);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={8} />;

  const pages = Math.max(1, Math.ceil(data.count / PAGE_SIZE));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", href: "/department" }, { label: "Activity" }]}
        title="Activity"
        description="Submissions, approvals, registrations and changes in your department."
      />
      <Card>
        <CardContent>
          <ActivityFeed entries={data.results} />
        </CardContent>
      </Card>
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <p className="tabular-nums">
          {data.count} {data.count === 1 ? "event" : "events"}
        </p>
        <nav aria-label="Pagination" className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <span className="tabular-nums">
            Page {page} of {pages}
          </span>
          <Button variant="outline" size="icon-sm" onClick={() => setPage(page + 1)} disabled={page >= pages} aria-label="Next page">
            <ChevronRight />
          </Button>
        </nav>
      </div>
    </>
  );
}
