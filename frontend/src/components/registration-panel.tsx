"use client";

import { CircleAlert, ClipboardList, Info, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAsync } from "@/hooks/use-async";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { RegistrationOption } from "@/lib/types";
import { cn } from "@/lib/utils";

const LOCKED = "Your registration has been validated. Contact your department to make changes.";

function courseErrors(error: unknown): Record<number, string> | null {
  if (!(error instanceof ApiError) || error.status !== 400) return null;
  const perCourse = (error.data as { offering_ids?: unknown } | null)?.offering_ids;
  if (!perCourse || typeof perCourse !== "object" || Array.isArray(perCourse)) return null;
  return Object.fromEntries(Object.entries(perCourse).map(([id, message]) => [Number(id), String(message)]));
}

export function RegistrationPanel({ onChanged }: { onChanged: () => void }) {
  const { data, error, reload, setData } = useAsync(api.getRegistration);
  // null until the student changes something, so the server's selection (and its pre-ticked carry-overs) shows first
  const [picked, setPicked] = useState<Set<number> | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [started, setStarted] = useState(false);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={6} />;

  const status = data.registration?.status ?? null;
  const editable = data.registrationOpen && status !== "VALIDATED";
  const selected = picked ?? new Set(data.courses.filter((course) => course.isSelected).map((course) => course.offeringId));
  // once the window is closed or the form is validated, only what was actually registered is listed
  const shown = editable ? data.courses : status ? data.courses.filter((course) => course.isSelected) : [];
  const chosen = shown.filter((course) => selected.has(course.offeringId));
  const total = chosen.reduce((sum, course) => sum + course.units, 0);
  if (editable && status === null && !started) {
    return (
      <Card>
        <EmptyState
          icon={ClipboardList}
          title="Course registration is open"
          description="You haven't registered for this semester yet. Pick your courses and submit them for validation."
          action={<Button onClick={() => setStarted(true)}>Start course registration</Button>}
        />
      </Card>
    );
  }

  const overCap = (course: RegistrationOption) => !selected.has(course.offeringId) && total + course.units > data.maxUnits;

  const toggle = (course: RegistrationOption) => {
    if (!editable || overCap(course)) return;
    const next = new Set(selected);
    if (next.has(course.offeringId)) next.delete(course.offeringId);
    else next.add(course.offeringId);
    setPicked(next);
    setErrors((current) => {
      const next = { ...current };
      delete next[course.offeringId];
      return next;
    });
  };

  const submit = async () => {
    try {
      const saved = await api.submitRegistration(chosen.map((course) => course.offeringId));
      setData(saved);
      setPicked(null);
      setErrors({});
      onChanged();
      toast.success(`Registration submitted: ${chosen.length} ${chosen.length === 1 ? "course" : "courses"}, ${total} units`);
      return true;
    } catch (reason) {
      const perCourse = courseErrors(reason);
      if (perCourse) {
        setErrors(perCourse);
        toast.error("Some courses couldn't be registered. Check the highlighted rows.");
        return true;
      }
      toast.error(errorMessage(reason));
      // closed or validated in the meantime: show the page as it now stands
      if (reason instanceof ApiError && reason.status === 409) {
        reload();
        onChanged();
        return true;
      }
      return false;
    }
  };

  return (
    <>
      <div className="mb-6 space-y-3">
        {status === "VALIDATED" && (
          <Alert>
            <Lock />
            <AlertTitle>Registration validated</AlertTitle>
            <AlertDescription>{LOCKED}</AlertDescription>
          </Alert>
        )}
        {status !== "VALIDATED" && !data.registrationOpen && (
          <Alert>
            <Lock />
            <AlertTitle>Registration is closed</AlertTitle>
            <AlertDescription>Courses can&apos;t be added or dropped until your department reopens registration.</AlertDescription>
          </Alert>
        )}
        {status === "RETURNED" && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Returned by your department</AlertTitle>
            <AlertDescription>{data.registration?.returnReason || "Make the changes your department asked for and submit again."}</AlertDescription>
          </Alert>
        )}
        {status === "SUBMITTED" && editable && (
          <Alert>
            <Info />
            <AlertTitle>Awaiting validation</AlertTitle>
            <AlertDescription>You can still change your courses until your department validates them.</AlertDescription>
          </Alert>
        )}
      </div>

      {shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title={editable ? "No courses available" : "No courses registered"}
            description={
              editable
                ? "There are no courses open to your program and level this semester. Check with your department."
                : "Registration is closed and you didn't register any courses. Contact your department."
            }
          />
        </Card>
      ) : (
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_18rem]">
          <Card size="sm">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12">
                    <span className="sr-only">Select</span>
                  </TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Lecturer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((course) => {
                  const checked = selected.has(course.offeringId);
                  const blocked = editable && overCap(course);
                  const message = errors[course.offeringId];
                  const box = (
                    <Checkbox
                      checked={checked}
                      disabled={!editable || blocked}
                      onClick={(event) => event.stopPropagation()}
                      onCheckedChange={() => toggle(course)}
                      aria-label={`Select ${course.code}`}
                    />
                  );
                  return (
                    <TableRow
                      key={course.offeringId}
                      data-state={checked ? "selected" : undefined}
                      aria-disabled={!editable || blocked}
                      className={cn(
                        editable && !blocked && "cursor-pointer",
                        blocked && "opacity-50",
                        message && "bg-red-50 hover:bg-red-50",
                      )}
                      onClick={() => toggle(course)}
                    >
                      <TableCell>
                        {blocked ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span tabIndex={0} className="inline-flex">
                                {box}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Exceeds the {data.maxUnits}-unit limit</TooltipContent>
                          </Tooltip>
                        ) : (
                          box
                        )}
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          {course.code}
                          {course.isCarryOver && (
                            <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-700">
                              Carry-over
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-56">
                        {course.title}
                        {message && <p className="mt-0.5 text-xs font-medium text-destructive">{message}</p>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{course.units}</TableCell>
                      <TableCell className="tabular-nums">{course.level}</TableCell>
                      <TableCell className="whitespace-nowrap">{course.lecturer ?? "To be assigned"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          <Card className="h-fit 2xl:sticky 2xl:top-24">
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Total units</p>
                <p className="text-3xl font-semibold tabular-nums" aria-live="polite">
                  {total}
                  <span className="text-base font-normal text-muted-foreground"> / {data.maxUnits} units</span>
                </p>
              </div>
              <Progress value={Math.min(100, (total / data.maxUnits) * 100)} aria-label="Units against the semester limit" />
              <p className="text-sm text-muted-foreground">
                {chosen.length} {chosen.length === 1 ? "course" : "courses"} selected
              </p>
            </CardContent>
            {editable && (
              <CardFooter>
                <Button className="w-full" onClick={() => setConfirming(true)} disabled={chosen.length === 0}>
                  {status ? "Update registration" : "Submit registration"}
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Submit your registration?"
        description={`Your department will validate these ${chosen.length} ${chosen.length === 1 ? "course" : "courses"} before they appear on class lists.`}
        confirmLabel="Submit"
        onConfirm={submit}
      >
        <div className="rounded-lg border">
          <ul className="divide-y text-sm">
            {chosen.map((course) => (
              <li key={course.offeringId} className="flex justify-between gap-3 px-3 py-2">
                <span>
                  <span className="font-medium">{course.code}</span> {course.title}
                </span>
                <span className="tabular-nums">{course.units}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between border-t bg-muted/50 px-3 py-2 text-sm font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{total} units</span>
          </p>
        </div>
      </ConfirmDialog>
    </>
  );
}
