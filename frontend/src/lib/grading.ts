import { CA_MAX, EXAM_MAX } from "./constants";
import type { Grade, GradeBand, GradeDistribution } from "./types";

export const DEFAULT_GRADE_SCALE: GradeBand[] = [
  { grade: "A", min: 70, max: 100, point: 5 },
  { grade: "B", min: 60, max: 69, point: 4 },
  { grade: "C", min: 50, max: 59, point: 3 },
  { grade: "D", min: 45, max: 49, point: 2 },
  { grade: "E", min: 40, max: 44, point: 1 },
  { grade: "F", min: 0, max: 39, point: 0 },
];

export const GRADES: Grade[] = ["A", "B", "C", "D", "E", "F"];

export function isValidCa(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0 && value <= CA_MAX;
}

export function isValidExam(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0 && value <= EXAM_MAX;
}

export function gradeFor(total: number, scale: GradeBand[]): GradeBand {
  const rounded = Math.round(total);
  return scale.find((band) => rounded >= band.min && rounded <= band.max) ?? scale[scale.length - 1];
}

export function scoreResult(ca: number | null, exam: number | null, scale: GradeBand[]) {
  if (!isValidCa(ca) || !isValidExam(exam)) return null;
  const total = ca + exam;
  const band = gradeFor(total, scale);
  return { total, grade: band.grade, gradePoint: band.point };
}

export function weightedAverage(items: { units: number; gradePoint: number }[]): number | null {
  const units = items.reduce((sum, item) => sum + item.units, 0);
  if (units === 0) return null;
  return items.reduce((sum, item) => sum + item.units * item.gradePoint, 0) / units;
}

export function formatGpa(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

export function emptyDistribution(): GradeDistribution {
  return { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
}

export function summarise(entries: { total: number | null; grade: Grade | null }[]) {
  const scored = entries.filter((entry) => entry.total !== null && entry.grade !== null);
  const distribution = emptyDistribution();
  for (const entry of scored) distribution[entry.grade!] += 1;
  if (scored.length === 0) {
    return { scored: 0, average: null, passRate: null, highest: null, lowest: null, distribution };
  }
  const totals = scored.map((entry) => entry.total!);
  return {
    scored: scored.length,
    average: totals.reduce((sum, total) => sum + total, 0) / totals.length,
    passRate: (scored.filter((entry) => entry.grade !== "F").length / scored.length) * 100,
    highest: Math.max(...totals),
    lowest: Math.min(...totals),
    distribution,
  };
}
