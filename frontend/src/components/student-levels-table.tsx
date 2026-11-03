import { ChevronRight, Users } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/states";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LevelSummary } from "@/lib/types";

interface StudentLevelsTableProps {
  levels: LevelSummary[];
  hrefFor: (level: number) => string;
}

export function StudentLevelsTable({ levels, hrefFor }: StudentLevelsTableProps) {
  return (
    <Card className="py-0">
      {levels.length === 0 ? (
        <EmptyState icon={Users} title="No students yet" description="Students appear here once they are added." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Level</TableHead>
              <TableHead>Entry session</TableHead>
              <TableHead className="text-right">Students</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Open</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {levels.map((row) => (
              <TableRow key={row.level} className="cursor-pointer">
                <TableCell className="font-medium">
                  <Link href={hrefFor(row.level)} className="after:absolute after:inset-0 relative block">
                    {row.level} level
                  </Link>
                </TableCell>
                <TableCell>{row.entrySessions.map((session) => `${session.name} (${session.studentCount})`).join(", ") || "—"}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{row.studentCount}</TableCell>
                <TableCell>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
