import { MAX_UNITS_PER_SEMESTER } from "../constants";
import { DEFAULT_GRADE_SCALE } from "../grading";
import type { AuditAction, GradeBand, SemesterName, SheetAction, SheetStatus } from "../types";
import {
  ADDRESSES,
  COURSES,
  CURRENT_PLAN,
  CURRENT_SESSION_ID,
  DEMO_USER_IDS,
  DEPARTMENTS,
  FACULTIES,
  IP_ADDRESSES,
  PROGRAMS,
  SEMESTERS,
  SESSIONS,
  STAFF,
  STUDENTS,
  type CourseRow,
  type DepartmentRow,
  type FacultyRow,
  type ProgramRow,
  type SemesterRow,
  type SessionRow,
  type StaffRow,
  type StudentRow,
  type UserRow,
} from "./seed";

export interface AllocationRow {
  id: number;
  courseId: number;
  lecturerId: number;
  semesterId: number;
}

export interface RegistrationRow {
  id: number;
  studentId: number;
  courseId: number;
  semesterId: number;
  registeredAt: string;
}

export interface SheetEventRow {
  at: string;
  action: SheetAction;
  actorId: number;
  note: string | null;
}

export interface SheetRow {
  id: number;
  allocationId: number;
  status: SheetStatus;
  scores: Record<number, { ca: number | null; exam: number | null }>;
  submittedAt: string | null;
  reviewedAt: string | null;
  feedback: string | null;
  history: SheetEventRow[];
}

export interface AuditRow {
  id: number;
  at: string;
  actorId: number;
  action: AuditAction;
  target: string;
  details: string;
  ipAddress: string;
  departmentId: number | null;
}

export interface Db {
  faculties: FacultyRow[];
  departments: DepartmentRow[];
  programs: ProgramRow[];
  sessions: SessionRow[];
  semesters: SemesterRow[];
  users: UserRow[];
  students: StudentRow[];
  staff: StaffRow[];
  courses: CourseRow[];
  allocations: AllocationRow[];
  registrations: RegistrationRow[];
  sheets: SheetRow[];
  audit: AuditRow[];
  gradeScale: GradeBand[];
}

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let r = Math.imul(state ^ (state >>> 15), 1 | state);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function at(date: string, days = 0, hour = 9, minute = 0): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  value.setUTCHours(hour, minute);
  return value.toISOString();
}

