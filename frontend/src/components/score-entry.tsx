"use client";

import { Save, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { SheetBanner } from "@/components/sheet-banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { CA_MAX, EXAM_MAX } from "@/lib/constants";
import { scoreResult } from "@/lib/grading";
import { withToast } from "@/lib/toast";
import type { GradeBand, ResultSheet, ScoreInput } from "@/lib/types";
import { cn } from "@/lib/utils";

type Kind = "ca" | "exam";
type Draft = Record<number, Record<Kind, string>>;

const SCORE_SCHEMAS: Record<Kind, z.ZodNumber> = {
  ca: z.number().min(0, "Can't be negative").max(CA_MAX, `Max ${CA_MAX}`),
  exam: z.number().min(0, "Can't be negative").max(EXAM_MAX, `Max ${EXAM_MAX}`),
};

const HEAD = "bg-muted/50 text-xs tracking-wide text-muted-foreground uppercase";

function parse(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

function validate(kind: Kind, value: string): string | null {
  const number = parse(value);
  if (number === null) return null;
  const result = SCORE_SCHEMAS[kind].safeParse(number);
  return result.success ? null : (result.error.issues[0]?.message ?? "Invalid");
}

interface ScoreEntryProps {
  sheet: ResultSheet;
  scale: GradeBand[];
  onSubmitted: () => void;
}

export function ScoreEntry({ sheet, scale, onSubmitted }: ScoreEntryProps) {
  const editable = sheet.status === "DRAFT" || sheet.status === "REJECTED";
  const [draft, setDraft] = useState<Draft>(() =>
    Object.fromEntries(
      sheet.entries.map((entry) => [entry.studentId, { ca: entry.ca?.toString() ?? "", exam: entry.exam?.toString() ?? "" }]),
    ),
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const rows = sheet.entries.map((entry) => {
    const values = draft[entry.studentId]!;
    const errors = { ca: validate("ca", values.ca), exam: validate("exam", values.exam) };
    const result = errors.ca || errors.exam ? null : scoreResult(parse(values.ca), parse(values.exam), scale);
    return { entry, values, errors, result };
  });
  const invalid = rows.some((row) => row.errors.ca || row.errors.exam);
  const complete = rows.length > 0 && rows.every((row) => row.result);
  const scored = rows.filter((row) => row.result).length;

  const scores = (): ScoreInput[] =>
    rows.map((row) => ({ studentId: row.entry.studentId, ca: parse(row.values.ca), exam: parse(row.values.exam) }));

  const update = (studentId: number, kind: Kind, value: string) => {
    setDraft((current) => ({ ...current, [studentId]: { ...current[studentId]!, [kind]: value } }));
    setDirty(true);
  };

  const moveDown = (event: React.KeyboardEvent<HTMLInputElement>, index: number, kind: Kind) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const next = rows[index + 1];
    if (next) document.getElementById(`${kind}-${next.entry.studentId}`)?.focus();
  };

  const saveDraft = async () => {
    if (invalid) {
      toast.error("Fix the highlighted scores before saving.");
      return;
    }
    setSaving(true);
    const done = await withToast(api.saveScores(sheet.id, scores()), "Draft saved");
    setSaving(false);
    if (done) setDirty(false);
  };

  const submit = async () => {
    const done = await withToast(
      api.saveScores(sheet.id, scores()).then(() => api.submitSheet(sheet.id)),
      `${sheet.course.code} submitted for approval`,
    );
    if (done) {
      setDirty(false);
      onSubmitted();
    }
    return done;
  };

  return (
    <div className="space-y-4">
      <SheetBanner sheet={sheet} audience="lecturer" />

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(HEAD, "w-10")}>#</TableHead>
              <TableHead className={HEAD}>Matric no</TableHead>
              <TableHead className={HEAD}>Name</TableHead>
              <TableHead className={cn(HEAD, "w-28")}>CA / {CA_MAX}</TableHead>
              <TableHead className={cn(HEAD, "w-28")}>Exam / {EXAM_MAX}</TableHead>
              <TableHead className={cn(HEAD, "text-right")}>Total</TableHead>
              <TableHead className={cn(HEAD, "text-center")}>Grade</TableHead>
              <TableHead className={cn(HEAD, "text-right")}>Point</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={row.entry.studentId}>
                <TableCell className="text-muted-foreground tabular-nums">{index + 1}</TableCell>
                <TableCell className="font-medium whitespace-nowrap">{row.entry.matricNumber}</TableCell>
                <TableCell className="min-w-44">{row.entry.studentName}</TableCell>
                {(["ca", "exam"] as const).map((kind) => (
                  <TableCell key={kind} className="align-top">
                    {editable ? (
                      <div className="space-y-1">
                        <Input
                          id={`${kind}-${row.entry.studentId}`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={kind === "ca" ? CA_MAX : EXAM_MAX}
                          value={row.values[kind]}
                          onChange={(event) => update(row.entry.studentId, kind, event.target.value)}
                          onKeyDown={(event) => moveDown(event, index, kind)}
                          aria-label={`${kind === "ca" ? "CA" : "Exam"} score for ${row.entry.studentName}`}
                          aria-invalid={!!row.errors[kind]}
                          className="h-8 w-20 text-right tabular-nums"
                        />
                        {row.errors[kind] && <p className="text-xs text-destructive">{row.errors[kind]}</p>}
                      </div>
                    ) : (
                      <span className="tabular-nums">{row.values[kind] || "—"}</span>
                    )}
                  </TableCell>
                ))}
                <TableCell className="text-right font-medium tabular-nums">{row.result?.total ?? "—"}</TableCell>
                <TableCell className={cn("text-center font-semibold", row.result?.grade === "F" && "text-destructive")}>
                  {row.result?.grade ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.result?.gradePoint ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {editable && (
        <div className="sticky bottom-4 z-10 mt-4 flex flex-col gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">
              {scored} of {rows.length}
            </span>{" "}
            students scored
            {dirty && <span className="ml-2 text-amber-700">· Unsaved changes</span>}
          </p>
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" onClick={saveDraft} disabled={saving || !dirty}>
              {saving ? <Spinner /> : <Save />}
              Save draft
            </Button>
            <Button onClick={() => setConfirming(true)} disabled={!complete || invalid || saving}>
              <Send />
              Submit for approval
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Submit ${sheet.course.code} results?`}
        description={`All ${rows.length} scores will be sent to the department for approval. You won't be able to edit them unless the sheet is returned.`}
        confirmLabel="Submit"
        onConfirm={submit}
      />
    </div>
  );
}
