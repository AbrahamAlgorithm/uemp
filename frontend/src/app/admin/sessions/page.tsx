"use client";

import { CalendarDays, Plus } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { SessionFormDialog } from "@/components/forms/structure-dialogs";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { SEMESTER_LABELS } from "@/lib/constants";
import { formatDate, semesterLabel } from "@/lib/format";
import { withToast } from "@/lib/toast";
import type { Semester } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function SessionsPage() {
  const { data, error, reload } = useAsync(api.getSessions);
  const [adding, setAdding] = useState(false);
  const [target, setTarget] = useState<Semester | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={6} />;

  const setRegistration = async (semester: Semester, open: boolean) => {
    setToggling(semester.id);
    const done = await withToast(
      api.setRegistrationOpen(semester.id, open),
      `Registration ${open ? "opened" : "closed"} for ${semesterLabel(semester)}`,
    );
    setToggling(null);
    if (done) reload();
  };

  const makeCurrent = async () => {
    if (!target) return false;
    const done = await withToast(api.setCurrentSemester(target.id), `${semesterLabel(target)} is now current`);
    if (done) reload();
    return done;
  };

  return (
    <>
      <PageHeader
        title="Sessions and semesters"
        description="Registration and score entry always use the current semester."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus />
            Add session
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {data.map((session) => (
          <Card key={session.id} className={cn(session.isCurrent && "ring-primary/40")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" aria-hidden />
                {session.name}
              </CardTitle>
              <CardDescription>
                {formatDate(session.startDate)} to {formatDate(session.endDate)}
              </CardDescription>
              {session.isCurrent && (
                <CardAction>
                  <Badge>Current session</Badge>
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              <ul className="divide-y rounded-md border">
                {session.semesters.map((semester) => (
                  <li key={semester.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="font-medium">{SEMESTER_LABELS[semester.name]}</span>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-muted-foreground">
                        <Switch
                          checked={semester.registrationOpen}
                          disabled={toggling === semester.id}
                          onCheckedChange={(open) => setRegistration(semester, open)}
                          aria-label={`Registration open for ${semesterLabel(semester)}`}
                        />
                        Registration open
                      </label>
                      {semester.isCurrent ? (
                        <Badge variant="outline" className="border-primary/40 bg-accent text-accent-foreground">
                          Current
                        </Badge>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => setTarget(semester)}>
                          Set as current
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <SessionFormDialog open={adding} onOpenChange={setAdding} onSaved={reload} />
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        title={target ? `Make ${semesterLabel(target)} current?` : ""}
        description="Students will register for this semester's courses and lecturers will enter scores against it. The previous semester stops being current."
        confirmLabel="Set as current"
        onConfirm={makeCurrent}
      />
    </>
  );
}
