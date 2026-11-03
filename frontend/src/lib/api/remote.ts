import type {
  CourseInput,
  DepartmentInput,
  FacultyInput,
  LecturerInput,
  LoginInput,
  ProgramInput,
  SessionInput,
  StaffContactInput,
  StudentContactInput,
  StudentInput,
  UserRoleInput,
} from "../schemas";
import type {
  AcademicSession,
  AdminDashboard,
  AuditEntry,
  Course,
  CourseAllocation,
  Department,
  DepartmentDashboard,
  DepartmentReport,
  Faculty,
  GradeBand,
  Lecturer,
  LecturerCourse,
  Level,
  MyCourses,
  Program,
  Registration,
  RegistrationOptions,
  ResultSheet,
  ResultSheetSummary,
  Role,
  ScoreInput,
  Semester,
  SessionUser,
  StaffProfile,
  Student,
  StudentDashboard,
  StudentResults,
  UniversityReport,
  UserAccount,
  UserDetail,
  UserStatus,
} from "../types";
import { ApiError, request } from "./http";

const get = <T>(path: string) => request<T>(path);
const getList = async <T>(path: string): Promise<T[]> => {
  const data = await request<T[] | { results: T[] }>(path);
  return Array.isArray(data) ? data : data.results;
};
const post = <T>(path: string, json?: unknown) => request<T>(path, { method: "POST", json });
const patch = <T>(path: string, json: unknown) => request<T>(path, { method: "PATCH", json });
const put = <T>(path: string, json: unknown) => request<T>(path, { method: "PUT", json });

interface MeResponse {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  status: UserStatus;
  department: { id: number; name: string; code: string } | null;
}

function toSessionUser(me: MeResponse): SessionUser {
  return {
    id: me.id,
    email: me.email,
    firstName: me.first_name,
    lastName: me.last_name,
    fullName: [me.first_name, me.last_name].filter(Boolean).join(" ") || me.email,
    role: me.role,
    department: me.department && { id: me.department.id, name: me.department.name, code: me.department.code },
  };
}

