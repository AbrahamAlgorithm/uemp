"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { ChangePasswordButton } from "@/components/change-password";
import { StudentProfileDialog } from "@/components/forms/profile-form-dialog";
import { DetailList } from "@/components/detail-list";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { UserStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default function StudentProfilePage() {
  const { data, error, reload } = useAsync(api.getStudentProfile);
  const [editing, setEditing] = useState(false);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={6} />;

  return (
    <>
      <PageHeader
        title="Profile"
        description="You can edit your phone number, address and date of birth. Your department manages everything else."
        actions={
          <>
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil />
              Edit personal details
            </Button>
            <ChangePasswordButton />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                { label: "Full name", value: data.fullName },
                { label: "Gender", value: data.gender === "F" ? "Female" : data.gender === "M" ? "Male" : "" },
                { label: "Date of birth", value: data.dateOfBirth && data.dateOfBirth !== "null" ? formatDate(data.dateOfBirth) : "" },
                { label: "Email", value: data.email },
                { label: "Phone", value: data.phone },
                { label: "Address", value: data.address },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Academic details</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                { label: "Matric number", value: data.matricNumber },
                { label: "Status", value: <UserStatusBadge status={data.status} /> },
                { label: "Faculty", value: data.faculty.name },
                { label: "Department", value: data.department.name },
                { label: "Program", value: `${data.program.award} ${data.program.name}` },
                { label: "Level", value: `${data.level} level` },
                { label: "Entry session", value: data.entrySession },
              ]}
            />
          </CardContent>
        </Card>
      </div>
      <StudentProfileDialog
        open={editing}
        onOpenChange={setEditing}
        initial={{
          phone: data.phone,
          address: data.address,
          dateOfBirth: data.dateOfBirth && data.dateOfBirth !== "null" ? data.dateOfBirth : "",
        }}
        onSaved={reload}
      />
    </>
  );
}
