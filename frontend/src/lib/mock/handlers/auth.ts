import type { LoginInput } from "../../schemas";
import type { DemoAccount, Role } from "../../types";
import { db } from "../db";
import { DEMO_PASSWORD, DEMO_USER_IDS } from "../seed";
import { currentUser, fail, logAudit, now, sleep, storedUserId, storeUserId } from "../session";
import { currentSemesterRow, displayName, findUser, semesterView, sessionUserView } from "../views";

export const authHandlers = {
  async login(input: LoginInput) {
    await sleep();
    const user = db.users.find((row) => row.email === input.email.trim().toLowerCase());
    if (!user || input.password !== DEMO_PASSWORD) fail(400, "Email or password is incorrect.");
    if (user.status === "SUSPENDED") fail(403, "This account is suspended. Contact the registry for help.");
    if (user.status === "INACTIVE") fail(403, "This account is inactive. Contact the registry for help.");
    user.lastLogin = now();
    storeUserId(user.id);
    logAudit(user, "LOGIN", user.email, "Signed in with email and password");
    return sessionUserView(user);
  },

  async logout() {
    await sleep(100);
    storeUserId(null);
  },

  async getSession() {
    await sleep(50);
    const id = storedUserId();
    const user = id === null ? undefined : findUser(id);
    return user?.status === "ACTIVE" ? sessionUserView(user) : null;
  },

  async getDemoAccounts(): Promise<DemoAccount[]> {
    return (Object.entries(DEMO_USER_IDS) as [Role, number][]).map(([role, id]) => {
      const user = findUser(id)!;
      return { role, email: user.email, password: DEMO_PASSWORD, name: displayName(user) };
    });
  },

  async getCurrentSemester() {
    await sleep();
    currentUser();
    return semesterView(currentSemesterRow().id);
  },
};