type Raw = Record<string, unknown>;
const ref = (value: unknown) => {
  const item = value as Raw;
  return { id: Number(item.id), name: String(item.name ?? ""), code: String(item.code ?? "") };
};
const mapSemester = (item: Raw): Semester => {
  const session = (item.session_detail ?? {}) as Raw;
  return { id: Number(item.id), name: String(item.term) as Semester["name"], isCurrent: Boolean(item.is_current), session: ref(session) };
};
const mapFaculty = (item: Raw): Faculty => ({
  id: Number(item.id), name: String(item.name), code: String(item.code),
  departmentCount: Number(item.department_count ?? 0), studentCount: Number(item.student_count ?? 0),
});
const mapDepartment = (item: Raw): Department => ({
  id: Number(item.id), name: String(item.name), code: String(item.code),
  faculty: ref(item.faculty_detail), programCount: Number(item.program_count ?? 0),
  studentCount: Number(item.student_count ?? 0), lecturerCount: Number(item.lecturer_count ?? 0),
});
const mapProgram = (item: Raw): Program => ({
  id: Number(item.id), name: String(item.name), award: String(item.award), durationYears: Number(item.duration_years),
  department: ref(item.department_detail), levels: ((item.levels as number[]) ?? []) as Level[],
  studentsByLevel: (item.students_by_level as Program["studentsByLevel"]) ?? [], courseCount: Number(item.course_count ?? 0),
});
const mapSession = (item: Raw): AcademicSession => ({
  id: Number(item.id), name: String(item.name), startDate: String(item.start_date ?? ""),
  endDate: String(item.end_date ?? ""), isCurrent: Boolean(item.is_current),
  semesters: ((item.semesters as Raw[]) ?? []).map(mapSemester),
});
const mapUser = (item: Raw): UserAccount => ({
  id: Number(item.id), email: String(item.email), firstName: String(item.first_name ?? ""),
  lastName: String(item.last_name ?? ""), fullName: `${String(item.first_name ?? "")} ${String(item.last_name ?? "")}`.trim() || String(item.email),
  role: item.role as UserAccount["role"], status: item.status as UserStatus, department: item.department_detail ? ref(item.department_detail) as UserAccount["department"] : null,
  identifier: item.identifier as string | null, phone: String(item.phone ?? ""), dateJoined: String(item.date_joined ?? ""),
  lastLogin: item.last_login as string | null,
});
const mapUserDetail = (item: Raw): UserDetail => ({
  ...mapUser(item),
  student: item.student ? mapStudent(item.student as Raw) : null,
  staff: item.staff ? mapStaff(item.staff as Raw) : null,
  recentActivity: ((item.recent_activity as Raw[]) ?? []).map((entry) => ({
    id: Number(entry.id),
    at: String(entry.at),
    action: entry.action as AuditEntry["action"],
    target: String(entry.target ?? ""),
    details: String(entry.details ?? ""),
    actor: { id: Number(item.id), name: String(item.email), role: item.role as AuditEntry["actor"]["role"] },
    ipAddress: "",
    department: null,
  })),
});
const mapStudent = (item: Raw): Student => ({
  id: Number(item.id), matricNumber: String(item.matric_no), firstName: String(item.first_name ?? ""),
  lastName: String(item.last_name ?? ""), fullName: `${String(item.first_name ?? "")} ${String(item.last_name ?? "")}`.trim(),
  email: String(item.email), phone: String(item.phone ?? ""), address: String(item.address ?? ""),
  gender: item.gender as Student["gender"], dateOfBirth: String(item.date_of_birth ?? ""),
  status: item.status as UserStatus, level: Number(item.level) as Student["level"], faculty: ref(item.faculty) as Student["faculty"],
  department: ref(item.department) as Student["department"],
  program: { ...ref(item.program_detail), award: String((item.program_detail as Raw)?.award ?? "") },
  entrySession: String((item.entry_session as Raw | null)?.name ?? ""),
});
const mapStaff = (item: Raw): StaffProfile => ({
  id: Number(item.id), staffId: String(item.staff_id), title: String(item.title ?? ""),
  firstName: String(item.first_name ?? ""), lastName: String(item.last_name ?? ""),
  fullName: `${String(item.first_name ?? "")} ${String(item.last_name ?? "")}`.trim(),
  email: String(item.email), phone: String(item.phone ?? ""), status: item.status as UserStatus,
  role: item.role as StaffProfile["role"], faculty: item.faculty ? ref(item.faculty) as StaffProfile["faculty"] : null,
  department: item.department ? ref(item.department) as StaffProfile["department"] : null,
});
const mapCourse = (item: Raw): Course => ({
  id: Number(item.id), code: String(item.code), title: String(item.title), units: Number(item.units),
  level: Number(item.level) as Course["level"], semester: item.semester as Course["semester"],
  department: ref(item.department_detail) as Course["department"],
  programs: ((item.program_details as Raw[]) ?? []).map((program) => ({ id: Number(program.id), name: String(program.name) })),
});
const mapOffering = (item: Raw): CourseAllocation => {
  const course = item.course_detail as Raw;
  const lecturer = item.lecturer_detail as Raw | null;
  return {
    allocationId: Number(item.id), course: { id: Number(course.id), code: String(course.code), title: String(course.title), units: Number(course.units), level: Number(course.level) as Course["level"], department: ref(course.department) as Course["department"] },
    lecturer: lecturer ? { id: Number(lecturer.id), name: String(lecturer.name), staffId: String(lecturer.staff_id) } : null,
    sheetStatus: item.sheet_status as CourseAllocation["sheetStatus"], studentCount: 0,
  };
};
const toStudentInput = (input: StudentInput) => ({
  first_name: input.firstName, last_name: input.lastName, email: input.email, matric_no: input.matricNumber,
  program: input.programId, level: input.level, gender: input.gender, phone: input.phone,
  ...(input.initialPassword ? { initial_password: input.initialPassword } : {}),
});
const toStaffInput = (input: LecturerInput) => ({
  first_name: input.firstName, last_name: input.lastName, email: input.email, staff_id: input.staffId,
  title: input.title, phone: input.phone,
  ...(input.initialPassword ? { initial_password: input.initialPassword } : {}),
});
const toCourseInput = (input: CourseInput) => ({
  code: input.code, title: input.title, units: input.units, level: input.level, semester: input.semester,
  department: input.departmentId, programs: input.programIds,
});
const toProgramInput = (input: ProgramInput) => ({
  name: input.name, award: input.award, duration_years: input.durationYears, department: input.departmentId,
});
const toDepartmentInput = (input: DepartmentInput) => ({ name: input.name, code: input.code, faculty: input.facultyId });
const toSessionInput = (input: SessionInput) => ({ name: input.name, start_date: input.startDate, end_date: input.endDate });

