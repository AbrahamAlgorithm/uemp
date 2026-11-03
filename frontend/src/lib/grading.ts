import type { Grade, GradeBand } from "./types";

export const GRADES: Grade[] = ["A", "B", "C", "D", "E", "F"];

function gradeFor(total: number, scale: GradeBand[]): GradeBand {
  const rounded = Math.round(total);
  return scale.find((band) => rounded >= band.min && rounded <= band.max) ?? scale[scale.length - 1];
}

// what submit will record: a blank score counts as 0 but stays blank on the sheet
export function previewResult(ca: number | null, exam: number | null, scale: GradeBand[]) {
  if (ca === null && exam === null) return null;
  const total = Math.round(((ca ?? 0) + (exam ?? 0)) * 100) / 100;
  const band = gradeFor(total, scale);
  return { total, grade: band.grade, gradePoint: band.point };
}

export function formatGpa(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}
