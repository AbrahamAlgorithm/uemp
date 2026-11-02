import { LEVELS, ROLE_LABELS, USER_STATUS_LABELS } from "../../constants";
import { formatDate } from "../../format";
import { summarise } from "../../grading";
import { gradeScaleSchema, type DepartmentInput, type FacultyInput, type SessionInput, type UserRoleInput } from "../../schemas";
import type {
  AcademicSession,
  AdminDashboard,
  Department,
  Faculty,
  GradeBand,
  SheetStatus,
  UniversityReport,
  UserDetail,
  UserStatus,
} from "../../types";
import { db, nextId } from "../db";
import type { DepartmentRow, FacultyRow, SessionRow } from "../seed";
import { currentUser, fail, logAudit, requireRole, sleep } from "../session";
import {
  auditView,
  currentSemesterRow,
  departmentRef,
  displayName,
  facultyRefForDepartment,
  findAllocation,
  findCourse,
  findStaff,
  findStudent,
  findUser,
  semesterView,
  sheetEntries,
  sheetSummary,
  staffView,
  studentResults,
  studentView,
  userAccountView,
} from "../views";
import { programDepartment } from "./department";

const ROLE_ORDER = { SUPER_ADMIN: 0, DEPT_ADMIN: 1, LECTURER: 2, STUDENT: 3 } as const;

const studentsIn = (departmentId: number) =>
  db.students.filter((row) => programDepartment(row.programId) === departmentId);

function facultyView(faculty: FacultyRow): Faculty {
  const departments = db.departments.filter((row) => row.facultyId === faculty.id);
  return {
    ...faculty,
    departmentCount: departments.length,
    studentCount: departments.reduce((sum, department) => sum + studentsIn(department.id).length, 0),
  };
}

function departmentView(department: DepartmentRow): Department {
  const faculty = db.faculties.find((row) => row.id === department.facultyId)!;
  return {
    id: department.id,
    code: department.code,
    name: department.name,
    faculty: { id: faculty.id, code: faculty.code, name: faculty.name },
    programCount: db.programs.filter((row) => row.departmentId === department.id).length,
    studentCount: studentsIn(department.id).length,
    lecturerCount: db.users.filter((user) => user.role === "LECTURER" && user.departmentId === department.id).length,
  };
}

function sessionView(session: SessionRow): AcademicSession {
  const semesters = db.semesters.filter((row) => row.sessionId === session.id).map((row) => semesterView(row.id));
  return { ...session, isCurrent: semesters.some((row) => row.isCurrent), semesters };
}

function managedUser(id: number) {
  const admin = requireRole("SUPER_ADMIN");
  const user = findUser(id);
  if (!user) fail(404, "User not found.");
  if (user.id === admin.id) fail(400, "You can't change your own account here.");
  return { admin, user };
}

