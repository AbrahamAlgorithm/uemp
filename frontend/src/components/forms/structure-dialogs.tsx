"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { FormDialog } from "@/components/form-dialog";
import { SelectField, TextField } from "@/components/form-fields";
import { api } from "@/lib/api";
import {
  departmentSchema,
  facultySchema,
  sessionSchema,
  type DepartmentInput,
  type FacultyInput,
  type SessionInput,
} from "@/lib/schemas";
import { withToast } from "@/lib/toast";
import type { Department, Faculty } from "@/lib/types";

interface EditDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: T | null;
  onSaved: () => void;
}

export function FacultyFormDialog({ open, onOpenChange, item, onSaved }: EditDialogProps<Faculty>) {
  const form = useForm<FacultyInput>({ resolver: zodResolver(facultySchema) });

  useEffect(() => {
    if (open) form.reset(item ? { name: item.name, code: item.code } : { name: "", code: "" });
  }, [open, item, form]);

  const save = async (values: FacultyInput) => {
    const done = await withToast(
      item ? api.updateFaculty(item.id, values) : api.createFaculty(values),
      item ? "Faculty updated" : `${values.name} added`,
    );
    if (done) onSaved();
    return done;
  };

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={item ? "Edit faculty" : "Add faculty"} form={form} onSubmit={save}>
      <TextField control={form.control} name="name" label="Name" placeholder="Faculty of Science" />
      <TextField control={form.control} name="code" label="Code" placeholder="SCI" />
    </FormDialog>
  );
}

export function DepartmentFormDialog({
  open,
  onOpenChange,
  item,
  onSaved,
  faculties,
}: EditDialogProps<Department> & { faculties: Faculty[] }) {
  const form = useForm<DepartmentInput>({ resolver: zodResolver(departmentSchema) });

  useEffect(() => {
    if (open) {
      form.reset(item ? { name: item.name, code: item.code, facultyId: item.faculty.id } : { name: "", code: "" });
    }
  }, [open, item, form]);

  const save = async (values: DepartmentInput) => {
    const done = await withToast(
      item ? api.updateDepartment(item.id, values) : api.createDepartment(values),
      item ? "Department updated" : `${values.name} added`,
    );
    if (done) onSaved();
    return done;
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={item ? "Edit department" : "Add department"}
      form={form}
      onSubmit={save}
    >
      <TextField control={form.control} name="name" label="Name" placeholder="Computer Science" />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField control={form.control} name="code" label="Code" placeholder="CSC" />
        <SelectField
          control={form.control}
          name="facultyId"
          label="Faculty"
          options={faculties.map((faculty) => ({ value: faculty.id, label: faculty.name }))}
        />
      </div>
    </FormDialog>
  );
}

export function SessionFormDialog({ open, onOpenChange, onSaved }: Omit<EditDialogProps<never>, "item">) {
  const form = useForm<SessionInput>({ resolver: zodResolver(sessionSchema) });

  useEffect(() => {
    if (open) form.reset({ name: "", startDate: "", endDate: "" });
  }, [open, form]);

  const save = async (values: SessionInput) => {
    const done = await withToast(api.createSession(values), `${values.name} session added`);
    if (done) onSaved();
    return done;
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add session"
      description="First and second semesters are created with it."
      form={form}
      onSubmit={save}
      submitLabel="Add session"
    >
      <TextField control={form.control} name="name" label="Session" placeholder="2027/2028" />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField control={form.control} name="startDate" label="Starts" type="date" />
        <TextField control={form.control} name="endDate" label="Ends" type="date" />
      </div>
    </FormDialog>
  );
}
