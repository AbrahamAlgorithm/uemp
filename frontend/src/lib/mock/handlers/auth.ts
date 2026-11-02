import type { ActivationRequestInput, LoginInput } from "../../schemas";
import type { ActivationChallenge, DemoAccount, Role } from "../../types";
import { db } from "../db";
import { DEMO_ACTIVATION_CODE, DEMO_PASSWORD, DEMO_USER_IDS, type UserRow } from "../seed";
import { currentUser, fail, logAudit, now, sleep, storedUserId, storeUserId } from "../session";
import { currentSemesterRow, displayName, findStaff, findStudent, findUser, semesterView, sessionUserView } from "../views";

const CODE_LIFETIME = 600;
const RESEND_AFTER = 45;

const passwords = new Map<number, string>();
const pendingCodes = new Map<number, { code: string; expiresAt: number; sentAt: number }>();
const activationTokens = new Map<string, number>();

function findByIdentifier(value: string): UserRow | undefined {
  const key = value.trim().toUpperCase();
  const student = db.students.find((row) => row.matricNumber.toUpperCase() === key);
  const staff = db.staff.find((row) => row.staffId.toUpperCase() === key);
  const id = student?.userId ?? staff?.userId;
  return id ? findUser(id) : db.users.find((row) => row.email === value.trim().toLowerCase());
}

const identifierOf = (user: UserRow) => findStudent(user.id)?.matricNumber ?? findStaff(user.id)?.staffId ?? user.email;

function assertCanSignIn(user: UserRow) {
  if (user.status === "SUSPENDED") fail(403, "This account is suspended. Contact the registry for help.");
  if (user.status === "INACTIVE") fail(403, "This account is inactive. Contact the registry for help.");
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return `${name![0]}${"•".repeat(Math.max(name!.length - 2, 1))}${name!.at(-1)}@${domain}`;
}

export const authHandlers = {
  async login(input: LoginInput) {
    await sleep();
    const user = findByIdentifier(input.identifier);
    if (!user || input.password !== (passwords.get(user.id) ?? DEMO_PASSWORD)) {
      fail(400, "Staff/Student ID or password is incorrect.");
    }
    assertCanSignIn(user);
    user.lastLogin = now();
    storeUserId(user.id);
    logAudit(user, "LOGIN", identifierOf(user), "Signed in with ID and password");
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

  async requestActivation(input: ActivationRequestInput): Promise<ActivationChallenge> {
    await sleep();
    const user = findByIdentifier(input.identifier);
    if (!user || user.email !== input.email.trim().toLowerCase()) {
      fail(400, "We couldn't find an account with that ID and email address.");
    }
    assertCanSignIn(user);
    const pending = pendingCodes.get(user.id);
    if (pending && Date.now() - pending.sentAt < RESEND_AFTER * 1000) fail(429, "Wait a moment before asking for another code.");
    pendingCodes.set(user.id, { code: DEMO_ACTIVATION_CODE, expiresAt: Date.now() + CODE_LIFETIME * 1000, sentAt: Date.now() });
    return { maskedEmail: maskEmail(user.email), expiresInSeconds: CODE_LIFETIME, resendInSeconds: RESEND_AFTER };
  },

  async verifyActivation(input: { identifier: string; code: string }) {
    await sleep();
    const user = findByIdentifier(input.identifier);
    const pending = user && pendingCodes.get(user.id);
    if (!user || !pending) fail(400, "Request a new code to continue.");
    if (Date.now() > pending.expiresAt) fail(400, "This code has expired. Request a new one.");
    if (input.code !== pending.code) fail(400, "That code isn't right. Check the email and try again.");
    pendingCodes.delete(user.id);
    const token = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    activationTokens.set(token, user.id);
    return { token };
  },

  async completeActivation(input: { token: string; password: string }) {
    await sleep();
    const userId = activationTokens.get(input.token);
    const user = userId === undefined ? undefined : findUser(userId);
    if (!user) fail(400, "This activation link has expired. Start again.");
    if (input.password.length < 8) fail(400, "Use at least 8 characters.");
    activationTokens.delete(input.token);
    passwords.set(user.id, input.password);
    logAudit(user, "UPDATE", identifierOf(user), "Activated portal account and set a password");
  },

  async getDemoAccounts(): Promise<DemoAccount[]> {
    return (Object.entries(DEMO_USER_IDS) as [Role, number][]).map(([role, id]) => {
      const user = findUser(id)!;
      return {
        role,
        identifier: identifierOf(user),
        email: user.email,
        password: passwords.get(id) ?? DEMO_PASSWORD,
        name: displayName(user),
        activationCode: DEMO_ACTIVATION_CODE,
      };
    });
  },

  async getCurrentSemester() {
    await sleep();
    currentUser();
    return semesterView(currentSemesterRow().id);
  },
};
