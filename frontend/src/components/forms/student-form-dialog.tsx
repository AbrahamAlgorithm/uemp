"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";

import { FormDialog } from "@/components/form-dialog";
import { SelectField, TextField } from "@/components/form-fields";
import { api } from "@/lib/api";
import { studentSchema, type StudentInput } from "@/lib/schemas";
import { withToast } from "@/lib/toast";
import type { Program, Student } from "@/lib/types";

interface StudentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  programs: Program[];
  onSaved: () => void;
}

const EMPTY = { firstName: "", lastName: "", email: "", matricNumber: "", phone: "" };

export function StudentFormDialog({ open, onOpenChange, student, programs, onSaved }: StudentFormDialogProps) {
  const form = useForm<StudentInput>({ resolver: zodResolver(studentSchema), defaultValues: EMPTY });
  const programId = useWatch({ control: form.control, name: "programId" });
  const levels = programs.find((program) => program.id === programId)?.levels ?? [];

  useEffect(() => {
    if (!open) return;
    form.reset(
      student
        ? {
            firstName: student.firstName,
            lastName: student.lastName,
            email: student.email,
            matricNumber: student.matricNumber,
            programId: student.program.id,
            level: student.level,
            gender: student.gender,
            phone: student.phone,
          }
        : EMPTY,
    );
  }, [open, student, form]);

  const save = async (values: StudentInput) => {
    const done = await withToast(
      student ? api.updateStudent(student.id, values) : api.createStudent(values),
      student ? "Student record updated" : `${values.firstName} ${values.lastName} added`,
    );
    if (done) onSaved();
    return done;
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={student ? "Edit student" : "Add student"}
      description={student ? student.matricNumber : "The student can sign in with this email once the account is created."}
      form={form}
      onSubmit={save}
      submitLabel={student ? "Save changes" : "Add student"}
      wide
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField control={form.control} name="firstName" label="First name" autoComplete="off" />
        <TextField control={form.control} name="lastName" label="Last name" autoComplete="off" />
        <TextField control={form.control} name="email" label="Email" type="email" autoComplete="off" />
        <TextField control={form.control} name="phone" label="Phone number" type="tel" autoComplete="off" />
        <TextField control={form.control} name="matricNumber" label="Matric number" placeholder="CSC/2026/0001" />
        <SelectField
          control={form.control}
          name="gender"
          label="Gender"
          options={[
            { value: "F", label: "Female" },
            { value: "M", label: "Male" },
          ]}
        />
        <SelectField
          control={form.control}
          name="programId"
          label="Program"
          options={programs.map((program) => ({ value: program.id, label: `${program.award} ${program.name}` }))}
        />
        <SelectField
          control={form.control}
          name="level"
          label="Level"
          placeholder={programId ? "Select" : "Choose a program first"}
          options={levels.map((level) => ({ value: level, label: `${level} level` }))}
        />
      </div>
    </FormDialog>
  );
}
