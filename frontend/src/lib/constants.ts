import type { AuditAction, Level, RegistrationStatus, Role, SemesterName, SheetStatus, UserStatus } from "./types";

export const UNIVERSITY_NAME = "Crestview University";
export const UNIVERSITY_ADDRESS = "Ibadan, Oyo State, Nigeria";

export const MAX_UNITS_PER_SEMESTER = 24;
export const CA_MAX = 40;
export const EXAM_MAX = 60;
export const LEVELS: Level[] = [100, 200, 300, 400, 500];

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "Student",
  LECTURER: "Lecturer",
  DEPT_ADMIN: "Department admin",
  SUPER_ADMIN: "Super admin",
};

export const ROLE_HOME: Record<Role, string> = {
  STUDENT: "/student",
  LECTURER: "/lecturer",
  DEPT_ADMIN: "/department",
  SUPER_ADMIN: "/admin",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  SUSPENDED: "Suspended",
};

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus | "NONE", string> = {
  NONE: "Not submitted",
  SUBMITTED: "Awaiting validation",
  VALIDATED: "Validated",
  RETURNED: "Returned",
};

export const SHEET_STATUS_LABELS: Record<SheetStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const SEMESTER_LABELS: Record<SemesterName, string> = {
  FIRST: "First semester",
  SECOND: "Second semester",
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  LOGIN: "Signed in",
  CREATE: "Created",
  UPDATE: "Updated",
  REGISTER_COURSES: "Registered courses",
  SAVE_SCORES: "Saved scores",
  SUBMIT_RESULTS: "Submitted results",
  APPROVE_RESULTS: "Approved results",
  REJECT_RESULTS: "Rejected results",
  REOPEN_RESULTS: "Reopened results",
  ASSIGN_LECTURER: "Assigned lecturer",
  CHANGE_STATUS: "Changed status",
  CHANGE_ROLE: "Changed role",
  SET_CURRENT_SEMESTER: "Set current semester",
  UPDATE_GRADE_SCALE: "Updated grade scale",
};
