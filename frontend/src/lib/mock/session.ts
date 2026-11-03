import { ApiError } from "../api/http";
import type { AuditAction, Role } from "../types";
import { db, nextId } from "./db";
import { DEMO_USER_IDS, IP_ADDRESSES, type UserRow } from "./seed";
import { findUser } from "./views";

const STORAGE_KEY = "uemp.mock.user";

export const now = () => new Date().toISOString();

export function sleep(ms = 150 + Math.random() * 250) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function fail(status: number, detail: string): never {
  throw new ApiError(status, { detail });
}

export function storedUserId(): number | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? Number(value) : null;
  } catch {
    return null;
  }
}

export function storeUserId(id: number | null) {
  try {
    if (id === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, String(id));
  } catch {}
}

export function actAsDemoUser(role: Role | null) {
  storeUserId(role === null ? null : DEMO_USER_IDS[role]);
}

export function currentUser(): UserRow {
  const id = storedUserId();
  const user = id === null ? undefined : findUser(id);
  if (!user || user.status !== "ACTIVE") fail(401, "Your session has ended. Sign in again.");
  return user;
}

export function requireRole(...roles: Role[]): UserRow {
  const user = currentUser();
  if (!roles.includes(user.role)) fail(403, "You don't have permission to do that.");
  return user;
}

export function departmentScope(user: UserRow): number | null {
  return user.role === "SUPER_ADMIN" ? null : user.departmentId;
}

export function inScope(scope: number | null, departmentId: number | null) {
  return scope === null || scope === departmentId;
}

export function logAudit(actor: UserRow, action: AuditAction, target: string, details: string, departmentId = actor.departmentId) {
  db.audit.unshift({
    id: nextId(db.audit),
    at: now(),
    actorId: actor.id,
    action,
    target,
    details,
    ipAddress: IP_ADDRESSES[0]!,
    departmentId,
  });
}
