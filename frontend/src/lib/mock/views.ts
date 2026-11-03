import { scoreResult, weightedAverage } from "../grading";
import type {
  AuditEntry,
  CodedRef,
  Course,
  CourseSummary,
  Lecturer,
  Level,
  ResultEntry,
  ResultSheetSummary,
  Semester,
  StaffProfile,
  Student,
  UserAccount,
} from "../types";
import { db, type AuditRow, type SheetRow } from "./db";
import type { CourseRow, StudentRow, UserRow } from "./seed";

export const findUser = (id: number) => db.users.find((user) => user.id === id);
export const findStudent = (id: number) => db.students.find((student) => student.userId === id);
export const findStaff = (id: number) => db.staff.find((staff) => staff.userId === id);
export const findCourse = (id: number) => db.courses.find((course) => course.id === id);
export const findAllocation = (id: number) => db.allocations.find((allocation) => allocation.id === id);
export const findSheet = (id: number) => db.sheets.find((sheet) => sheet.id === id);

export function currentSemesterRow() {
  return db.semesters.find((semester) => semester.isCurrent)!;
}

export function displayName(user: UserRow): string {
  const title = findStaff(user.id)?.title;
  return [title, user.firstName, user.lastName].filter(Boolean).join(" ");
}

export function departmentRef(id: number): CodedRef {
  const department = db.departments.find((row) => row.id === id)!;
  return { id: department.id, code: department.code, name: department.name };
}

export function facultyRefForDepartment(departmentId: number): CodedRef {
  const facultyId = db.departments.find((row) => row.id === departmentId)!.facultyId;
  const faculty = db.faculties.find((row) => row.id === facultyId)!;
  return { id: faculty.id, code: faculty.code, name: faculty.name };
}

export function semesterView(id: number): Semester {
  const semester = db.semesters.find((row) => row.id === id)!;
  const session = db.sessions.find((row) => row.id === semester.sessionId)!;
  return {
    id: semester.id,
    name: semester.name,
    isCurrent: semester.isCurrent,
    registrationOpen: semester.isCurrent,
    session: { id: session.id, name: session.name },
  };
}

export function courseSummary(course: CourseRow): CourseSummary {
  return { id: course.id, code: course.code, title: course.title, units: course.units, level: course.level as Level };
}

export function courseView(course: CourseRow): Course {
  return {
    ...courseSummary(course),
    semester: course.semester,
    department: departmentRef(course.departmentId),
    programs: db.programs
      .filter((program) => course.programIds.includes(program.id))
      .map((program) => ({ id: program.id, name: program.name })),
  };
}

export function studentView(row: StudentRow): Student {
  const user = findUser(row.userId)!;
  const program = db.programs.find((program) => program.id === row.programId)!;
  return {
    id: user.id,
    matricNumber: row.matricNumber,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: displayName(user),
    email: user.email,
    phone: user.phone,
    address: row.address,
    gender: row.gender,
    dateOfBirth: row.dateOfBirth,
    status: user.status,
    level: row.level as Level,
    faculty: facultyRefForDepartment(program.departmentId),
    department: departmentRef(program.departmentId),
    program: { id: program.id, name: program.name, award: program.award },
    entrySession: db.sessions.find((session) => session.id === row.entrySessionId)?.name ?? "—",
  };
}

export function staffView(user: UserRow): StaffProfile {
  const staff = findStaff(user.id)!;
  return {
    id: user.id,
    staffId: staff.staffId,
    title: staff.title,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: displayName(user),
    email: user.email,
    phone: user.phone,
    status: user.status,
    role: user.role,
    faculty: user.departmentId ? facultyRefForDepartment(user.departmentId) : null,
    department: user.departmentId ? departmentRef(user.departmentId) : null,
  };
}

