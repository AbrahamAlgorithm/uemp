import type { Api } from "../api/remote";
import { adminHandlers } from "./handlers/admin";
import { authHandlers } from "./handlers/auth";
import { departmentHandlers } from "./handlers/department";
import { lecturerHandlers } from "./handlers/lecturer";
import { resultHandlers } from "./handlers/results";
import { studentHandlers } from "./handlers/student";

export { actAsDemoUser } from "./session";

export const mockApi: Omit<Api, "login" | "logout" | "getSession"> = {
  ...authHandlers,
  ...studentHandlers,
  ...lecturerHandlers,
  ...resultHandlers,
  ...departmentHandlers,
  ...adminHandlers,
};
