"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { DetailList } from "@/components/detail-list";
import { FormDialog } from "@/components/form-dialog";
import { TextareaField, TextField } from "@/components/form-fields";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { UserStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { studentContactSchema, type StudentContactInput } from "@/lib/schemas";
import { withToast } from "@/lib/toast";

export default function StudentProfilePage() {
  const { data, error, reload } = useAsync(api.getStudentProfile);
  const [editing, setEditing] = useState(false);
  const form = useForm<StudentContactInput>({ resolver: zodResolver(studentContactSchema) });

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={6} />;

  const save = async (values: StudentContactInput) => {
    const saved = await withToast(api.updateStudentContact(values), "Contact details updated");
    if (saved) reload();
    return saved;
  };

  return (
    <>
      <PageHeader
        title="Profile"
        description="You can update your phone number and address. Your department handles any other changes."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              form.reset({ phone: data.phone, address: data.address });
              setEditing(true);
            }}
          >
            <Pencil />
            Edit contact details
          </Button>
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
                { label: "Gender", value: data.gender === "FEMALE" ? "Female" : "Male" },
                { label: "Date of birth", value: data.dateOfBirth && formatDate(data.dateOfBirth) },
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

      <FormDialog open={editing} onOpenChange={setEditing} title="Edit contact details" form={form} onSubmit={save}>
        <TextField control={form.control} name="phone" label="Phone number" type="tel" autoComplete="tel" />
        <TextareaField control={form.control} name="address" label="Address" />
      </FormDialog>
    </>
  );
}
