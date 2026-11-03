"use client";

import { ChevronDown, CircleAlert, Download } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, errorMessage } from "@/lib/api";
import type { ImportReport, ImportRow, ImportRowStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS: Record<ImportRowStatus, { label: string; className: string }> = {
  change: { label: "Change", className: "border-sky-300 bg-sky-50 text-sky-700" },
  unchanged: { label: "Unchanged", className: "border-border text-muted-foreground" },
  error: { label: "Error", className: "border-red-300 bg-red-50 text-red-700" },
};

const plural = (count: number, word: string) => `${count} ${count === 1 ? word : `${word}s`}`;
const show = (value: number | null) => (value === null ? "—" : String(value));

export function TemplateDownload({ offeringId, disabled }: { offeringId: number; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);

  const download = async (format: "xlsx" | "csv") => {
    setBusy(true);
    try {
      const { blob, filename } = await api.downloadScoreTemplate(offeringId, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-slot="button-group" className="flex">
      <Button variant="outline" className="rounded-r-none" onClick={() => download("xlsx")} disabled={busy || disabled}>
        {busy ? <Spinner /> : <Download />}
        Download template
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="rounded-l-none border-l-0"
            aria-label="Choose the template format"
            disabled={busy || disabled}
          >
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => download("xlsx")}>Excel workbook (.xlsx)</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => download("csv")}>CSV file (.csv)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Scores({ before, after, status }: { before: number | null; after: number | null; status: ImportRowStatus }) {
  if (status === "unchanged" || before === after) return <span className="tabular-nums">{show(after)}</span>;
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span className="text-muted-foreground">{show(before)}</span> → <span className="font-medium">{show(after)}</span>
    </span>
  );
}

function ReportTable({ rows }: { rows: ImportRow[] }) {
  return (
    <div className="max-h-80 overflow-y-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-14">Row</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>CA</TableHead>
            <TableHead>Exam</TableHead>
            <TableHead>Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.rowNumber} className={cn(row.status === "error" && "bg-red-50/60 hover:bg-red-50")}>
              <TableCell className="align-top text-muted-foreground tabular-nums">{row.rowNumber}</TableCell>
              <TableCell className="min-w-40 align-top">
                <p className="font-medium">{row.matricNumber || "—"}</p>
                {row.name && <p className="text-xs text-muted-foreground">{row.name}</p>}
              </TableCell>
              <TableCell className="align-top">
                <Scores before={row.caBefore} after={row.caAfter} status={row.status} />
              </TableCell>
              <TableCell className="align-top">
                <Scores before={row.examBefore} after={row.examAfter} status={row.status} />
              </TableCell>
              <TableCell className="min-w-44 align-top whitespace-normal">
                <Badge variant="outline" className={STATUS[row.status].className}>
                  {STATUS[row.status].label}
                </Badge>
                {row.error && <p className="mt-1 text-xs text-red-700">{row.error}</p>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface ImportScoresDialogProps {
  offeringId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function ImportScoresDialog({ offeringId, open, onOpenChange, onImported }: ImportScoresDialogProps) {
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<"checking" | "applying" | null>(null);

  const clear = () => {
    setFile(null);
    setReport(null);
    setProblem(null);
  };

  const close = (next: boolean) => {
    if (busy) return;
    if (!next) clear();
    onOpenChange(next);
  };

  const check = async (chosen: File) => {
    setFile(chosen);
    setReport(null);
    setProblem(null);
    setBusy("checking");
    try {
      setReport(await api.importScores(offeringId, chosen, true));
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    if (!file) return;
    setBusy("applying");
    try {
      const result = await api.importScores(offeringId, file, false);
      if (result.summary.errors) {
        setReport(result);
        toast.error("Some rows have errors, so nothing was imported.");
        return;
      }
      toast.success(`Imported scores for ${plural(result.summary.willChange, "student")}`);
      clear();
      onOpenChange(false);
      onImported();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const summary = report?.summary;
  const canApply = !!summary && summary.errors === 0 && summary.willChange > 0 && !busy;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import scores</DialogTitle>
          <DialogDescription>
            Use the template, or any .xlsx or .csv up to 1 MB with matric_no, ca and exam columns. Each row replaces both scores
            for that student and a blank cell clears a score; students left out of the file keep theirs. Nothing is saved until
            you apply the import.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor={inputId}>Score file</Label>
          <Input
            id={inputId}
            type="file"
            accept=".xlsx,.csv"
            disabled={!!busy}
            onClick={(event) => {
              event.currentTarget.value = "";
            }}
            onChange={(event) => {
              const chosen = event.target.files?.[0];
              if (chosen) check(chosen);
            }}
          />
        </div>

        {busy === "checking" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> Checking {file?.name}…
          </p>
        )}
        {problem && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{problem}</AlertDescription>
          </Alert>
        )}
        {report && summary && (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-medium">{plural(summary.rows, "row")}</span>
              <span className="text-muted-foreground">
                {" "}
                · {summary.willChange} will change · {summary.unchanged} unchanged ·{" "}
              </span>
              <span className={cn(summary.errors ? "font-medium text-red-700" : "text-muted-foreground")}>
                {plural(summary.errors, "error")}
              </span>
            </p>
            {report.rows.length > 0 ? (
              <ReportTable rows={report.rows} />
            ) : (
              <p className="text-sm text-muted-foreground">The file has no score rows under its header.</p>
            )}
            {summary.errors > 0 ? (
              <p className="text-sm text-red-700">Fix the rows marked Error and choose the file again. Nothing has been saved.</p>
            ) : (
              summary.willChange === 0 &&
              report.rows.length > 0 && <p className="text-sm text-muted-foreground">Every score in this file already matches the sheet.</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={!!busy}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={!canApply}>
            {busy === "applying" && <Spinner />}
            Apply import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