export const remoteApi = {
  login: async (input: LoginInput) =>
    toSessionUser(await request<MeResponse>("auth/login/", { method: "POST", json: input, refresh: false, redirectToLogin: false })),
  logout: () => request<void>("auth/logout/", { method: "POST", refresh: false, redirectToLogin: false }),
  getSession: async (): Promise<SessionUser | null> => {
    try {
      return toSessionUser(await request<MeResponse>("auth/me/", { redirectToLogin: false }));
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
      throw error;
    }
  },
  getCurrentSemester: async () => mapSemester(await get<Raw>("semesters/current/")),

  getStudentDashboard: () => get<StudentDashboard>("student/dashboard/"),
  getStudentProfile: () => get<Student>("student/profile/"),
  updateStudentContact: (input: StudentContactInput) => patch<Student>("student/profile/", input),
  getRegistrationOptions: () => get<RegistrationOptions>("student/registration/"),
  registerCourses: (courseIds: number[]) => post<void>("student/registration/", { courseIds }),
  getMyCourses: () => get<MyCourses>("student/courses/"),
  getMyResults: () => get<StudentResults>("student/results/"),

  getMyAllocations: () => get<LecturerCourse[]>("lecturer/courses/"),
  getLecturerCourse: (allocationId: number) =>
    get<{ course: LecturerCourse; sheet: ResultSheet }>(`lecturer/courses/${allocationId}/`),
  saveScores: (sheetId: number, scores: ScoreInput[]) => put<ResultSheet>(`result-sheets/${sheetId}/scores/`, { scores }),
  submitSheet: (sheetId: number) => post<ResultSheet>(`result-sheets/${sheetId}/submit/`),
  getMySubmissions: () => get<ResultSheetSummary[]>("lecturer/submissions/"),

  getStaffProfile: () => get<StaffProfile>("staff/profile/"),
  updateStaffContact: (input: StaffContactInput) => patch<StaffProfile>("staff/profile/", input),

  getDepartmentDashboard: () => get<DepartmentDashboard>("department/dashboard/"),
  getStudents: async () => (await getList<Raw>("students/")).map(mapStudent),
  createStudent: async (input: StudentInput) => mapStudent(await post<Raw>("students/", toStudentInput(input))),
  updateStudent: async (id: number, input: StudentInput) => mapStudent(await patch<Raw>(`students/${id}/`, toStudentInput(input))),
  getLecturers: async () => (await getList<Raw>("staff/?role=LECTURER")).map(mapStaff) as Lecturer[],
  createLecturer: async (input: LecturerInput) => mapStaff(await post<Raw>("staff/", { ...toStaffInput(input), role: "LECTURER" })) as Lecturer,
  updateLecturer: async (id: number, input: LecturerInput) => mapStaff(await patch<Raw>(`staff/${id}/`, toStaffInput(input))) as Lecturer,
  getCourses: async () => (await getList<Raw>("courses/")).map(mapCourse),
  createCourse: async (input: CourseInput) => mapCourse(await post<Raw>("courses/", toCourseInput(input))),
  updateCourse: async (id: number, input: CourseInput) => mapCourse(await patch<Raw>(`courses/${id}/`, toCourseInput(input))),
  getPrograms: async () => (await getList<Raw>("programs/")).map(mapProgram),
  createProgram: async (input: ProgramInput) => mapProgram(await post<Raw>("programs/", toProgramInput(input))),
  updateProgram: async (id: number, input: ProgramInput) => mapProgram(await patch<Raw>(`programs/${id}/`, toProgramInput(input))),
  getAllocations: async () => (await getList<Raw>("offerings/")).map(mapOffering),
  assignLecturer: async (courseId: number, lecturerId: number) => {
    const offerings = await getList<Raw>("offerings/");
    const offering = offerings.find((item) => Number((item.course_detail as Raw).id) === courseId);
    if (!offering) throw new ApiError(404, { detail: "This course has no offering for the current semester." });
    return mapOffering(await patch<Raw>(`offerings/${Number(offering.id)}/`, { lecturer: lecturerId }));
  },
  getRegistrations: () => get<Registration[]>("registrations/"),
  getResultSheets: () => get<ResultSheetSummary[]>("result-sheets/"),
  getResultSheet: (id: number) => get<ResultSheet>(`result-sheets/${id}/`),
  approveSheet: (id: number) => post<ResultSheet>(`result-sheets/${id}/approve/`),
  rejectSheet: (id: number, feedback: string) => post<ResultSheet>(`result-sheets/${id}/reject/`, { feedback }),
  reopenSheet: (id: number, reason: string) => post<ResultSheet>(`result-sheets/${id}/reopen/`, { reason }),
  getDepartmentReport: () => get<DepartmentReport>("reports/department/"),

  getAdminDashboard: () => get<AdminDashboard>("admin/dashboard/"),
  getFaculties: async () => (await getList<Raw>("faculties/")).map(mapFaculty),
  createFaculty: async (input: FacultyInput) => mapFaculty(await post<Raw>("faculties/", input)),
  updateFaculty: async (id: number, input: FacultyInput) => mapFaculty(await patch<Raw>(`faculties/${id}/`, input)),
  getDepartments: async () => (await getList<Raw>("departments/")).map(mapDepartment),
  createDepartment: async (input: DepartmentInput) => mapDepartment(await post<Raw>("departments/", toDepartmentInput(input))),
  updateDepartment: async (id: number, input: DepartmentInput) => mapDepartment(await patch<Raw>(`departments/${id}/`, toDepartmentInput(input))),
  getSessions: async () => (await getList<Raw>("sessions/")).map(mapSession),
  createSession: async (input: SessionInput) => mapSession(await post<Raw>("sessions/", toSessionInput(input))),
  setCurrentSemester: async (semesterId: number) => mapSemester(await post<Raw>(`semesters/${semesterId}/set-current/`)),
  getUsers: async () => (await getList<Raw>("users/")).map(mapUser),
  getUser: async (id: number) => mapUserDetail(await get<Raw>(`users/${id}/`)),
  updateUserStatus: async (id: number, status: UserStatus) => mapUser(await post<Raw>(`users/${id}/${status.toLowerCase()}/`)) as UserAccount,
  updateUserRole: async (id: number, input: UserRoleInput) => mapUser(await patch<Raw>(`users/${id}/`, { role: input.role, department: input.departmentId })) as UserAccount,
  changePassword: (input: { current_password: string; new_password: string }) =>
    post<{ detail: string }>("auth/change-password/", input),
  getUniversityReport: () => get<UniversityReport>("reports/university/"),
  getAuditLog: () => get<AuditEntry[]>("audit-log/"),
  getGradeScale: () => get<GradeBand[]>("grade-scale/"),
  updateGradeScale: (bands: GradeBand[]) => put<GradeBand[]>("grade-scale/", { bands }),
};

export type Api = typeof remoteApi;
