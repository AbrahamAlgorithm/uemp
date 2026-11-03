"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormDialog } from "@/components/form-dialog";
import { SelectField } from "@/components/form-fields";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { UserStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { withToast } from "@/lib/toast";
import type { DepartmentAdmin } from "@/lib/types";

const assignSchema = z.object({ userId: z.number({ error: "Select a staff member" }) });
type AssignInput = z.infer<typeof assignSchema>;

export function DepartmentAdmins({ departmentId }: { departmentId: number }) {
  const { data, error, reload } = useAsync(
    () => Promise.all([api.getDepartmentAdmins(departmentId), api.getLecturers(departmentId)]),
    departmentId,
  );
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState<DepartmentAdmin | null>(null);
  const form = useForm<AssignInput>({ resolver: zodResolver(assignSchema) });

  useEffect(() => {
    if (assigning) form.reset({});
  }, [assigning, form]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={3} />;

  const [admins, lecturers] = data;
  const candidates = lecturers.filter((lecturer) => lecturer.status === "ACTIVE");

  const assign = async ({ userId }: AssignInput) => {
    const name = candidates.find((lecturer) => lecturer.userId === userId)?.fullName ?? "Staff member";
    const done = await withToast(
      api.updateUserRole(userId, { role: "DEPT_ADMIN", departmentId }),
      `${name} is now an administrator of this department`,
    );
    if (done) reload();
    return done;
  };

  // the account stays, as a lecturer, so its audit trail and any results it submitted keep their owner
  const remove = async () => {
    if (!removing) return false;
    const done = await withToast(
      api.updateUserRole(removing.id, { role: "LECTURER", departmentId }),
      `${removing.name} is no longer an administrator`,
    );
    if (done) reload();
    return done;
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setAssigning(true)} disabled={candidates.length === 0}>
          <UserPlus />
          Assign administrator
        </Button>
      </div>
      <Card className="py-0">
        {admins.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No administrator"
            description="Nobody can validate registrations or approve results for this department until one is assigned."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Staff ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell>
                    <p className="font-medium">{admin.name}</p>
                    <p className="text-xs text-muted-foreground">{admin.email}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{admin.staffId ?? "—"}</TableCell>
                  <TableCell>
                    <UserStatusBadge status={admin.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setRemoving(admin)}>
                      <UserMinus />
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <FormDialog
        open={assigning}
        onOpenChange={setAssigning}
        title="Assign administrator"
        description="Pick a lecturer in this department. They keep their account and gain the department's admin tools."
        form={form}
        onSubmit={assign}
        submitLabel="Assign"
      >
        <SelectField
          control={form.control}
          name="userId"
          label="Staff member"
          placeholder="Select a lecturer"
          options={candidates.map((lecturer) => ({ value: lecturer.userId, label: `${lecturer.fullName} (${lecturer.staffId})` }))}
        />
      </FormDialog>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing ? `Remove ${removing.name} as administrator?` : ""}
        description="They become a lecturer in this department. Nothing is deleted."
        confirmLabel="Remove"
        destructive
        onConfirm={remove}
      />
    </>
  );
}
