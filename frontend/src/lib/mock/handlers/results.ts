import { db } from "../db";
import { departmentScope, fail, inScope, logAudit, now, requireRole, sleep } from "../session";
import { findAllocation, findCourse, findSheet, sheetSummary, sheetView } from "../views";

const STATUS_ORDER = { SUBMITTED: 0, REJECTED: 1, DRAFT: 2, APPROVED: 3 } as const;

function scopedSheet(id: number, ...roles: ("DEPT_ADMIN" | "SUPER_ADMIN")[]) {
  const user = requireRole(...roles);
  const sheet = findSheet(id);
  const course = sheet && findCourse(findAllocation(sheet.allocationId)!.courseId)!;
  if (!sheet || !course || !inScope(departmentScope(user), course.departmentId)) fail(404, "Result sheet not found.");
  return { user, sheet, course };
}

export const resultHandlers = {
  async getResultSheets() {
    await sleep();
    const scope = departmentScope(requireRole("DEPT_ADMIN", "SUPER_ADMIN"));
    return db.sheets
      .map(sheetSummary)
      .filter((sheet) => inScope(scope, sheet.department.id))
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          b.semester.id - a.semester.id ||
          (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""),
      );
  },

  async getResultSheet(id: number) {
    await sleep();
    return sheetView(scopedSheet(id, "DEPT_ADMIN", "SUPER_ADMIN").sheet);
  },

  async approveSheet(id: number) {
    await sleep();
    const { user, sheet, course } = scopedSheet(id, "DEPT_ADMIN");
    if (sheet.status !== "SUBMITTED") fail(409, "Only submitted result sheets can be approved.");
    sheet.status = "APPROVED";
    sheet.reviewedAt = now();
    sheet.feedback = null;
    sheet.history.push({ at: sheet.reviewedAt, action: "APPROVED", actorId: user.id, note: null });
    logAudit(user, "APPROVE_RESULTS", `${course.code} ${course.title}`, "Results published to students");
    return sheetView(sheet);
  },

  async rejectSheet(id: number, feedback: string) {
    await sleep();
    const { user, sheet, course } = scopedSheet(id, "DEPT_ADMIN");
    if (sheet.status !== "SUBMITTED") fail(409, "Only submitted result sheets can be rejected.");
    if (feedback.trim().length < 10) fail(400, "Explain what needs to change so the lecturer can fix it.");
    sheet.status = "REJECTED";
    sheet.reviewedAt = now();
    sheet.feedback = feedback.trim();
    sheet.history.push({ at: sheet.reviewedAt, action: "REJECTED", actorId: user.id, note: sheet.feedback });
    logAudit(user, "REJECT_RESULTS", `${course.code} ${course.title}`, sheet.feedback);
    return sheetView(sheet);
  },

  async reopenSheet(id: number, reason: string) {
    await sleep();
    const { user, sheet, course } = scopedSheet(id, "DEPT_ADMIN");
    if (sheet.status !== "APPROVED") fail(409, "Only approved result sheets can be reopened.");
    if (reason.trim().length < 10) fail(400, "Give a reason for reopening this result sheet.");
    sheet.status = "DRAFT";
    sheet.reviewedAt = now();
    sheet.feedback = reason.trim();
    sheet.history.push({ at: sheet.reviewedAt, action: "REOPENED", actorId: user.id, note: sheet.feedback });
    logAudit(user, "REOPEN_RESULTS", `${course.code} ${course.title}`, sheet.feedback);
    return sheetView(sheet);
  },
};
