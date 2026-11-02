"use client";

import { Layers, Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { ProgramFormDialog } from "@/components/forms/program-form-dialog";
import { PageHeader } from "@/components/page-header";
import { useSession } from "@/components/session-provider";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import type { Program } from "@/lib/types";

export default function DepartmentProgramsPage() {
  const { user } = useSession();
  const { data, error, reload } = useAsync(api.getPrograms);
  const [editing, setEditing] = useState<Program | null>(null);
  const [open, setOpen] = useState(false);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={4} />;

  const edit = (program: Program | null) => {
    setEditing(program);
    setOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Programs and levels"
        description="Each program runs from 100 level to its final year."
        actions={
          <Button onClick={() => edit(null)}>
            <Plus />
            Add program
          </Button>
        }
      />
      {data.length === 0 ? (
        <Card>
          <EmptyState icon={Layers} title="No programs" description="Add the degree programs your department offers." />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((program) => (
            <Card key={program.id}>
              <CardHeader>
                <CardTitle>
                  {program.award} {program.name}
                </CardTitle>
                <CardDescription>
                  {program.durationYears} years · {program.courseCount} courses ·{" "}
                  {program.studentsByLevel.reduce((sum, row) => sum + row.count, 0)} students
                </CardDescription>
                <CardAction>
                  <Button variant="ghost" size="icon-sm" onClick={() => edit(program)} aria-label={`Edit ${program.name}`}>
                    <Pencil />
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {program.studentsByLevel.map(({ level, count }) => (
                    <li key={level} className="rounded-md border bg-muted/40 px-3 py-2 text-center">
                      <p className="text-xs text-muted-foreground">{level}L</p>
                      <p className="font-semibold tabular-nums">{count}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <ProgramFormDialog
        open={open}
        onOpenChange={setOpen}
        program={editing}
        defaultDepartmentId={user?.department?.id}
        onSaved={reload}
      />
    </>
  );
}