export function nextId(rows: { id: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
}

export function availableCourses(courses: CourseRow[], programId: number, level: number, semester: SemesterName) {
  return courses
    .filter((course) => course.level === level && course.semester === semester && course.programIds.includes(programId))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function semesterWindow(semester: SemesterRow, sessions: SessionRow[]) {
  const session = sessions.find((row) => row.id === semester.sessionId)!;
  const endYear = session.name.slice(5);
  return semester.name === "FIRST"
    ? { start: session.startDate, end: `${endYear}-02-20` }
    : { start: `${endYear}-03-02`, end: session.endDate };
}

function buildPeople() {
  const users: UserRow[] = [];
  const staff: StaffRow[] = [];
  const students: StudentRow[] = [];
  const pick = random(7);
  const phone = () => `${["080", "081", "070", "090", "091"][Math.floor(pick() * 5)]}${String(Math.floor(pick() * 1e8)).padStart(8, "0")}`;
  const recentLogin = () => at("2026-10-20", Math.floor(pick() * 12), 8 + Math.floor(pick() * 9), Math.floor(pick() * 60));

  for (const person of STAFF) {
    const department = DEPARTMENTS.find((row) => row.id === person.departmentId);
    const email =
      person.role === "SUPER_ADMIN"
        ? "registry@crestview.edu.ng"
        : person.role === "DEPT_ADMIN"
          ? `${department!.code.toLowerCase()}.admin@crestview.edu.ng`
          : `${person.firstName[0]}.${person.lastName}@crestview.edu.ng`.toLowerCase();
    users.push({
      id: person.id,
      email,
      firstName: person.firstName,
      lastName: person.lastName,
      role: person.role,
      status: person.status,
      departmentId: person.departmentId,
      phone: phone(),
      dateJoined: at("2014-09-01", person.id * 97),
      lastLogin: person.status === "ACTIVE" ? recentLogin() : null,
    });
    staff.push({
      userId: person.id,
      staffId: `CVU/${department?.code ?? "REG"}/${String(person.id * 7 + 3).padStart(3, "0")}`,
      title: person.title,
      rank: person.rank,
      office: person.office,
    });
  }

  for (const person of STUDENTS) {
    const program = PROGRAMS.find((row) => row.id === person.programId)!;
    const department = DEPARTMENTS.find((row) => row.id === program.departmentId)!;
    const entry = SESSIONS.find((row) => row.id === person.entrySessionId)!;
    const level = (CURRENT_SESSION_ID - person.entrySessionId + 1) * 100;
    users.push({
      id: person.id,
      email: `${person.firstName}.${person.lastName}@student.crestview.edu.ng`.toLowerCase(),
      firstName: person.firstName,
      lastName: person.lastName,
      role: "STUDENT",
      status: person.status,
      departmentId: department.id,
      phone: phone(),
      dateJoined: at(entry.startDate),
      lastLogin: person.status === "ACTIVE" ? recentLogin() : null,
    });
    students.push({
      userId: person.id,
      matricNumber: `${department.code}/${entry.name.slice(0, 4)}/${String(((person.id * 37) % 900) + 10).padStart(4, "0")}`,
      programId: program.id,
      level,
      gender: person.gender,
      dateOfBirth: `${2026 - 17 - level / 100 - Math.floor(pick() * 3)}-${String(1 + Math.floor(pick() * 12)).padStart(2, "0")}-${String(1 + Math.floor(pick() * 28)).padStart(2, "0")}`,
      address: ADDRESSES[Math.floor(pick() * ADDRESSES.length)]!,
      entrySessionId: entry.id,
      ability: person.id === DEMO_USER_IDS.STUDENT ? 0.8 : 0.38 + pick() * 0.5,
    });
  }

  return { users, staff, students };
}

function buildRegistrations(students: StudentRow[], users: UserRow[]) {
  const registrations: RegistrationRow[] = [];
  const pick = random(11);
  const demoSelection = ["CSC 301", "CSC 305", "CSC 307", "CSC 309"];

  for (const semester of SEMESTERS) {
    if (semester.sessionId > CURRENT_SESSION_ID || (semester.sessionId === CURRENT_SESSION_ID && !semester.isCurrent)) continue;
    const { start } = semesterWindow(semester, SESSIONS);

    for (const student of students) {
      const status = users.find((user) => user.id === student.userId)!.status;
      if (semester.isCurrent && status !== "ACTIVE") continue;
      const level = student.level - (CURRENT_SESSION_ID - semester.sessionId) * 100;
      if (level < 100) continue;

      let courses = availableCourses(COURSES, student.programId, level, semester.name);
      if (semester.isCurrent && student.userId === DEMO_USER_IDS.STUDENT) {
        courses = courses.filter((course) => demoSelection.includes(course.code));
      }

      let units = 0;
      const registeredAt = at(start, 2 + Math.floor(pick() * 12), 9 + Math.floor(pick() * 8), Math.floor(pick() * 60));
      for (const course of courses) {
        if (units + course.units > MAX_UNITS_PER_SEMESTER) continue;
        units += course.units;
        registrations.push({
          id: registrations.length + 1,
          studentId: student.userId,
          courseId: course.id,
          semesterId: semester.id,
          registeredAt,
        });
      }
    }
  }
  return registrations;
}

function buildResults(registrations: RegistrationRow[], students: StudentRow[], users: UserRow[]) {
  const allocations: AllocationRow[] = [];
  const sheets: SheetRow[] = [];
  const activeLecturers = (departmentId: number) =>
    users.filter((user) => user.role === "LECTURER" && user.status === "ACTIVE" && user.departmentId === departmentId);
  const departmentAdmin = (departmentId: number) =>
    users.find((user) => user.role === "DEPT_ADMIN" && user.departmentId === departmentId)!;

  for (const semester of SEMESTERS) {
    const { end } = semesterWindow(semester, SESSIONS);
    const offered = semester.isCurrent
      ? COURSES.filter((course) => course.semester === semester.name)
      : COURSES.filter((course) =>
          registrations.some((row) => row.semesterId === semester.id && row.courseId === course.id),
        );

    for (const course of offered) {
      const plan = semester.isCurrent ? CURRENT_PLAN[course.code] : undefined;
      const pool = activeLecturers(course.departmentId);
      const lecturerId = plan ? plan.lecturerId : pool[course.id % pool.length]!.id;
      if (lecturerId === null) continue;

      const allocation = { id: allocations.length + 1, courseId: course.id, lecturerId, semesterId: semester.id };
      allocations.push(allocation);

      const status: SheetStatus = semester.isCurrent ? (plan?.status ?? "DRAFT") : "APPROVED";
      const filled = status === "DRAFT" ? (plan?.filled ?? 0) : 1;
      const registered = registrations.filter((row) => row.semesterId === semester.id && row.courseId === course.id);
      const scores: SheetRow["scores"] = {};
      registered.slice(0, Math.ceil(registered.length * filled)).forEach((row) => {
        const ability = students.find((student) => student.userId === row.studentId)!.ability;
        const noise = random(row.studentId * 1000 + course.id * 7 + semester.id);
        scores[row.studentId] = {
          ca: clamp(Math.round(30 * (ability + (noise() - 0.5) * 0.3)), 6, 30),
          exam: clamp(Math.round(70 * (ability - 0.05 + (noise() - 0.5) * 0.36)), 10, 70),
        };
      });

      const sheet: SheetRow = {
        id: allocation.id,
        allocationId: allocation.id,
        status,
        scores,
        submittedAt: null,
        reviewedAt: null,
        feedback: null,
        history: [],
      };

      if (status !== "DRAFT") {
        sheet.submittedAt = semester.isCurrent
          ? at("2026-10-26", course.id % 6, 10 + (course.id % 7), (course.id * 13) % 60)
          : at(end, -12, 11, (course.id * 7) % 60);
        sheet.history.push({ at: sheet.submittedAt, action: "SUBMITTED", actorId: lecturerId, note: null });
      }
      if (status === "APPROVED" || status === "REJECTED") {
        const reviewer = departmentAdmin(course.departmentId);
        sheet.reviewedAt = new Date(new Date(sheet.submittedAt!).getTime() + (semester.isCurrent ? 1 : 3) * 86_400_000).toISOString();
        if (status === "REJECTED") {
          const [first, second] = registered.map(
            (row) => students.find((student) => student.userId === row.studentId)!.matricNumber,
          );
          sheet.feedback = `Exam scores for ${first} and ${second} don't match the marked scripts. Please correct them and resubmit.`;
        }
        sheet.history.push({ at: sheet.reviewedAt, action: status, actorId: reviewer.id, note: sheet.feedback });
      }
      sheets.push(sheet);
    }
  }
  return { allocations, sheets };
}

function buildAudit(db: Omit<Db, "audit" | "gradeScale">) {
  const rows: Omit<AuditRow, "id" | "ipAddress">[] = [];
  const courseOf = (allocationId: number) =>
    db.courses.find((course) => course.id === db.allocations.find((row) => row.id === allocationId)!.courseId)!;
  const current = db.semesters.find((semester) => semester.isCurrent)!;

  rows.push({
    at: at("2026-10-05", 0, 9, 12),
    actorId: DEMO_USER_IDS.SUPER_ADMIN,
    action: "SET_CURRENT_SEMESTER",
    target: "2026/2027 First semester",
    details: "Opened course registration for the new session",
    departmentId: null,
  });
  rows.push({
    at: at("2026-10-06", 0, 11, 40),
    actorId: DEMO_USER_IDS.DEPT_ADMIN,
    action: "CREATE",
    target: "CSC 409 Cloud Computing",
    details: "Added course for 400 level, first semester",
    departmentId: 1,
  });

  for (const allocation of db.allocations.filter((row) => row.semesterId === current.id)) {
    const course = db.courses.find((row) => row.id === allocation.courseId)!;
    const lecturer = db.users.find((user) => user.id === allocation.lecturerId)!;
    const admin = db.users.find((user) => user.role === "DEPT_ADMIN" && user.departmentId === course.departmentId)!;
    rows.push({
      at: at("2026-10-07", course.id % 3, 10 + (course.id % 6), (course.id * 11) % 60),
      actorId: admin.id,
      action: "ASSIGN_LECTURER",
      target: `${course.code} ${course.title}`,
      details: `Assigned ${lecturer.firstName} ${lecturer.lastName}`,
      departmentId: course.departmentId,
    });
  }

  const currentRegistrations = db.registrations.filter((row) => row.semesterId === current.id);
  for (const studentId of new Set(currentRegistrations.map((row) => row.studentId))) {
    const rowsForStudent = currentRegistrations.filter((row) => row.studentId === studentId);
    const units = rowsForStudent.reduce(
      (sum, row) => sum + db.courses.find((course) => course.id === row.courseId)!.units,
      0,
    );
    rows.push({
      at: rowsForStudent[0]!.registeredAt,
      actorId: studentId,
      action: "REGISTER_COURSES",
      target: `${rowsForStudent.length} courses`,
      details: `${units} units for 2026/2027 First semester`,
      departmentId: db.users.find((user) => user.id === studentId)!.departmentId,
    });
  }

  for (const sheet of db.sheets) {
    const course = courseOf(sheet.allocationId);
    if (db.allocations.find((row) => row.id === sheet.allocationId)!.semesterId !== current.id) continue;
    for (const event of sheet.history) {
      rows.push({
        at: event.at,
        actorId: event.actorId,
        action: event.action === "SUBMITTED" ? "SUBMIT_RESULTS" : event.action === "APPROVED" ? "APPROVE_RESULTS" : "REJECT_RESULTS",
        target: `${course.code} ${course.title}`,
        details: event.note ?? `${Object.keys(sheet.scores).length} students`,
        departmentId: course.departmentId,
      });
    }
  }

  rows.push(
    {
      at: at("2026-10-20", 0, 14, 5),
      actorId: DEMO_USER_IDS.SUPER_ADMIN,
      action: "CHANGE_STATUS",
      target: "Abubakar Sani",
      details: "Suspended pending a disciplinary panel review",
      departmentId: 1,
    },
    {
      at: at("2026-10-09", 0, 15, 30),
      actorId: DEMO_USER_IDS.SUPER_ADMIN,
      action: "CHANGE_STATUS",
      target: "Obinna Agu",
      details: "Deactivated after deferring admission to 2027/2028",
      departmentId: 1,
    },
  );

  for (const user of db.users.filter((row) => row.lastLogin)) {
    rows.push({
      at: user.lastLogin!,
      actorId: user.id,
      action: "LOGIN",
      target: user.email,
      details: "Signed in with email and password",
      departmentId: user.departmentId,
    });
  }

  return rows
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((row, index) => ({ ...row, id: rows.length - index, ipAddress: IP_ADDRESSES[index % IP_ADDRESSES.length]! }));
}

function createDb(): Db {
  const { users, staff, students } = buildPeople();
  const registrations = buildRegistrations(students, users);
  const { allocations, sheets } = buildResults(registrations, students, users);
  const base = {
    faculties: structuredClone(FACULTIES),
    departments: structuredClone(DEPARTMENTS),
    programs: structuredClone(PROGRAMS),
    sessions: structuredClone(SESSIONS),
    semesters: structuredClone(SEMESTERS),
    users,
    students,
    staff,
    courses: structuredClone(COURSES),
    allocations,
    registrations,
    sheets,
  };
  return { ...base, audit: buildAudit(base), gradeScale: structuredClone(DEFAULT_GRADE_SCALE) };
}

export const db = createDb();
