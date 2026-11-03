import type { Api } from "../api/remote";
import { adminHandlers } from "./handlers/admin";
import { commonHandlers } from "./handlers/common";
import { departmentHandlers } from "./handlers/department";
import { lecturerHandlers } from "./handlers/lecturer";
import { studentHandlers } from "./handlers/student";

export { actAsDemoUser } from "./session";

// registration only ever runs against the api, so the mock layer doesn't implement it
export type RegistrationKey =
  | "getRegistration"
  | "submitRegistration"
  | "getRegistrationSlip"
  | "getRegistrationForms"
  | "getRegistrationForm"
  | "validateRegistrationForm"
  | "returnRegistrationForm"
  | "getOfferings"
  | "getOfferingRegistrations"
  | "setRegistrationOpen";

// nor do scores, result review and the grade scale
export type ResultKey =
  | "getMyOfferings"
  | "getLecturerSheet"
  | "saveScores"
  | "submitSheet"
  | "getMySubmissions"
  | "getResultSheets"
  | "getResultSheet"
  | "approveSheet"
  | "rejectSheet"
  | "reopenSheet"
  | "getMyResults"
  | "getGradeScale"
  | "updateGradeScale";

export const mockApi: Omit<Api, "login" | "logout" | "getSession" | RegistrationKey | ResultKey> = {
  ...commonHandlers,
  ...studentHandlers,
  ...lecturerHandlers,
  ...departmentHandlers,
  ...adminHandlers,
  changePassword: async () => ({ detail: "Password changed successfully." }),
};
