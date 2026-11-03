"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { DetailList } from "@/components/detail-list";
import { FormDialog } from "@/components/form-dialog";
import { TextField } from "@/components/form-fields";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { UserStatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/constants";
import { initials } from "@/lib/format";
import { staffContactSchema, type StaffContactInput } from "@/lib/schemas";
import { withToast } from "@/lib/toast";

export function StaffProfileView() {
  const { data, error, reload } = useAsync(api.getStaffProfile);
  const [editing, setEditing] = useState(false);
  const form = useForm<StaffContactInput>({ resolver: zodResolver(staffContactSchema) });

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={4} />;

  const save = async (values: StaffContactInput) => {
    const saved = await withToast(api.updateStaffContact(values), "Contact details updated");
    if (saved) reload();
    return saved;
  };

  return (
    <>
      <PageHeader
        title="My profile"
        description="Contact the registry to change anything other than your contact details."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              form.reset({ phone: data.phone });
              setEditing(true);
            }}
          >
            <Pencil />
            Edit contact details
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-4 text-center">
            <Avatar className="size-16">
              <AvatarFallback className="bg-primary text-lg font-medium text-primary-foreground">
                {initials(data.fullName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{data.fullName}</p>
              <p className="text-sm text-muted-foreground">{ROLE_LABELS[data.role]}</p>
            </div>
            <UserStatusBadge status={data.status} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Staff record</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                { label: "Staff ID", value: data.staffId },
                { label: "Title", value: data.title },
                { label: "Department", value: data.department?.name },
                { label: "Faculty", value: data.faculty?.name },
                { label: "Email", value: data.email },
                { label: "Phone", value: data.phone },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <FormDialog
        open={editing}
        onOpenChange={setEditing}
        title="Edit contact details"
        form={form}
        onSubmit={save}
      >
        <TextField control={form.control} name="phone" label="Phone number" type="tel" autoComplete="tel" />
      </FormDialog>
    </>
  );
}
