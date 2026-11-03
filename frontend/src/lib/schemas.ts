import { z } from "zod";

import { GRADES } from "./grading";

const phone = z
  .string()
  .trim()
  .regex(/^(\+234|0)[789][01]\d{8}$/, "Enter a valid Nigerian phone number, e.g. 08031234567");

const requiredText = (label: string, max = 120) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

const pick = (label: string) => z.number({ error: `Select a ${label}` });

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Required."),
  password: z.string().min(1, "Required."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Use at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const studentSchema = z.object({
  firstName: requiredText("First name", 60),
  lastName: requiredText("Last name", 60),
  email: z.email("Enter a valid email address"),
  matricNumber: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}\/\d{4}\/\d{4}$/, "Use the format CSC/2026/0001"),
  programId: pick("program"),
  level: pick("level"),
  gender: z.enum(["M", "F"], { error: "Select a gender" }),
  phone,
  initialPassword: z.string().min(8, "Use at least 8 characters").optional(),
});
export type StudentInput = z.infer<typeof studentSchema>;

export const lecturerSchema = z.object({
  title: requiredText("Title", 20),
  firstName: requiredText("First name", 60),
  lastName: requiredText("Last name", 60),
  email: z.email("Enter a valid email address"),
  staffId: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}\/[A-Z]{2,3}\/\d{3}$/, "Use the format CVU/CSC/014"),
  phone,
  initialPassword: z.string().min(8, "Use at least 8 characters").optional(),
});
export type LecturerInput = z.infer<typeof lecturerSchema>;

export const courseSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z]{3} \d{3}$/, "Use the format CSC 301"),
  title: requiredText("Title"),
  units: z.number({ error: "Enter the units" }).int().min(1, "Minimum is 1 unit").max(6, "Maximum is 6 units"),
  level: pick("level"),
  semester: z.enum(["FIRST", "SECOND"], { error: "Select a semester" }),
  departmentId: pick("department"),
  programIds: z.array(z.number()).min(1, "Select at least one program"),
});
export type CourseInput = z.infer<typeof courseSchema>;

export const programSchema = z.object({
  name: requiredText("Name"),
  award: requiredText("Award", 20),
  durationYears: z.number({ error: "Select a duration" }).int().min(2).max(6),
  departmentId: pick("department"),
});
export type ProgramInput = z.infer<typeof programSchema>;

export const facultySchema = z.object({
  name: requiredText("Name"),
  code: z.string().trim().regex(/^[A-Z]{2,5}$/, "Use 2 to 5 capital letters"),
});
export type FacultyInput = z.infer<typeof facultySchema>;

export const departmentSchema = z.object({
  name: requiredText("Name"),
  code: z.string().trim().regex(/^[A-Z]{3}$/, "Use 3 capital letters"),
  facultyId: pick("faculty"),
});
export type DepartmentInput = z.infer<typeof departmentSchema>;

export const sessionSchema = z
  .object({
    name: z.string().trim().regex(/^\d{4}\/\d{4}$/, "Use the format 2027/2028"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
  })
  .refine(({ name }) => Number(name.slice(5)) === Number(name.slice(0, 4)) + 1, {
    path: ["name"],
    message: "The second year must follow the first",
  })
  .refine(({ startDate, endDate }) => !startDate || !endDate || startDate < endDate, {
    path: ["endDate"],
    message: "End date must be after the start date",
  });
export type SessionInput = z.infer<typeof sessionSchema>;

export const userRoleSchema = z
  .object({
    role: z.enum(["STUDENT", "LECTURER", "DEPT_ADMIN", "SUPER_ADMIN"]),
    departmentId: z.number().nullable(),
  })
  .refine(({ role, departmentId }) => role === "SUPER_ADMIN" || departmentId !== null, {
    path: ["departmentId"],
    message: "Select a department",
  });
export type UserRoleInput = z.infer<typeof userRoleSchema>;

const gradeBand = z
  .object({
    grade: z.enum(GRADES),
    min: z.number({ error: "Required" }).int().min(0).max(100),
    max: z.number({ error: "Required" }).int().min(0).max(100),
    point: z.number({ error: "Required" }).min(0).max(5),
  })
  .refine((band) => band.min <= band.max, { path: ["max"], message: "Must be at least the minimum" });

export const gradeScaleSchema = z.object({
  bands: z.array(gradeBand).superRefine((bands, ctx) => {
    if (bands[0]?.max !== 100) {
      ctx.addIssue({ code: "custom", path: [0, "max"], message: "The top band must end at 100" });
    }
    if (bands[bands.length - 1]?.min !== 0) {
      ctx.addIssue({ code: "custom", path: [bands.length - 1, "min"], message: "The last band must start at 0" });
    }
    bands.slice(1).forEach((band, index) => {
      if (band.max !== bands[index]!.min - 1) {
        ctx.addIssue({
          code: "custom",
          path: [index + 1, "max"],
          message: `Must be ${bands[index]!.min - 1} so bands don't overlap or leave gaps`,
        });
      }
    });
  }),
});
export type GradeScaleInput = z.infer<typeof gradeScaleSchema>;
