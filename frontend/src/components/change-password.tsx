"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormDialog } from "@/components/form-dialog";
import { TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/schemas";
import { withToast } from "@/lib/toast";

export function ChangePasswordButton() {
  const [open, setOpen] = useState(false);
  const form = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  const save = async (values: ChangePasswordInput) => {
    const done = await withToast(
      api.changePassword({ current_password: values.currentPassword, new_password: values.newPassword }),
      "Password changed successfully",
    );
    if (done) form.reset();
    return done;
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <KeyRound />
        Change password
      </Button>
      <FormDialog open={open} onOpenChange={setOpen} title="Change password" form={form} onSubmit={save}>
        <TextField control={form.control} name="currentPassword" label="Current password" type="password" autoComplete="current-password" />
        <TextField control={form.control} name="newPassword" label="New password" type="password" autoComplete="new-password" />
        <TextField control={form.control} name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" />
      </FormDialog>
    </>
  );
}
