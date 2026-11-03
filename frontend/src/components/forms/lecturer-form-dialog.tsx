"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { FormDialog } from "@/components/form-dialog";
import { SelectField, TextField } from "@/components/form-fields";
import { api } from "@/lib/api";
import { lecturerSchema, type LecturerInput } from "@/lib/schemas";
import { withToast } from "@/lib/toast";
import type { Lecturer } from "@/lib/types";

const TITLES = ["Prof.", "Dr.", "Engr.", "Mr.", "Mrs.", "Ms."];

const EMPTY = { firstName: "", lastName: "", email: "", staffId: "", phone: "" };

interface LecturerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lecturer: Lecturer | null;
  onSaved: () => void;
}

export function LecturerFormDialog({ open, onOpenChange, lecturer, onSaved }: LecturerFormDialogProps) {
  const form = useForm<LecturerInput>({ resolver: zodResolver(lecturerSchema), defaultValues: EMPTY });

  useEffect(() => {
    if (!open) return;
    form.reset(
      lecturer
        ? {
            title: lecturer.title,
            firstName: lecturer.firstName,
            lastName: lecturer.lastName,
            email: lecturer.email,
            staffId: lecturer.staffId,
            phone: lecturer.phone,
          }
        : EMPTY,
    );
  }, [open, lecturer, form]);

  const save = async (values: LecturerInput) => {
    const done = await withToast(
      lecturer ? api.updateLecturer(lecturer.id, values) : api.createLecturer(values),
      lecturer ? "Lecturer record updated" : `${values.title} ${values.lastName} added`,
    );
    if (done) onSaved();
    return done;
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={lecturer ? "Edit lecturer" : "Add lecturer"}
      description={lecturer ? lecturer.staffId : undefined}
      form={form}
      onSubmit={save}
      submitLabel={lecturer ? "Save changes" : "Add lecturer"}
      wide
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          control={form.control}
          name="title"
          label="Title"
          options={TITLES.map((title) => ({ value: title, label: title }))}
        />
        <TextField control={form.control} name="staffId" label="Staff ID" placeholder="CVU/CSC/014" />
        <TextField control={form.control} name="firstName" label="First name" autoComplete="off" />
        <TextField control={form.control} name="lastName" label="Last name" autoComplete="off" />
        <TextField control={form.control} name="email" label="Email" type="email" autoComplete="off" />
        <TextField control={form.control} name="phone" label="Phone number" type="tel" autoComplete="off" />
        {!lecturer && <TextField control={form.control} name="initialPassword" label="Initial password" type="password" autoComplete="new-password" />}
      </div>
    </FormDialog>
  );
}
