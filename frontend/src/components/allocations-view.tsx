"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ListChecks, Plus, TriangleAlert, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormDialog } from "@/components/form-dialog";
import { SelectField } from "@/components/form-fields";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { UserStatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { withToast } from "@/lib/toast";
import type { CourseAllocation, Lecturer } from "@/lib/types";

const allocateSchema = z.object({
  offeringId: z.number({ error: "Select a course" }),
  lecturerId: z.number({ error: "Select a lecturer" }),
});
type AllocateInput = z.infer<typeof allocateSchema>;

interface Target {
  lecturer?: Lecturer;
  offering?: CourseAllocation;
}

export function AllocationsView({ departmentId }: { departmentId?: number }) {
  const { data, error, reload } = useAsync(
    () => Promise.all([api.getLecturers(departmentId), api.getUnallocated()]),
    departmentId ?? "own",
  );
  const [target, setTarget] = useState<Target | null>(null);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={8} />;

  const [lecturers, allUnallocated] = data;
  // a super admin looks at one department; the api already scopes a department admin
  const unallocated = departmentId ? allUnallocated.filter((row) => row.course.department.id === departmentId) : allUnallocated;
  const active = lecturers.filter((lecturer) => lecturer.status === "ACTIVE");

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Lecturers</h2>
        {lecturers.length === 0 ? (
          <Card>
            <EmptyState icon={UserRound} title="No lecturers" description="Add lecturers before allocating courses." />
          </Card>
        ) : (
          lecturers.map((lecturer) => (
            <Card key={lecturer.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-3">
                  {lecturer.title} {lecturer.fullName}
                  {lecturer.status !== "ACTIVE" && <UserStatusBadge status={lecturer.status} />}
                </CardTitle>
                <CardDescription>
                  {lecturer.staffId} · {lecturer.currentOfferings.length} {lecturer.currentOfferings.length === 1 ? "course" : "courses"} ·{" "}
                  {lecturer.totalUnits} units this semester
                </CardDescription>
                <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={lecturer.status !== "ACTIVE" || unallocated.length === 0}
                    onClick={() => setTarget({ lecturer })}
                  >
                    <Plus />
                    Allocate course
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {lecturer.currentOfferings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No courses this semester.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {lecturer.currentOfferings.map((offering) => (
                      <li key={offering.id}>
                        <Badge variant="secondary" title={offering.title} className="gap-1.5">
                          {offering.code}
                          <span className="font-normal text-muted-foreground">{offering.units}u</span>
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">Unallocated courses</h2>
        {unallocated.length === 0 ? (
          <Card>
            <EmptyState icon={ListChecks} title="Every course has a lecturer" description="Nothing is waiting to be allocated." />
          </Card>
        ) : (
          <>
            <Alert className="border-amber-200 bg-amber-50 text-amber-900 *:data-[slot=alert-description]:text-amber-800">
              <TriangleAlert />
              <AlertTitle>
                {unallocated.length} {unallocated.length === 1 ? "course has" : "courses have"} no lecturer
              </AlertTitle>
              <AlertDescription>Students can register for them, but nobody can enter their scores.</AlertDescription>
            </Alert>
            <Card className="py-0">
              <ul className="divide-y">
                {unallocated.map((offering) => (
                  <li key={offering.allocationId} className="flex items-center gap-3 px-6 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{offering.course.code}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {offering.course.title} · {offering.course.level} level · {offering.course.units} units
                      </p>
                    </div>
                    <Button size="sm" disabled={active.length === 0} onClick={() => setTarget({ offering })}>
                      Allocate
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </section>

      <AllocateDialog target={target} lecturers={active} unallocated={unallocated} onClose={() => setTarget(null)} onAllocated={reload} />
    </div>
  );
}

interface AllocateDialogProps {
  target: Target | null;
  lecturers: Lecturer[];
  unallocated: CourseAllocation[];
  onClose: () => void;
  onAllocated: () => void;
}

function AllocateDialog({ target, lecturers, unallocated, onClose, onAllocated }: AllocateDialogProps) {
  const form = useForm<AllocateInput>({ resolver: zodResolver(allocateSchema) });

  useEffect(() => {
    if (target) {
      form.reset({
        offeringId: target.offering?.allocationId ?? undefined,
        lecturerId: target.lecturer?.id,
      });
    }
  }, [target, form]);

  if (!target) return null;

  const save = async ({ offeringId, lecturerId }: AllocateInput) => {
    const offering = unallocated.find((row) => row.allocationId === offeringId);
    const lecturer = lecturers.find((row) => row.id === lecturerId);
    const done = await withToast(
      api.assignLecturer(offeringId, lecturerId),
      `${offering?.course.code ?? "Course"} allocated to ${lecturer?.fullName ?? "the lecturer"}`,
    );
    if (done) onAllocated();
    return done;
  };

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Allocate course"
      description="The lecturer will see the course and its class list this semester."
      form={form}
      onSubmit={save}
      submitLabel="Allocate"
    >
      {target.offering ? (
        <p className="text-sm">
          <span className="font-medium">{target.offering.course.code}</span> {target.offering.course.title}
        </p>
      ) : (
        <SelectField
          control={form.control}
          name="offeringId"
          label="Course"
          placeholder="Select a course"
          options={unallocated.map((row) => ({
            value: row.allocationId as number,
            label: `${row.course.code} · ${row.course.title}`,
          }))}
        />
      )}
      {target.lecturer ? (
        <p className="text-sm text-muted-foreground">
          To {target.lecturer.title} {target.lecturer.fullName} ({target.lecturer.totalUnits} units so far)
        </p>
      ) : (
        <SelectField
          control={form.control}
          name="lecturerId"
          label="Lecturer"
          placeholder="Select a lecturer"
          options={lecturers
            .filter((lecturer) => !target.offering || lecturer.department.id === target.offering.course.department.id)
            .map((lecturer) => ({ value: lecturer.id, label: `${lecturer.fullName} (${lecturer.totalUnits} units)` }))}
          description="Only active lecturers in the course's department are listed."
        />
      )}
    </FormDialog>
  );
}
