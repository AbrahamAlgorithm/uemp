"use client";

import { BookOpen, Users } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { SheetStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { semesterLabel } from "@/lib/format";

export default function LecturerCoursesPage() {
  const { data, error, reload } = useAsync(api.getMyAllocations);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={4} />;

  return (
    <>
      <PageHeader
        title="My courses"
        description={data[0] ? semesterLabel(data[0].semester) : "Courses assigned to you this semester."}
      />
      {data.length === 0 ? (
        <Card>
          <EmptyState icon={BookOpen} title="No courses assigned" description="Your department hasn't assigned you any courses this semester." />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((course) => {
            const editable = course.sheetStatus === "DRAFT" || course.sheetStatus === "REJECTED";
            return (
              <Card key={course.allocationId}>
                <CardHeader>
                  <CardDescription className="flex items-center justify-between gap-2">
                    <span className="font-medium text-primary">{course.course.code}</span>
                    <SheetStatusBadge status={course.sheetStatus} />
                  </CardDescription>
                  <CardTitle className="text-base">{course.course.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex gap-4 text-muted-foreground">
                    <span>{course.course.units} units</span>
                    <span>{course.course.level} level</span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" aria-hidden />
                      {course.studentCount}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Scores entered</span>
                      <span className="tabular-nums">
                        {course.scoredCount}/{course.studentCount}
                      </span>
                    </div>
                    <Progress
                      value={course.studentCount ? (course.scoredCount / course.studentCount) * 100 : 0}
                      aria-label={`Scores entered for ${course.course.code}`}
                    />
                  </div>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/lecturer/courses/${course.allocationId}`}>Class list</Link>
                  </Button>
                  <Button size="sm" variant={editable ? "default" : "outline"} asChild>
                    <Link href={`/lecturer/courses/${course.allocationId}/scores`}>{editable ? "Enter scores" : "View scores"}</Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
