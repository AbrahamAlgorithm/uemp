"use client";

import { useParams } from "next/navigation";

import { ResultSheetReview } from "@/components/result-sheet-review";

export default function AdminResultSheetPage() {
  const { id } = useParams<{ id: string }>();
  return <ResultSheetReview sheetId={Number(id)} back={{ href: "/admin/results", label: "Result oversight" }} canApprove={false} />;
}
