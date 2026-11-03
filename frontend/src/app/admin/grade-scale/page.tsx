"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Info, Pencil, RotateCcw, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { Controller, useForm, type Control } from "react-hook-form";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { gradeScaleSchema, type GradeScaleInput } from "@/lib/schemas";
import { withToast } from "@/lib/toast";
import type { GradeBand } from "@/lib/types";

export default function GradeScalePage() {
  const checkboxId = useId();
  const { data, error, reload, setData } = useAsync(api.getGradeScale);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<GradeBand[] | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [resetting, setResetting] = useState(false);
  const form = useForm<GradeScaleInput>({ resolver: zodResolver(gradeScaleSchema) });

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={6} />;

  const startEditing = () => {
    form.reset({ bands: data.bands });
    setEditing(true);
  };

  const closeSave = (open: boolean) => {
    if (open) return;
    setPending(null);
    setUnderstood(false);
  };

  const save = async () => {
    if (!pending) return false;
    const done = await withToast(api.updateGradeScale(pending).then(setData), "Grading scale updated");
    if (done) setEditing(false);
    return done;
  };

  const reset = () => withToast(api.resetGradeScale().then(setData), "Grading scale reset to the national default");

  return (
    <>
      <PageHeader
        title="Grading scale"
        description="The grades and grade points given to results when lecturers submit them."
        actions={
          !editing && (
            <>
              {!data.isDefault && (
                <Button variant="outline" onClick={() => setResetting(true)}>
                  <RotateCcw />
                  Reset to national default
                </Button>
              )}
              <Button variant="outline" onClick={startEditing}>
                <Pencil />
                Edit scale
              </Button>
            </>
          )
        }
      />
      <div className="max-w-2xl space-y-4">
        {editing ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900 *:data-[slot=alert-description]:text-amber-800">
            <TriangleAlert />
            <AlertTitle>Changing the grading scale is not advisable</AlertTitle>
            <AlertDescription>
              Changes apply only to results submitted from now on; submitted and approved results keep their grades.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-sky-200 bg-sky-50 text-sky-900 *:data-[slot=alert-description]:text-sky-800">
            <Info />
            <AlertTitle>{data.isDefault ? "National grading scale" : "Changed from the national scale"}</AlertTitle>
            <AlertDescription>
              {data.isDefault
                ? "This is the standard Nigerian 5-point grading scale. It is set by national policy and should not normally be changed."
                : "This scale differs from the standard Nigerian 5-point grading scale, which is set by national policy. Reset it unless the change was approved."}
            </AlertDescription>
          </Alert>
        )}

        <Card className="pb-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {editing ? "Edit bands" : "Current bands"}
              {data.isDefault && !editing && (
                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                  National default
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Bands run from 100 down to 0 with no gaps. GPA is the sum of units × points divided by total units.
            </CardDescription>
          </CardHeader>
          <form onSubmit={form.handleSubmit((values) => setPending(values.bands))} noValidate>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Grade</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Point</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.bands.map((band, index) => (
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
      </div>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={closeSave}
        title="Change the grading scale?"
        description="Results submitted from now on will be graded with these bands. Results already submitted or approved keep the grades they have."
        confirmLabel="Save scale"
        destructive
        confirmDisabled={!understood}
        onConfirm={save}
      >
        <div className="flex items-start gap-3 rounded-lg border px-3 py-3">
          <Checkbox id={checkboxId} checked={understood} onCheckedChange={(checked) => setUnderstood(checked === true)} />
          <label htmlFor={checkboxId} className="text-sm leading-snug">
            I understand this change affects how all future results are graded
          </label>
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        open={resetting}
        onOpenChange={setResetting}
        title="Reset to the national grading scale?"
        description="The bands go back to the standard Nigerian 5-point scale. Results already submitted or approved keep their grades."
        confirmLabel="Reset scale"
        onConfirm={reset}
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
