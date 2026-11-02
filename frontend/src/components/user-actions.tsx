"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, Ellipsis, Eye, UserCheck, UserCog, UserX } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormDialog } from "@/components/form-dialog";
import { SelectField } from "@/components/form-fields";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { ROLE_LABELS, USER_STATUS_LABELS } from "@/lib/constants";
import { userRoleSchema, type UserRoleInput } from "@/lib/schemas";
import { withToast } from "@/lib/toast";
import type { CodedRef, UserAccount, UserStatus } from "@/lib/types";

const STATUS_ACTIONS: Record<UserStatus, { verb: string; description: string; icon: typeof UserCheck }> = {
  ACTIVE: { verb: "Activate", description: "They'll be able to sign in again.", icon: UserCheck },
  INACTIVE: { verb: "Deactivate", description: "They won't be able to sign in until the account is activated.", icon: UserX },
  SUSPENDED: { verb: "Suspend", description: "They'll be blocked from signing in. Use this for disciplinary holds.", icon: Ban },
};

interface UserActionsProps {
  user: UserAccount;
  departments: CodedRef[];
  onChanged: () => void;
  showView?: boolean;
}

export function UserActions({ user, departments, onChanged, showView }: UserActionsProps) {
  const { user: me } = useSession();
  const [nextStatus, setNextStatus] = useState<UserStatus | null>(null);
  const [roleOpen, setRoleOpen] = useState(false);
  const isSelf = me?.id === user.id;

  const changeStatus = async () => {
    if (!nextStatus) return false;
    const done = await withToast(
      api.updateUserStatus(user.id, nextStatus),
      `${user.fullName} is now ${USER_STATUS_LABELS[nextStatus].toLowerCase()}`,
    );
    if (done) onChanged();
    return done;
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {showView ? (
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${user.fullName}`}>
              <Ellipsis />
            </Button>
          ) : (
            <Button variant="outline">
              <UserCog />
              Manage account
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {showView && (
            <>
              <DropdownMenuItem asChild>
                <Link href={`/admin/users/${user.id}`}>
                  <Eye />
                  View details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {(Object.keys(STATUS_ACTIONS) as UserStatus[])
            .filter((status) => status !== user.status)
            .map((status) => {
              const action = STATUS_ACTIONS[status];
              return (
                <DropdownMenuItem key={status} disabled={isSelf} onSelect={() => setNextStatus(status)}>
                  <action.icon />
                  {action.verb}
                </DropdownMenuItem>
              );
            })}
          {user.role !== "STUDENT" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={isSelf} onSelect={() => setRoleOpen(true)}>
                <UserCog />
                Change role or department
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={nextStatus !== null}
        onOpenChange={(open) => !open && setNextStatus(null)}
        title={nextStatus ? `${STATUS_ACTIONS[nextStatus].verb} ${user.fullName}?` : ""}
        description={nextStatus ? STATUS_ACTIONS[nextStatus].description : ""}
        confirmLabel={nextStatus ? STATUS_ACTIONS[nextStatus].verb : "Confirm"}
        destructive={nextStatus !== "ACTIVE"}
        onConfirm={changeStatus}
      />
      <RoleDialog open={roleOpen} onOpenChange={setRoleOpen} user={user} departments={departments} onSaved={onChanged} />
    </>
  );
}

interface RoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserAccount;
  departments: CodedRef[];
  onSaved: () => void;
}

function RoleDialog({ open, onOpenChange, user, departments, onSaved }: RoleDialogProps) {
  const form = useForm<UserRoleInput>({ resolver: zodResolver(userRoleSchema) });
  const role = useWatch({ control: form.control, name: "role" });

  useEffect(() => {
    if (open) form.reset({ role: user.role, departmentId: user.department?.id ?? null });
  }, [open, user, form]);

  const save = async (values: UserRoleInput) => {
    const done = await withToast(api.updateUserRole(user.id, values), `${user.fullName} updated`);
    if (done) onSaved();
    return done;
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change role or department"
      description={user.fullName}
      form={form}
      onSubmit={save}
    >
      <SelectField
        control={form.control}
        name="role"
        label="Role"
        options={(["LECTURER", "DEPT_ADMIN", "SUPER_ADMIN"] as const).map((value) => ({ value, label: ROLE_LABELS[value] }))}
      />
      {role !== "SUPER_ADMIN" && (
        <SelectField
          control={form.control}
          name="departmentId"
          label="Department"
          options={departments.map((department) => ({ value: department.id, label: department.name }))}
        />
      )}
    </FormDialog>
  );
}
