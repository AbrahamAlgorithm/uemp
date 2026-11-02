import { summarise } from "../../grading";
import type { CourseInput, LecturerInput, ProgramInput, StudentInput } from "../../schemas";
import type { CourseAllocation, DepartmentDashboard, DepartmentReport, Level, Program, Registration } from "../../types";
import { db, nextId } from "../db";
import type { CourseRow, ProgramRow, UserRow } from "../seed";
import { departmentScope, fail, inScope, logAudit, now, requireRole, sleep } from "../session";
import {
  auditView,
  courseSummary,
  courseView,
  currentSemesterRow,
  departmentRef,
  displayName,
  facultyRefForDepartment,
  findCourse,
  findStaff,
  findStudent,
  findUser,
  lecturerView,
  registrationsFor,
  semesterView,
  sheetEntries,
  sheetSummary,
  studentView,
} from "../views";

export const programDepartment = (programId: number) => db.programs.find((row) => row.id === programId)!.departmentId;

function manager() {
  const user = requireRole("DEPT_ADMIN", "SUPER_ADMIN");
  return { user, scope: departmentScope(user) };
}

function ownDepartment() {
  const user = requireRole("DEPT_ADMIN");
  return { user, departmentId: user.departmentId! };
}

function assertUniqueEmail(email: string, exceptId?: number) {
  if (db.users.some((user) => user.email === email.toLowerCase() && user.id !== exceptId)) {
    fail(400, "Another account already uses this email address.");
  }
}

function targetDepartment(user: UserRow, departmentId: number) {
  const id = user.role === "SUPER_ADMIN" ? departmentId : user.departmentId!;
  if (!db.departments.some((row) => row.id === id)) fail(400, "Select a valid department.");
  return id;
}

export function programView(program: ProgramRow): Program {
  const levels = Array.from({ length: program.durationYears }, (_, index) => ((index + 1) * 100) as Level);
  const students = db.students.filter((row) => row.programId === program.id);
  return {
    id: program.id,
    name: program.name,
    award: program.award,
    durationYears: program.durationYears,
    department: departmentRef(program.departmentId),
    levels,
    studentsByLevel: levels.map((level) => ({ level, count: students.filter((row) => row.level === level).length })),
    courseCount: db.courses.filter((course) => course.programIds.includes(program.id)).length,
  };
}

export function allocationView(course: CourseRow, semesterId: number): CourseAllocation {
  const allocation = db.allocations.find((row) => row.courseId === course.id && row.semesterId === semesterId);
  const lecturer = allocation && findUser(allocation.lecturerId);
  const sheet = allocation && db.sheets.find((row) => row.allocationId === allocation.id);
  return {
    allocationId: allocation?.id ?? null,
    course: { ...courseSummary(course), department: departmentRef(course.departmentId) },
    lecturer: lecturer ? { id: lecturer.id, name: displayName(lecturer), staffId: findStaff(lecturer.id)!.staffId } : null,
    sheetStatus: sheet?.status ?? null,
    studentCount: registrationsFor(course.id, semesterId).length,
  };
}

function applyStudent(user: UserRow, input: StudentInput, departmentId: number) {
  user.firstName = input.firstName;
  user.lastName = input.lastName;
  user.email = input.email.toLowerCase();
  user.phone = input.phone;
  user.departmentId = departmentId;
}

function applyCourse(course: CourseRow, input: CourseInput, departmentId: number) {
  if (db.courses.some((row) => row.code === input.code && row.id !== course.id)) {
    fail(400, `${input.code} already exists.`);
  }
  if (input.programIds.some((id) => !db.programs.some((program) => program.id === id))) {
    fail(400, "One of the selected programs doesn't exist.");
  }
  Object.assign(course, {
    code: input.code,
    title: input.title,
    units: input.units,
    level: input.level,
    semester: input.semester,
    departmentId,
    programIds: input.programIds,
  });
}

