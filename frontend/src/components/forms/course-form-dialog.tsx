"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { FormDialog } from "@/components/form-dialog";
import { CheckboxGroupField, NumberField, SelectField, TextField } from "@/components/form-fields";
import { api } from "@/lib/api";
import { LEVELS } from "@/lib/constants";
import { courseSchema, type CourseInput } from "@/lib/schemas";
import { withToast } from "@/lib/toast";
import type { CodedRef, Course, Level, Ref } from "@/lib/types";

interface CourseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course | null;
  programs: (Ref & { award?: string })[];
  departments?: CodedRef[];
  defaultDepartmentId?: number;
  defaultLevel?: Level;
  onSaved: () => void;
}

export function CourseFormDialog({
  open,
  onOpenChange,
  course,
  programs,
  departments,
  defaultDepartmentId,
  defaultLevel,
  onSaved,
}: CourseFormDialogProps) {
  const form = useForm<CourseInput>({ resolver: zodResolver(courseSchema) });

  useEffect(() => {
    if (!open) return;
    form.reset(
      course
        ? {
            code: course.code,
            title: course.title,
            units: course.units,
            level: course.level,
            semester: course.semester,
            departmentId: course.department.id,
            programIds: course.programs.map((program) => program.id),
          }
        : { code: "", title: "", level: defaultLevel, departmentId: defaultDepartmentId, programIds: [] },
    );
  }, [open, course, defaultDepartmentId, defaultLevel, form]);

  // keep programs from other departments that the course is already open to
  const programOptions = [
    ...new Map(
      [...programs, ...(course?.programs ?? [])].map((program) => [
        program.id,
        { value: program.id, label: "award" in program && program.award ? `${program.award} ${program.name}` : program.name },
      ]),
    ).values(),
  ];

  const save = async (values: CourseInput) => {
    const done = await withToast(
      course ? api.updateCourse(course.id, values) : api.createCourse(values),
      course ? `${values.code} updated` : `${values.code} added`,
    );
    if (done) onSaved();
    return done;
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={course ? "Edit course" : "Add course"}
      form={form}
      onSubmit={save}
      submitLabel={course ? "Save changes" : "Add course"}
      wide
    >
      <div className="grid gap-5 sm:grid-cols-[10rem_1fr]">
        <TextField control={form.control} name="code" label="Code" placeholder="CSC 301" />
        <TextField control={form.control} name="title" label="Title" />
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <NumberField control={form.control} name="units" label="Units" min={1} max={6} />
        <SelectField
          control={form.control}
          name="level"
          label="Level"
          options={LEVELS.map((level) => ({ value: level, label: `${level} level` }))}
        />
        <SelectField
          control={form.control}
          name="semester"
          label="Semester"
          options={[
            { value: "FIRST", label: "First" },
            { value: "SECOND", label: "Second" },
          ]}
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
      <CheckboxGroupField
        control={form.control}
        name="programIds"
        label="Available to"
        description="Students in these programs will see the course at registration."
        options={programOptions}
      />
    </FormDialog>
  );
}
