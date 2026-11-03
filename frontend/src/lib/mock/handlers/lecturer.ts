import type { StaffContactInput } from "../../schemas";
import { logAudit, requireRole, sleep } from "../session";
import { staffView } from "../views";

export const lecturerHandlers = {
  async getStaffProfile() {
    await sleep();
    return staffView(requireRole("LECTURER", "DEPT_ADMIN", "SUPER_ADMIN"));
  },

  async updateStaffContact(input: StaffContactInput) {
    await sleep();
    const user = requireRole("LECTURER", "DEPT_ADMIN", "SUPER_ADMIN");
    user.phone = input.phone;
    logAudit(user, "UPDATE", "Profile", "Updated phone number");
    return staffView(user);
  },
};
