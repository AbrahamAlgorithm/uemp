"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { FormDialog } from "@/components/form-dialog";
import { SelectField, TextField } from "@/components/form-fields";
import { api } from "@/lib/api";
import { programSchema, type ProgramInput } from "@/lib/schemas";
import { withToast } from "@/lib/toast";
import type { CodedRef, Program } from "@/lib/types";

const AWARDS = ["B.Sc.", "B.Eng.", "B.Tech.", "B.A.", "B.Ed."];

interface ProgramFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program: Program | null;
  departments?: CodedRef[];
  defaultDepartmentId?: number;
  onSaved: () => void;
}

export function ProgramFormDialog({
  open,
  onOpenChange,
  program,
  departments,
  defaultDepartmentId,
  onSaved,
}: ProgramFormDialogProps) {
  const form = useForm<ProgramInput>({ resolver: zodResolver(programSchema) });

  useEffect(() => {
    if (!open) return;
    form.reset(
      program
        ? { name: program.name, award: program.award, durationYears: program.durationYears, departmentId: program.department.id }
        : { name: "", departmentId: defaultDepartmentId },
    );
  }, [open, program, defaultDepartmentId, form]);

  const save = async (values: ProgramInput) => {
    const done = await withToast(
      program ? api.updateProgram(program.id, values) : api.createProgram(values),
      program ? "Program updated" : `${values.award} ${values.name} added`,
    );
    if (done) onSaved();
    return done;
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={program ? "Edit program" : "Add program"}
      form={form}
      onSubmit={save}
      submitLabel={program ? "Save changes" : "Add program"}
    >
      <TextField control={form.control} name="name" label="Name" placeholder="Computer Science" />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          control={form.control}
          name="award"
          label="Award"
          options={AWARDS.map((award) => ({ value: award, label: award }))}
        />
        <SelectField
          control={form.control}
          name="durationYears"
          label="Duration"
          description="Sets the levels the program runs."
          options={[4, 5, 6].map((years) => ({ value: years, label: `${years} years (to ${years * 100} level)` }))}
        />
      </div>
      {departments && (
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
