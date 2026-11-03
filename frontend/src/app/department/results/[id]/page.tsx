"use client";

import { useParams } from "next/navigation";

import { ResultSheetReview } from "@/components/result-sheet-review";

export default function ReviewResultSheetPage() {
  const { id } = useParams<{ id: string }>();
  return <ResultSheetReview sheetId={Number(id)} back={{ href: "/department/results", label: "Result sheets" }} canApprove />;
}
