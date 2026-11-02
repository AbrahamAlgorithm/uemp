import { CA_MAX, EXAM_MAX } from "../../constants";
import { isValidCa, isValidExam } from "../../grading";
import type { StaffContactInput } from "../../schemas";
import type { LecturerCourse, ScoreInput, SheetStatus } from "../../types";
import { db, type AllocationRow } from "../db";
import { fail, logAudit, now, requireRole, sleep } from "../session";
import {
  courseSummary,
  currentSemesterRow,
  findAllocation,
  findCourse,
  findSheet,
  findStaff,
  registrationsFor,
  semesterView,
  sheetEntries,
  sheetSummary,
  sheetView,
  staffView,
} from "../views";

export const isEditable = (status: SheetStatus) => status === "DRAFT" || status === "REJECTED";

function lecturerCourse(allocation: AllocationRow): LecturerCourse {
  const sheet = db.sheets.find((row) => row.allocationId === allocation.id)!;
  const students = registrationsFor(allocation.courseId, allocation.semesterId);
  return {
    allocationId: allocation.id,
    sheetId: sheet.id,
    course: courseSummary(findCourse(allocation.courseId)!),
    semester: semesterView(allocation.semesterId),
    studentCount: students.length,
    scoredCount: students.filter((row) => {
      const score = sheet.scores[row.studentId];
      return score?.ca != null && score.exam != null;
    }).length,
    sheetStatus: sheet.status,
  };
}

function ownSheet(sheetId: number) {
  const user = requireRole("LECTURER");
  const sheet = findSheet(sheetId);
  if (!sheet) fail(404, "Result sheet not found.");
  const allocation = findAllocation(sheet.allocationId)!;
  if (allocation.lecturerId !== user.id) fail(403, "This result sheet belongs to another lecturer.");
  if (!isEditable(sheet.status)) fail(409, "This result sheet is locked while it's submitted or approved.");
  return { user, sheet, allocation, course: findCourse(allocation.courseId)! };
}

export const lecturerHandlers = {
  async getMyAllocations() {
    await sleep();
    const user = requireRole("LECTURER");
    const semester = currentSemesterRow();
    return db.allocations
      .filter((row) => row.lecturerId === user.id && row.semesterId === semester.id)
      .map(lecturerCourse)
      .sort((a, b) => a.course.code.localeCompare(b.course.code));
  },

  async getLecturerCourse(allocationId: number) {
    await sleep();
    const user = requireRole("LECTURER");
    const allocation = findAllocation(allocationId);
    if (!allocation || allocation.lecturerId !== user.id) fail(404, "Course not found.");
    const sheet = db.sheets.find((row) => row.allocationId === allocation.id)!;
    return { course: lecturerCourse(allocation), sheet: sheetView(sheet) };
  },

  async saveScores(sheetId: number, scores: ScoreInput[]) {
    await sleep();
    const { user, sheet, allocation, course } = ownSheet(sheetId);
    const registered = new Set(registrationsFor(allocation.courseId, allocation.semesterId).map((row) => row.studentId));
    for (const score of scores) {
      if (!registered.has(score.studentId)) fail(400, "One of these students isn't registered for this course.");
      if (score.ca !== null && !isValidCa(score.ca)) fail(400, `CA scores must be between 0 and ${CA_MAX}.`);
      if (score.exam !== null && !isValidExam(score.exam)) fail(400, `Exam scores must be between 0 and ${EXAM_MAX}.`);
    }
    for (const score of scores) sheet.scores[score.studentId] = { ca: score.ca, exam: score.exam };
    const scored = sheetEntries(sheet).filter((entry) => entry.total !== null).length;
    logAudit(user, "SAVE_SCORES", `${course.code} ${course.title}`, `${scored} of ${registered.size} students scored`, course.departmentId);
    return sheetView(sheet);
  },

  async submitSheet(sheetId: number) {
    await sleep();
    const { user, sheet, course } = ownSheet(sheetId);
    const entries = sheetEntries(sheet);
    if (entries.length === 0) fail(400, "There are no registered students on this sheet.");
    if (entries.some((entry) => entry.total === null)) {
      fail(400, "Every student needs both a CA and an exam score before you submit.");
    }
    sheet.status = "SUBMITTED";
    sheet.submittedAt = now();
    sheet.reviewedAt = null;
    sheet.feedback = null;
    sheet.history.push({ at: sheet.submittedAt, action: "SUBMITTED", actorId: user.id, note: null });
    logAudit(user, "SUBMIT_RESULTS", `${course.code} ${course.title}`, `${entries.length} students`, course.departmentId);
    return sheetView(sheet);
  },

  async getMySubmissions() {
    await sleep();
    const user = requireRole("LECTURER");
    return db.sheets
      .filter((sheet) => sheet.history.length > 0 && findAllocation(sheet.allocationId)!.lecturerId === user.id)
      .map(sheetSummary)
      .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
  },

  async getStaffProfile() {
    await sleep();
    return staffView(requireRole("LECTURER", "DEPT_ADMIN", "SUPER_ADMIN"));
  },

  async updateStaffContact(input: StaffContactInput) {
    await sleep();
    const user = requireRole("LECTURER", "DEPT_ADMIN", "SUPER_ADMIN");
    user.phone = input.phone;
    findStaff(user.id)!.office = input.office;
    logAudit(user, "UPDATE", "Profile", "Updated phone number and office");
    return staffView(user);
  },
};