export const departmentHandlers = {
  async getDepartmentDashboard(): Promise<DepartmentDashboard> {
    await sleep();
    const { departmentId } = ownDepartment();
    const semester = currentSemesterRow();
    const pending = db.sheets
      .map(sheetSummary)
      .filter((sheet) => sheet.department.id === departmentId && sheet.status === "SUBMITTED")
      .sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""));
    const offered = db.courses.filter((course) => course.departmentId === departmentId && course.semester === semester.name);
    return {
      department: { ...departmentRef(departmentId), faculty: facultyRefForDepartment(departmentId).name },
      semester: semesterView(semester.id),
      counts: {
        students: db.students.filter((row) => programDepartment(row.programId) === departmentId).length,
        lecturers: db.users.filter((user) => user.role === "LECTURER" && user.status === "ACTIVE" && user.departmentId === departmentId).length,
        courses: db.courses.filter((course) => course.departmentId === departmentId).length,
        pendingApprovals: pending.length,
      },
      pending,
      unallocatedCourses: offered.filter(
        (course) => !db.allocations.some((row) => row.courseId === course.id && row.semesterId === semester.id),
      ).length,
      recentActivity: db.audit.filter((row) => row.departmentId === departmentId).slice(0, 8).map(auditView),
    };
  },

  async getStudents() {
    await sleep();
    const { scope } = manager();
    return db.students
      .filter((row) => inScope(scope, programDepartment(row.programId)))
      .map(studentView)
      .sort((a, b) => a.matricNumber.localeCompare(b.matricNumber));
  },

  async createStudent(input: StudentInput) {
    await sleep();
    const { user, scope } = manager();
    const program = db.programs.find((row) => row.id === input.programId);
    if (!program || !inScope(scope, program.departmentId)) fail(400, "Select a program in your department.");
    if (input.level > program.durationYears * 100) fail(400, `${program.name} only runs to ${program.durationYears * 100} level.`);
    assertUniqueEmail(input.email);
    if (db.students.some((row) => row.matricNumber === input.matricNumber)) fail(400, `${input.matricNumber} is already in use.`);

    const id = nextId(db.users);
    const account: UserRow = {
      id,
      email: "",
      firstName: "",
      lastName: "",
      role: "STUDENT",
      status: "ACTIVE",
      departmentId: program.departmentId,
      phone: "",
      dateJoined: now(),
      lastLogin: null,
    };
    applyStudent(account, input, program.departmentId);
    db.users.push(account);
    const record = {
      userId: id,
      matricNumber: input.matricNumber,
      programId: program.id,
      level: input.level,
      gender: input.gender,
      dateOfBirth: "",
      address: "",
      entrySessionId: currentSemesterRow().sessionId - input.level / 100 + 1,
      ability: 0.6,
    };
    db.students.push(record);
    logAudit(user, "CREATE", `${input.firstName} ${input.lastName}`, `Added student ${input.matricNumber}`, program.departmentId);
    return studentView(record);
  },

  async updateStudent(id: number, input: StudentInput) {
    await sleep();
    const { user, scope } = manager();
    const record = findStudent(id);
    const program = db.programs.find((row) => row.id === input.programId);
    if (!record || !inScope(scope, programDepartment(record.programId))) fail(404, "Student not found.");
    if (!program || !inScope(scope, program.departmentId)) fail(400, "Select a program in your department.");
    assertUniqueEmail(input.email, id);
    if (db.students.some((row) => row.matricNumber === input.matricNumber && row.userId !== id)) {
      fail(400, `${input.matricNumber} is already in use.`);
    }
    applyStudent(findUser(id)!, input, program.departmentId);
    Object.assign(record, { matricNumber: input.matricNumber, programId: program.id, level: input.level, gender: input.gender });
    logAudit(user, "UPDATE", `${input.firstName} ${input.lastName}`, "Updated student record", program.departmentId);
    return studentView(record);
  },

  async getLecturers() {
    await sleep();
    const { scope } = manager();
    return db.users
      .filter((user) => user.role === "LECTURER" && inScope(scope, user.departmentId))
      .map(lecturerView)
      .sort((a, b) => a.lastName.localeCompare(b.lastName));
  },

  async createLecturer(input: LecturerInput) {
    await sleep();
    const { user, departmentId } = ownDepartment();
    assertUniqueEmail(input.email);
    if (db.staff.some((row) => row.staffId === input.staffId)) fail(400, `${input.staffId} is already in use.`);
    const id = nextId(db.users);
    const account: UserRow = {
      id,
      email: input.email.toLowerCase(),
      firstName: input.firstName,
      lastName: input.lastName,
      role: "LECTURER",
      status: "ACTIVE",
      departmentId,
      phone: input.phone,
      dateJoined: now(),
      lastLogin: null,
    };
    db.users.push(account);
    db.staff.push({ userId: id, staffId: input.staffId, title: input.title, rank: input.rank, office: "To be assigned" });
    logAudit(user, "CREATE", displayName(account), `Added lecturer ${input.staffId}`);
    return lecturerView(account);
  },

  async updateLecturer(id: number, input: LecturerInput) {
    await sleep();
    const { user, departmentId } = ownDepartment();
    const account = findUser(id);
    if (!account || account.role !== "LECTURER" || account.departmentId !== departmentId) fail(404, "Lecturer not found.");
    assertUniqueEmail(input.email, id);
    if (db.staff.some((row) => row.staffId === input.staffId && row.userId !== id)) fail(400, `${input.staffId} is already in use.`);
    Object.assign(account, { email: input.email.toLowerCase(), firstName: input.firstName, lastName: input.lastName, phone: input.phone });
    Object.assign(findStaff(id)!, { staffId: input.staffId, title: input.title, rank: input.rank });
    logAudit(user, "UPDATE", displayName(account), "Updated lecturer record");
    return lecturerView(account);
  },

  async getCourses() {
    await sleep();
    const { scope } = manager();
    return db.courses
      .filter((course) => inScope(scope, course.departmentId))
      .map(courseView)
      .sort((a, b) => a.code.localeCompare(b.code));
  },

  async createCourse(input: CourseInput) {
    await sleep();
    const { user } = manager();
    const course = { id: nextId(db.courses) } as CourseRow;
    applyCourse(course, input, targetDepartment(user, input.departmentId));
    db.courses.push(course);
    logAudit(user, "CREATE", `${course.code} ${course.title}`, `Added course for ${course.level} level`, course.departmentId);
    return courseView(course);
  },

  async updateCourse(id: number, input: CourseInput) {
    await sleep();
    const { user, scope } = manager();
    const course = findCourse(id);
    if (!course || !inScope(scope, course.departmentId)) fail(404, "Course not found.");
    applyCourse(course, input, targetDepartment(user, input.departmentId));
    logAudit(user, "UPDATE", `${course.code} ${course.title}`, "Updated course details", course.departmentId);
    return courseView(course);
  },

  async getPrograms() {
    await sleep();
    const { scope } = manager();
    return db.programs.filter((program) => inScope(scope, program.departmentId)).map(programView);
  },

  async createProgram(input: ProgramInput) {
    await sleep();
    const { user } = manager();
    const program = { id: nextId(db.programs), ...input, departmentId: targetDepartment(user, input.departmentId) };
    db.programs.push(program);
    logAudit(user, "CREATE", `${program.award} ${program.name}`, `${program.durationYears}-year program`, program.departmentId);
    return programView(program);
  },

  async updateProgram(id: number, input: ProgramInput) {
    await sleep();
    const { user, scope } = manager();
    const program = db.programs.find((row) => row.id === id);
    if (!program || !inScope(scope, program.departmentId)) fail(404, "Program not found.");
    const tooShort = db.students.some((row) => row.programId === id && row.level > input.durationYears * 100);
    if (tooShort) fail(400, "Some students are already above the new final level for this program.");
    Object.assign(program, { ...input, departmentId: targetDepartment(user, input.departmentId) });
    logAudit(user, "UPDATE", `${program.award} ${program.name}`, "Updated program details", program.departmentId);
    return programView(program);
  },

  async getAllocations() {
    await sleep();
    const { scope } = manager();
    const semester = currentSemesterRow();
    return db.courses
      .filter((course) => course.semester === semester.name && inScope(scope, course.departmentId))
      .sort((a, b) => a.level - b.level || a.code.localeCompare(b.code))
      .map((course) => allocationView(course, semester.id));
  },

  async assignLecturer(courseId: number, lecturerId: number) {
    await sleep();
    const { user, scope } = manager();
    const semester = currentSemesterRow();
    const course = findCourse(courseId);
    if (!course || !inScope(scope, course.departmentId)) fail(404, "Course not found.");
    if (course.semester !== semester.name) fail(400, "This course isn't offered this semester.");
    const lecturer = findUser(lecturerId);
    if (!lecturer || lecturer.role !== "LECTURER" || lecturer.status !== "ACTIVE") fail(400, "Select an active lecturer.");
    if (lecturer.departmentId !== course.departmentId) fail(400, "The lecturer must belong to the department that offers this course.");

    const existing = db.allocations.find((row) => row.courseId === courseId && row.semesterId === semester.id);
    if (existing) {
      const sheet = db.sheets.find((row) => row.allocationId === existing.id)!;
      if (sheet.status !== "DRAFT" || Object.keys(sheet.scores).length > 0) {
        fail(409, "Scores have already been entered for this course, so the lecturer can't be changed.");
      }
      existing.lecturerId = lecturerId;
    } else {
      const allocation = { id: nextId(db.allocations), courseId, lecturerId, semesterId: semester.id };
      db.allocations.push(allocation);
      db.sheets.push({
        id: nextId(db.sheets),
        allocationId: allocation.id,
        status: "DRAFT",
        scores: {},
        submittedAt: null,
        reviewedAt: null,
        feedback: null,
        history: [],
      });
    }
    logAudit(user, "ASSIGN_LECTURER", `${course.code} ${course.title}`, `Assigned ${displayName(lecturer)}`, course.departmentId);
    return allocationView(course, semester.id);
  },

  async getRegistrations(): Promise<Registration[]> {
    await sleep();
    const { scope } = manager();
    const semester = currentSemesterRow();
    return db.registrations
      .filter((row) => row.semesterId === semester.id)
      .map((row) => ({ row, course: findCourse(row.courseId)!, student: findStudent(row.studentId)! }))
      .filter(
        ({ course, student }) =>
          inScope(scope, course.departmentId) || inScope(scope, programDepartment(student.programId)),
      )
      .map(({ row, course, student }) => {
        const user = findUser(student.userId)!;
        return {
          id: row.id,
          student: {
            id: user.id,
            fullName: displayName(user),
            matricNumber: student.matricNumber,
            level: student.level as Level,
            program: db.programs.find((program) => program.id === student.programId)!.name,
          },
          course: { ...courseSummary(course), department: departmentRef(course.departmentId) },
          semester: semesterView(semester.id),
          registeredAt: row.registeredAt,
        };
      });
  },

  async getDepartmentReport(): Promise<DepartmentReport> {
    await sleep();
    const { departmentId } = ownDepartment();
    const semester = currentSemesterRow();
    const offered = db.courses
      .filter((course) => course.departmentId === departmentId && course.semester === semester.name)
      .sort((a, b) => a.code.localeCompare(b.code));
    const performance = offered.flatMap((course) => {
      const allocation = db.allocations.find((row) => row.courseId === course.id && row.semesterId === semester.id);
      const sheet = allocation && db.sheets.find((row) => row.allocationId === allocation.id);
      if (!sheet) return [];
      const entries = sheetEntries(sheet);
      const summary = summarise(entries);
      if (summary.scored === 0) return [];
      return [
        {
          course: courseSummary(course),
          status: sheet.status,
          students: entries.length,
          average: summary.average,
          passRate: summary.passRate,
          distribution: summary.distribution,
        },
      ];
    });
    return {
      department: departmentRef(departmentId),
      semester: semesterView(semester.id),
      students: db.students
        .filter((row) => programDepartment(row.programId) === departmentId)
        .map(studentView)
        .sort((a, b) => a.level - b.level || a.matricNumber.localeCompare(b.matricNumber)),
      registrations: offered.map((course) => ({
        course: courseSummary(course),
        registered: registrationsFor(course.id, semester.id).length,
      })),
      performance,
    };
  },
};
