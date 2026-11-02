"use client";

import { CircleAlert, ClipboardList } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { semesterLabel } from "@/lib/format";
import { withToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export default function CourseRegistrationPage() {
  const { data, error, reload } = useAsync(api.getRegistrationOptions);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={8} />;

  const registeredUnits = data.courses.filter((course) => course.registered).reduce((sum, course) => sum + course.units, 0);
  const selectedUnits = data.courses.filter((course) => selected.has(course.id)).reduce((sum, course) => sum + course.units, 0);
  const total = registeredUnits + selectedUnits;
  const over = total - data.maxUnits;

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    setSubmitting(true);
    const done = await withToast(
      api.registerCourses([...selected]),
      `Registered ${selected.size} ${selected.size === 1 ? "course" : "courses"} (${selectedUnits} units)`,
    );
    setSubmitting(false);
    if (done) {
      setSelected(new Set());
      reload();
    }
  };

  return (
    <>
      <PageHeader title="Course registration" description={semesterLabel(data.semester)} />

      {data.courses.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="No courses available"
            description="There are no courses open to your program and level this semester. Check with your department."
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 bg-muted/50">
                    <span className="sr-only">Select</span>
                  </TableHead>
                  <TableHead className="bg-muted/50 text-xs tracking-wide text-muted-foreground uppercase">Code</TableHead>
                  <TableHead className="bg-muted/50 text-xs tracking-wide text-muted-foreground uppercase">Title</TableHead>
                  <TableHead className="bg-muted/50 text-right text-xs tracking-wide text-muted-foreground uppercase">Units</TableHead>
                  <TableHead className="bg-muted/50 text-xs tracking-wide text-muted-foreground uppercase">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.courses.map((course) => {
                  const checked = course.registered || selected.has(course.id);
                  return (
                    <TableRow
                      key={course.id}
                      data-state={checked ? "selected" : undefined}
                      className={cn(!course.registered && "cursor-pointer")}
                      onClick={() => !course.registered && toggle(course.id)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          disabled={course.registered}
                          onClick={(event) => event.stopPropagation()}
                          onCheckedChange={() => toggle(course.id)}
                          aria-label={`Select ${course.code}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{course.code}</TableCell>
                      <TableCell className="min-w-56">{course.title}</TableCell>
                      <TableCell className="text-right tabular-nums">{course.units}</TableCell>
                      <TableCell>
                        {course.registered ? (
                          <Badge variant="secondary">Registered</Badge>
                        ) : selected.has(course.id) ? (
                          <Badge variant="outline" className="border-primary/40 text-primary">
                            Selected
                          </Badge>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          <Card className="h-fit lg:sticky lg:top-24">
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Total units</p>
                <p className={cn("text-3xl font-semibold tabular-nums", over > 0 && "text-destructive")}>
                  {total}
                  <span className="text-base font-normal text-muted-foreground"> / {data.maxUnits}</span>
                </p>
              </div>
              <Progress
                value={Math.min(100, (total / data.maxUnits) * 100)}
                className={cn(over > 0 && "[&>[data-slot=progress-indicator]]:bg-destructive")}
                aria-label="Units against the semester limit"
              />
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Already registered</dt>
                  <dd className="tabular-nums">{registeredUnits}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Selected now</dt>
                  <dd className="tabular-nums">{selectedUnits}</dd>
                </div>
              </dl>
              {over > 0 && (
                <Alert variant="destructive">
                  <CircleAlert />
                  <AlertTitle>Over the unit limit</AlertTitle>
                  <AlertDescription>
                    Remove {over} {over === 1 ? "unit" : "units"} to stay within {data.maxUnits}.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={submit} disabled={selected.size === 0 || over > 0 || submitting}>
                {submitting && <Spinner />}
                {selected.size ? `Register ${selected.size} ${selected.size === 1 ? "course" : "courses"}` : "Select courses"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </>
  );
}
