"use client";

import { useParams } from "next/navigation";

import { ResultSheetReview } from "@/components/result-sheet-review";

export default function AdminResultSheetPage() {
  const { id } = useParams<{ id: string }>();
  return <ResultSheetReview sheetId={Number(id)} crumbs={[{ label: "Result oversight", href: "/admin/results" }]} canApprove={false} />;
}
