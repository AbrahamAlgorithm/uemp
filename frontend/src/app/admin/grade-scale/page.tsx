"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, type Control } from "react-hook-form";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { gradeScaleSchema, type GradeScaleInput } from "@/lib/schemas";
import { withToast } from "@/lib/toast";
import type { GradeBand } from "@/lib/types";

const HEAD = "bg-muted/50 text-xs tracking-wide text-muted-foreground uppercase";

export default function GradeScalePage() {
  const { data, error, reload } = useAsync(api.getGradeScale);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<GradeBand[] | null>(null);
  const form = useForm<GradeScaleInput>({ resolver: zodResolver(gradeScaleSchema) });

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={6} />;

  const startEditing = () => {
    form.reset({ bands: data });
    setEditing(true);
  };

  const save = async () => {
    if (!pending) return false;
    const done = await withToast(api.updateGradeScale(pending), "Grade scale updated");
    if (done) {
      setEditing(false);
      reload();
    }
    return done;
  };

  return (
    <>
      <PageHeader
        title="Grade scale"
        description="Used to grade every result and calculate GPA on a 5-point scale."
        actions={
          !editing && (
            <Button variant="outline" onClick={startEditing}>
              <Pencil />
              Edit scale
            </Button>
          )
        }
      />
      <Card className="max-w-2xl pb-0">
        <CardHeader>
          <CardTitle>{editing ? "Edit bands" : "Current bands"}</CardTitle>
          <CardDescription>
            Bands run from 100 down to 0 with no gaps. GPA is the sum of units × points divided by total units.
          </CardDescription>
        </CardHeader>
        <form onSubmit={form.handleSubmit((values) => setPending(values.bands))} noValidate>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={HEAD}>Grade</TableHead>
                <TableHead className={HEAD}>From</TableHead>
                <TableHead className={HEAD}>To</TableHead>
                <TableHead className={HEAD}>Point</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((band, index) => (
                <TableRow key={band.grade}>
                  <TableCell className="text-base font-semibold">{band.grade}</TableCell>
                  {(["min", "max", "point"] as const).map((key) => (
                    <TableCell key={key} className="align-top">
                      {editing ? (
                        <BandInput control={form.control} index={index} field={key} grade={band.grade} />
                      ) : (
                        <span className="tabular-nums">{band[key]}</span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {editing && (
            <CardContent className="flex flex-row justify-end gap-2 border-t py-4">
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="submit">Save scale</Button>
            </CardContent>
          )}
        </form>
      </Card>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Change the grade scale?"
        description="Grades and GPAs are recalculated with the new bands everywhere, including results that are already approved."
        confirmLabel="Save scale"
        onConfirm={save}
      />
    </>
  );
}

const LABELS = { min: "lowest score", max: "highest score", point: "grade point" };

function BandInput({
  control,
  index,
  field,
  grade,
}: {
  control: Control<GradeScaleInput>;
  index: number;
  field: "min" | "max" | "point";
  grade: string;
}) {
  return (
    <Controller
      control={control}
      name={`bands.${index}.${field}`}
      render={({ field: input, fieldState }) => (
        <div className="space-y-1">
          <Input
            type="number"
            inputMode="numeric"
            name={input.name}
            ref={input.ref}
            onBlur={input.onBlur}
            value={Number.isNaN(input.value) ? "" : input.value}
            onChange={(event) => input.onChange(event.target.valueAsNumber)}
            aria-label={`${grade} ${LABELS[field]}`}
            aria-invalid={fieldState.invalid}
            className="h-8 w-20 tabular-nums"
          />
          {fieldState.error && <p className="max-w-40 text-xs text-destructive">{fieldState.error.message}</p>}
        </div>
      )}
    />
  );
}