export function lecturerView(user: UserRow): Lecturer {
  const semester = currentSemesterRow();
  return {
    ...staffView(user),
    department: departmentRef(user.departmentId!),
    courseCount: db.allocations.filter((row) => row.lecturerId === user.id && row.semesterId === semester.id).length,
  };
}

export function userAccountView(user: UserRow): UserAccount {
  const identifier = findStudent(user.id)?.matricNumber ?? findStaff(user.id)?.staffId ?? null;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: displayName(user),
    role: user.role,
    status: user.status,
    department: user.departmentId ? departmentRef(user.departmentId) : null,
    identifier,
    phone: user.phone,
    dateJoined: user.dateJoined,
    lastLogin: user.lastLogin,
  };
}

export function registrationsFor(courseId: number, semesterId: number) {
  return db.registrations.filter((row) => row.courseId === courseId && row.semesterId === semesterId);
}

export function sheetEntries(sheet: SheetRow): ResultEntry[] {
  const allocation = findAllocation(sheet.allocationId)!;
  return registrationsFor(allocation.courseId, allocation.semesterId)
    .map((registration) => {
      const user = findUser(registration.studentId)!;
      const student = findStudent(registration.studentId)!;
      const program = db.programs.find((row) => row.id === student.programId)!;
      const score = sheet.scores[registration.studentId] ?? { ca: null, exam: null };
      const result = scoreResult(score.ca, score.exam, db.gradeScale);
      return {
        registrationId: registration.id,
        matricNumber: student.matricNumber,
        studentName: `${user.firstName} ${user.lastName}`,
        department: departmentRef(program.departmentId),
        isCarryOver: false,
        ca: score.ca,
        exam: score.exam,
        total: result?.total ?? null,
        grade: result?.grade ?? null,
        gradePoint: result?.gradePoint ?? null,
      };
    })
    .sort((a, b) => a.matricNumber.localeCompare(b.matricNumber));
}

export function sheetSummary(sheet: SheetRow): ResultSheetSummary {
  const allocation = findAllocation(sheet.allocationId)!;
  const course = findCourse(allocation.courseId)!;
  const lecturer = findUser(allocation.lecturerId)!;
  const entries = sheetEntries(sheet);
  return {
    id: sheet.id,
    offeringId: allocation.id,
    course: courseSummary(course),
    department: departmentRef(course.departmentId),
    lecturer: { id: lecturer.id, name: displayName(lecturer) },
    semester: semesterView(allocation.semesterId),
    status: sheet.status,
    editable: sheet.status === "DRAFT" || sheet.status === "REJECTED",
    feedback: sheet.feedback,
    submittedBy: null,
    submittedAt: sheet.submittedAt,
    reviewedBy: null,
    reviewedAt: sheet.reviewedAt,
    studentCount: entries.length,
    scoredCount: entries.filter((entry) => entry.total !== null).length,
  };
}

export function auditView(row: AuditRow): AuditEntry {
  const actor = findUser(row.actorId)!;
  return {
    id: row.id,
    at: row.at,
    actor: { id: actor.id, name: displayName(actor), role: actor.role },
    action: row.action,
    target: row.target,
    details: row.details,
    ipAddress: row.ipAddress,
    department: row.departmentId ? departmentRef(row.departmentId) : null,
  };
}

export function cgpaOf(studentId: number): number | null {
  const results: { units: number; gradePoint: number }[] = [];
  for (const registration of db.registrations.filter((row) => row.studentId === studentId)) {
    const allocation = db.allocations.find(
      (row) => row.courseId === registration.courseId && row.semesterId === registration.semesterId,
    );
    const sheet = allocation && db.sheets.find((row) => row.allocationId === allocation.id);
    const score = sheet?.scores[studentId];
    const result = sheet?.status === "APPROVED" && score ? scoreResult(score.ca, score.exam, db.gradeScale) : null;
    if (result) results.push({ units: findCourse(registration.courseId)!.units, gradePoint: result.gradePoint });
  }
  return weightedAverage(results);
}
