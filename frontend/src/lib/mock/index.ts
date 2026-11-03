import type { Api } from "../api/remote";
import { adminHandlers } from "./handlers/admin";
import { commonHandlers } from "./handlers/common";
import { departmentHandlers } from "./handlers/department";
import { lecturerHandlers } from "./handlers/lecturer";
import { resultHandlers } from "./handlers/results";
import { studentHandlers } from "./handlers/student";

export { actAsDemoUser } from "./session";

export const mockApi: Omit<Api, "login" | "logout" | "getSession"> = {
  ...commonHandlers,
  ...studentHandlers,
  ...lecturerHandlers,
  ...resultHandlers,
  ...departmentHandlers,
  ...adminHandlers,
};
