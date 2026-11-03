"use client";

import { Save, Send, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { ImportScoresDialog, TemplateDownload } from "@/components/score-import";
import { SheetBanner } from "@/components/sheet-banner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLeaveWarning } from "@/hooks/use-leave-warning";
import { api, errorMessage } from "@/lib/api";
import { CA_MAX, EXAM_MAX } from "@/lib/constants";
import { previewResult } from "@/lib/grading";
import type { GradeBand, ResultEntry, ResultSheet, ScoreInput } from "@/lib/types";
import { cn } from "@/lib/utils";

type Kind = "ca" | "exam";
type Draft = Record<number, Record<Kind, string>>;

const MAX: Record<Kind, number> = { ca: CA_MAX, exam: EXAM_MAX };
const LABEL: Record<Kind, string> = { ca: "CA", exam: "Exam" };
const LEAVE_MESSAGE = "You have unsaved scores. Leave this page without saving them?";

function parse(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

function validate(kind: Kind, value: string): string | null {
  const text = value.trim();
  if (text === "") return null;
  const number = Number(text);
  if (!Number.isFinite(number)) return "Enter a number";
  if (number < 0) return "Can't be negative";
  if (number > MAX[kind]) return `Max ${MAX[kind]}`;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return "Up to 2 decimals";
  return null;
}

const saved = (entry: ResultEntry) => ({ ca: entry.ca?.toString() ?? "", exam: entry.exam?.toString() ?? "" });

interface ScoreEntryProps {
  sheet: ResultSheet;
  scale: GradeBand[];
  onSaved: (sheet: ResultSheet) => void;
  onSubmitted: () => void;
}

export function ScoreEntry({ sheet, scale, onSaved, onSubmitted }: ScoreEntryProps) {
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [importing, setImporting] = useState(false);
  const [unsavedBeforeImport, setUnsavedBeforeImport] = useState(false);

  const rows = sheet.entries.map((entry) => {
    const values = draft[entry.registrationId] ?? saved(entry);
    const errors = { ca: validate("ca", values.ca), exam: validate("exam", values.exam) };
    const ca = parse(values.ca);
    const exam = parse(values.exam);
    const valid = !errors.ca && !errors.exam;
    const changed = { ca: valid && ca !== entry.ca, exam: valid && exam !== entry.exam };
    return {
      entry,
      values,
      errors,
      ca,
      exam,
      preview: valid ? previewResult(ca, exam, scale) : null,
      missing: (["ca", "exam"] as const).filter((kind) => (kind === "ca" ? ca : exam) === null),
      changed,
    };
  });
  const invalid = rows.some((row) => row.errors.ca || row.errors.exam);
  const changes: ScoreInput[] = rows
    .filter((row) => row.changed.ca || row.changed.exam)
    .map((row) => ({
      registrationId: row.entry.registrationId,
      ...(row.changed.ca ? { ca: row.ca } : {}),
      ...(row.changed.exam ? { exam: row.exam } : {}),
    }));
  const dirty = invalid || changes.length > 0;
  const blanks = rows.filter((row) => row.missing.length > 0);
  const scored = rows.length - blanks.length;

  useLeaveWarning(sheet.editable && dirty, LEAVE_MESSAGE);

  const update = (registrationId: number, kind: Kind, value: string, entry: ResultEntry) => {
    setDraft((current) => ({ ...current, [registrationId]: { ...(current[registrationId] ?? saved(entry)), [kind]: value } }));
  };

  const moveDown = (event: React.KeyboardEvent<HTMLInputElement>, index: number, kind: Kind) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const next = rows[index + 1];
    if (next) document.getElementById(`${kind}-${next.entry.registrationId}`)?.focus();
  };

  const persist = async () => {
    if (changes.length === 0) return sheet;
    const next = await api.saveScores(sheet.offeringId, changes);
    setDraft({});
    onSaved(next);
    return next;
  };

  const saveDraft = async () => {
    if (invalid) {
      toast.error("Fix the highlighted scores before saving.");
      return;
    }
    setSaving(true);
    try {
      await persist();
      toast.success("Draft saved");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    try {
      await persist();
      await api.submitSheet(sheet.offeringId, blanks.length > 0);
      toast.success(`${sheet.course.code} submitted for approval`);
      onSubmitted();
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  };

  const startImport = () => (dirty ? setUnsavedBeforeImport(true) : setImporting(true));

  const saveThenImport = async () => {
    if (invalid) {
      toast.error("Fix the highlighted scores, or discard them, before importing.");
      return;
    }
    setSaving(true);
    try {
      await persist();
      setUnsavedBeforeImport(false);
      setImporting(true);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const discardThenImport = () => {
    setDraft({});
    setUnsavedBeforeImport(false);
    setImporting(true);
  };

  const refresh = () =>
    api
      .getLecturerSheet(sheet.offeringId)
      .then(onSaved)
      .catch((error: unknown) => toast.error(errorMessage(error)));

  const openSubmit = () => {
    if (invalid) {
      toast.error("Fix the highlighted scores before submitting.");
      return;
    }
    setConfirming(true);
  };

  return (
    <div className="space-y-4">
      <SheetBanner sheet={sheet} audience="lecturer" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {sheet.editable
            ? "Type scores into the grid, or fill in the template and import it."
            : "Scores can't be changed or imported while the sheet is submitted or approved."}
        </p>
        <div className="flex flex-wrap gap-2">
          <TemplateDownload offeringId={sheet.offeringId} disabled={!sheet.editable} />
          <Button variant="outline" onClick={startImport} disabled={!sheet.editable || saving}>
            <Upload />
            Import scores
          </Button>
        </div>
      </div>

      <Card size="sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">#</TableHead>
              <TableHead>Matric no</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Dept</TableHead>
              <TableHead className="w-28">CA / {CA_MAX}</TableHead>
              <TableHead className="w-28">Exam / {EXAM_MAX}</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center">Grade</TableHead>
              <TableHead className="text-right">Point</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => {
              // the stored grade is what was submitted; while editing, the preview follows the grid
              const result = sheet.editable
                ? row.preview
                : row.entry.total === null
                  ? null
                  : { total: row.entry.total, grade: row.entry.grade, gradePoint: row.entry.gradePoint };
              const provisional = sheet.editable && row.missing.length > 0;
              return (
                <TableRow key={row.entry.registrationId}>
                  <TableCell className="text-muted-foreground tabular-nums">{index + 1}</TableCell>
                  <TableCell className="font-medium whitespace-nowrap">{row.entry.matricNumber}</TableCell>
                  <TableCell className="min-w-44">
                    <span className="flex items-center gap-2">
                      {row.entry.studentName}
                      {row.entry.isCarryOver && (
                        <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-700">
                          Carry-over
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.entry.department.code}</TableCell>
                  {(["ca", "exam"] as const).map((kind) => (
                    <TableCell key={kind} className="align-top">
                      {sheet.editable ? (
                        <div className="space-y-1">
                          <Input
                            id={`${kind}-${row.entry.registrationId}`}
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={MAX[kind]}
                            step="any"
                            value={row.values[kind]}
                            onChange={(event) => update(row.entry.registrationId, kind, event.target.value, row.entry)}
                            onKeyDown={(event) => moveDown(event, index, kind)}
                            aria-label={`${LABEL[kind]} score for ${row.entry.studentName}`}
                            aria-invalid={!!row.errors[kind]}
                            className={cn("h-8 w-20 text-right tabular-nums", row.changed[kind] && "border-amber-400")}
                          />
                          {row.errors[kind] && <p className="text-xs text-destructive">{row.errors[kind]}</p>}
                        </div>
                      ) : (
                        <span className="tabular-nums">{row.values[kind] || "—"}</span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className={cn("text-right font-medium tabular-nums", provisional && "text-muted-foreground")}>
                    {result?.total ?? "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-center font-semibold",
                      result?.grade === "F" && "text-destructive",
                      provisional && "opacity-60",
                    )}
                  >
                    {result?.grade ?? "—"}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums", provisional && "text-muted-foreground")}>
                    {result?.gradePoint ?? "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {sheet.editable && (
        <div className="sticky bottom-4 z-10 mt-4 flex flex-col gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">
              {scored} of {rows.length}
            </span>{" "}
            scored
            {dirty && <span className="ml-2 text-amber-700">· Unsaved changes</span>}
          </p>
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" onClick={saveDraft} disabled={saving || changes.length === 0}>
              {saving ? <Spinner /> : <Save />}
              Save draft
            </Button>
            <Button onClick={openSubmit} disabled={saving || rows.length === 0}>
              <Send />
              Submit for approval
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={unsavedBeforeImport} onOpenChange={(open) => !saving && setUnsavedBeforeImport(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save your changes first?</AlertDialogTitle>
            <AlertDialogDescription>
              The grid has scores you haven&apos;t saved. An import works from the saved sheet, so save or discard them before
              you import a file.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <Button variant="outline" onClick={discardThenImport} disabled={saving}>
              Discard changes
            </Button>
            <Button onClick={saveThenImport} disabled={saving}>
              {saving && <Spinner />}
              Save and continue
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportScoresDialog offeringId={sheet.offeringId} open={importing} onOpenChange={setImporting} onImported={refresh} />

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Submit ${sheet.course.code} results?`}
        description={
          blanks.length === 0
            ? `All ${rows.length} students have both scores. The department reviews the sheet next, and you can't edit it unless it's returned.`
            : `${blanks.length} of ${rows.length} students have a blank score. Blank scores will be recorded as 0, and you can't edit the sheet unless it's returned.`
        }
        confirmLabel={blanks.length === 0 ? "Submit" : "Submit with blanks as 0"}
        onConfirm={submit}
      >
        {blanks.length > 0 && (
          <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border text-sm">
            {blanks.map((row) => (
              <li key={row.entry.registrationId} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate">{row.entry.studentName}</span>
                  <span className="text-xs text-muted-foreground">{row.entry.matricNumber}</span>
                </span>
                <span className="shrink-0 text-xs text-amber-700">
                  No {row.missing.map((kind) => LABEL[kind]).join(" or ")} score
                </span>
              </li>
            ))}
          </ul>
        )}
      </ConfirmDialog>
    </div>
  );
}
