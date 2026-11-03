import type { Level, RegistrationState, Role, SemesterName, SheetStatus, UserStatus } from "./types";

export const UNIVERSITY_NAME = "Crestview University";
export const UNIVERSITY_ADDRESS = "Ibadan, Oyo State, Nigeria";

export const MAX_UNITS_PER_SEMESTER = 24;
export const CA_MAX = 40;
export const EXAM_MAX = 60;
export const REASON_MAX_LENGTH = 1000;
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

export const REGISTRATION_STATUS_LABELS: Record<RegistrationState, string> = {
  NOT_SUBMITTED: "Not submitted",
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

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  LOGIN: "Signed in",
  LOGOUT: "Signed out",
  CREATE: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
  PASSWORD_CHANGED: "Changed password",
  PASSWORD_RESET: "Reset password",
  CHANGE_STATUS: "Changed status",
  CHANGE_ROLE: "Changed role",
  OFFERING_CREATED: "Opened offering",
  LECTURER_ASSIGNED: "Assigned lecturer",
  SEMESTER_SET_CURRENT: "Set current semester",
  REGISTRATION_WINDOW_OPENED: "Opened registration",
  REGISTRATION_WINDOW_CLOSED: "Closed registration",
  REGISTRATION_SUBMITTED: "Submitted registration",
  REGISTRATION_VALIDATED: "Validated registration",
  REGISTRATION_RETURNED: "Returned registration",
  SCORES_SAVED: "Saved scores",
  RESULTS_IMPORTED: "Imported scores",
  RESULTS_SUBMITTED: "Submitted results",
  RESULTS_APPROVED: "Approved results",
  RESULTS_REJECTED: "Rejected results",
  RESULTS_REOPENED: "Reopened results",
  GRADE_SCALE_UPDATED: "Updated grading scale",
  GRADE_SCALE_RESET: "Reset grading scale",
};

export function auditActionLabel(action: string): string {
  if (AUDIT_ACTION_LABELS[action]) return AUDIT_ACTION_LABELS[action];
  const words = action.toLowerCase().replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