export const adminHandlers = {
  async getAdminDashboard(): Promise<AdminDashboard> {
    await sleep();
    requireRole("SUPER_ADMIN");
    const semester = currentSemesterRow();
    const submitted = db.sheets.map(sheetSummary).filter((sheet) => sheet.status === "SUBMITTED");
    return {
      semester: semesterView(semester.id),
      counts: {
        students: db.students.length,
        lecturers: db.users.filter((user) => user.role === "LECTURER" && user.status === "ACTIVE").length,
        faculties: db.faculties.length,
        departments: db.departments.length,
        courses: db.courses.length,
        registrations: db.registrations.filter((row) => row.semesterId === semester.id).length,
      },
      pendingByDepartment: db.departments
        .map((department) => {
          const pending = submitted.filter((sheet) => sheet.department.id === department.id);
          return {
            department: departmentRef(department.id),
            faculty: facultyRefForDepartment(department.id).name,
            pending: pending.length,
            oldestSubmittedAt: pending.map((sheet) => sheet.submittedAt!).sort()[0] ?? null,
          };
        })
        .sort((a, b) => b.pending - a.pending),
      recentActivity: db.audit.slice(0, 8).map(auditView),
    };
  },

  async getFaculties() {
    await sleep();
    requireRole("SUPER_ADMIN");
    return db.faculties.map(facultyView);
  },

  async createFaculty(input: FacultyInput) {
    await sleep();
    const admin = requireRole("SUPER_ADMIN");
    if (db.faculties.some((row) => row.code === input.code)) fail(400, `A faculty already uses the code ${input.code}.`);
    const faculty = { id: nextId(db.faculties), ...input };
    db.faculties.push(faculty);
    logAudit(admin, "CREATE", faculty.name, `Added faculty ${faculty.code}`, null);
    return facultyView(faculty);
  },

  async updateFaculty(id: number, input: FacultyInput) {
    await sleep();
    const admin = requireRole("SUPER_ADMIN");
    const faculty = db.faculties.find((row) => row.id === id);
    if (!faculty) fail(404, "Faculty not found.");
    if (db.faculties.some((row) => row.code === input.code && row.id !== id)) fail(400, `A faculty already uses the code ${input.code}.`);
    Object.assign(faculty, input);
    logAudit(admin, "UPDATE", faculty.name, "Updated faculty details", null);
    return facultyView(faculty);
  },

  async getDepartments() {
    await sleep();
    requireRole("SUPER_ADMIN");
    return db.departments.map(departmentView);
  },

  async createDepartment(input: DepartmentInput) {
    await sleep();
    const admin = requireRole("SUPER_ADMIN");
    if (db.departments.some((row) => row.code === input.code)) fail(400, `A department already uses the code ${input.code}.`);
    if (!db.faculties.some((row) => row.id === input.facultyId)) fail(400, "Select a valid faculty.");
    const department = { id: nextId(db.departments), ...input };
    db.departments.push(department);
    logAudit(admin, "CREATE", department.name, `Added department ${department.code}`, department.id);
    return departmentView(department);
  },

  async updateDepartment(id: number, input: DepartmentInput) {
    await sleep();
    const admin = requireRole("SUPER_ADMIN");
    const department = db.departments.find((row) => row.id === id);
    if (!department) fail(404, "Department not found.");
    if (db.departments.some((row) => row.code === input.code && row.id !== id)) {
      fail(400, `A department already uses the code ${input.code}.`);
    }
    Object.assign(department, input);
    logAudit(admin, "UPDATE", department.name, "Updated department details", department.id);
    return departmentView(department);
  },

  async getSessions() {
    await sleep();
    requireRole("SUPER_ADMIN");
    return [...db.sessions].sort((a, b) => b.name.localeCompare(a.name)).map(sessionView);
  },

  async createSession(input: SessionInput) {
    await sleep();
    const admin = requireRole("SUPER_ADMIN");
    if (db.sessions.some((row) => row.name === input.name)) fail(400, `${input.name} already exists.`);
    const session = { id: nextId(db.sessions), ...input };
    db.sessions.push(session);
    const firstId = nextId(db.semesters);
    db.semesters.push(
      { id: firstId, sessionId: session.id, name: "FIRST", isCurrent: false },
      { id: firstId + 1, sessionId: session.id, name: "SECOND", isCurrent: false },
    );
    logAudit(admin, "CREATE", `${session.name} session`, `Runs ${formatDate(session.startDate)} to ${formatDate(session.endDate)}`, null);
    return sessionView(session);
  },

  async setCurrentSemester(semesterId: number) {
    await sleep();
    const admin = requireRole("SUPER_ADMIN");
    const semester = db.semesters.find((row) => row.id === semesterId);
    if (!semester) fail(404, "Semester not found.");
    for (const row of db.semesters) row.isCurrent = row.id === semesterId;
    const view = semesterView(semester.id);
    logAudit(admin, "SET_CURRENT_SEMESTER", `${view.session.name} ${semester.name === "FIRST" ? "First" : "Second"} semester`, "Registration and score entry now use this semester", null);
    return view;
  },

  async getUsers() {
    await sleep();
    requireRole("SUPER_ADMIN");
    return db.users
      .map(userAccountView)
      .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.lastName.localeCompare(b.lastName));
  },

  async getUser(id: number): Promise<UserDetail> {
    await sleep();
    requireRole("SUPER_ADMIN");
    const user = findUser(id);
    if (!user) fail(404, "User not found.");
    const student = findStudent(id);
    return {
      ...userAccountView(user),
      student: student ? studentView(student) : null,
      staff: findStaff(id) ? staffView(user) : null,
      recentActivity: db.audit.filter((row) => row.actorId === id).slice(0, 10).map(auditView),
    };
  },

  async updateUserStatus(id: number, status: UserStatus) {
    await sleep();
    const { admin, user } = managedUser(id);
    if (user.status === status) fail(400, `This account is already ${USER_STATUS_LABELS[status].toLowerCase()}.`);
    const previous = user.status;
    user.status = status;
    logAudit(admin, "CHANGE_STATUS", displayName(user), `${USER_STATUS_LABELS[previous]} to ${USER_STATUS_LABELS[status]}`, user.departmentId);
    return userAccountView(user);
  },

  async updateUserRole(id: number, input: UserRoleInput) {
    await sleep();
    const { admin, user } = managedUser(id);
    if (user.role === "STUDENT") fail(400, "A student's department follows their program. Edit the student record instead.");
    if (input.role === "STUDENT") fail(400, "Staff accounts can't become student accounts.");
    const departmentId = input.role === "SUPER_ADMIN" ? null : input.departmentId;
    if (departmentId !== null && !db.departments.some((row) => row.id === departmentId)) fail(400, "Select a valid department.");
    const previous = `${ROLE_LABELS[user.role]}${user.departmentId ? `, ${departmentRef(user.departmentId).code}` : ""}`;
    user.role = input.role;
    user.departmentId = departmentId;
    const next = `${ROLE_LABELS[user.role]}${departmentId ? `, ${departmentRef(departmentId).code}` : ""}`;
    logAudit(admin, "CHANGE_ROLE", displayName(user), `${previous} to ${next}`, departmentId);
    return userAccountView(user);
  },

  async getUniversityReport(): Promise<UniversityReport> {
    await sleep();
    requireRole("SUPER_ADMIN");
    const semester = currentSemesterRow();
    const resultStatus: Record<SheetStatus, number> = { DRAFT: 0, SUBMITTED: 0, APPROVED: 0, REJECTED: 0 };
    for (const sheet of db.sheets) {
      if (findAllocation(sheet.allocationId)!.semesterId === semester.id) resultStatus[sheet.status] += 1;
    }
    return {
      semester: semesterView(semester.id),
      departments: db.departments.map((department) => {
        const students = studentsIn(department.id);
        const cgpas = students.map((row) => studentResults(row.userId).cgpa).filter((value): value is number => value !== null);
        const approved = db.sheets
          .filter(
            (sheet) =>
              sheet.status === "APPROVED" &&
              findCourse(findAllocation(sheet.allocationId)!.courseId)!.departmentId === department.id,
          )
          .flatMap(sheetEntries);
        return {
          department: departmentRef(department.id),
          faculty: facultyRefForDepartment(department.id).name,
          students: students.length,
          lecturers: db.users.filter((user) => user.role === "LECTURER" && user.status === "ACTIVE" && user.departmentId === department.id).length,
          courses: db.courses.filter((course) => course.departmentId === department.id).length,
          registrations: db.registrations.filter(
            (row) => row.semesterId === semester.id && findCourse(row.courseId)!.departmentId === department.id,
          ).length,
          averageCgpa: cgpas.length ? cgpas.reduce((sum, value) => sum + value, 0) / cgpas.length : null,
          passRate: summarise(approved).passRate,
        };
      }),
      studentsByLevel: LEVELS.map((level) => ({ level, count: db.students.filter((row) => row.level === level).length })),
      resultStatus,
    };
  },

  async getAuditLog() {
    await sleep();
    requireRole("SUPER_ADMIN");
    return db.audit.map(auditView);
  },

  async getGradeScale() {
    await sleep(80);
    currentUser();
    return structuredClone(db.gradeScale);
  },

  async updateGradeScale(bands: GradeBand[]) {
    await sleep();
    const admin = requireRole("SUPER_ADMIN");
    const parsed = gradeScaleSchema.safeParse({ bands });
    if (!parsed.success) fail(400, parsed.error.issues[0]?.message ?? "The grade scale is invalid.");
    db.gradeScale = structuredClone(parsed.data.bands);
    logAudit(admin, "UPDATE_GRADE_SCALE", "Grade scale", bands.map((band) => `${band.grade} ${band.min}-${band.max}`).join(", "), null);
    return structuredClone(db.gradeScale);
  },
};
