"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { FormDialog } from "@/components/form-dialog";
import { TextField, TextareaField } from "@/components/form-fields";
import { api } from "@/lib/api";
import { staffContactSchema, studentContactSchema, type StaffContactInput, type StudentContactInput } from "@/lib/schemas";
import { withToast } from "@/lib/toast";

interface DialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: T;
  onSaved: () => void;
}

export function StudentProfileDialog({ open, onOpenChange, initial, onSaved }: DialogProps<StudentContactInput>) {
  const form = useForm<StudentContactInput>({ resolver: zodResolver(studentContactSchema) });

  useEffect(() => {
    if (open) form.reset(initial);
  }, [open, initial, form]);

  const save = async (values: StudentContactInput) => {
    const done = await withToast(api.updateProfile(values), "Personal details updated");
    if (done) onSaved();
    return done;
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit personal details"
      description="Everything else on your profile is managed by your department."
      form={form}
      onSubmit={save}
    >
      <TextField control={form.control} name="phone" label="Phone number" type="tel" autoComplete="tel" />
      <TextField control={form.control} name="dateOfBirth" label="Date of birth" type="date" />
      <TextareaField control={form.control} name="address" label="Address" />
    </FormDialog>
  );
}

export function StaffProfileDialog({ open, onOpenChange, initial, onSaved }: DialogProps<StaffContactInput>) {
  const form = useForm<StaffContactInput>({ resolver: zodResolver(staffContactSchema) });

  useEffect(() => {
    if (open) form.reset(initial);
  }, [open, initial, form]);

  const save = async (values: StaffContactInput) => {
    const done = await withToast(api.updateProfile(values), "Phone number updated");
    if (done) onSaved();
    return done;
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit personal details"
      description="Your other details are managed by an administrator."
      form={form}
      onSubmit={save}
    >
      <TextField control={form.control} name="phone" label="Phone number" type="tel" autoComplete="tel" />
    </FormDialog>
  );
}
