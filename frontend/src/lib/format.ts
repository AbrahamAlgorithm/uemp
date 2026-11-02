import { SEMESTER_LABELS } from "./constants";
import type { Semester } from "./types";

const dateFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDate(value: string | null | undefined): string {
  return value ? dateFormat.format(new Date(value)) : "—";
}

export function formatDateTime(value: string | null | undefined): string {
  return value ? dateTimeFormat.format(new Date(value)) : "—";
}

export function semesterLabel(semester: Semester): string {
  return `${semester.session.name} · ${SEMESTER_LABELS[semester.name]}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter((part) => /^[A-Za-z]/.test(part) && !part.endsWith("."))
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(0)}%`;
}

export function formatScore(value: number | null): string {
  return value === null ? "—" : value.toFixed(1).replace(/\.0$/, "");
}
