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
  CourseResult,
  CourseSummary,
  Department,
  DepartmentDashboard,
  DepartmentReport,
  Faculty,
  Grade,
  GradeBand,
  GradeDistribution,
  Lecturer,
  LecturerCourse,
  Level,
  Program,
  OfferingRegistration,
  RegistrationCourse,
  RegistrationForm,
  RegistrationFormStatus,
  RegistrationFormSummary,
  RegistrationStudent,
  ResultEntry,
  ResultSheet,
  ResultSheetSummary,
  ResultSubmission,
  Role,
  ScoreInput,
  Semester,
  SessionUser,
  SheetAction,
  SheetEvent,
  SheetStats,
  SheetStatus,
  StaffProfile,
  Student,
  StudentDashboard,
  StudentRegistration,
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
// asks for page numbers rather than following "next", which drf builds on the api's own host
const getAll = async <T>(path: string): Promise<T[]> => {
  const rows: T[] = [];
  for (let page = 1; ; page += 1) {
    const data = await request<{ results: T[]; next: string | null }>(
      `${path}${path.includes("?") ? "&" : "?"}page_size=100&page=${page}`,
    );
    rows.push(...data.results);
    if (!data.next) return rows;
  }
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
  const session = (item.session_detail ?? item.session ?? {}) as Raw;
  return {
    id: Number(item.id),
    name: String(item.term) as Semester["name"],
    isCurrent: Boolean(item.is_current),
    registrationOpen: Boolean(item.registration_open),
    session: ref(session),
  };
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
const mapRegistrationStudent = (item: Raw): RegistrationStudent => ({
  id: Number(item.id), fullName: String(item.name ?? ""), email: String(item.email ?? ""),
  matricNumber: String(item.matric_no), level: Number(item.level) as Level,
  program: { ...ref(item.program), award: String((item.program as Raw).award ?? "") },
  department: ref(item.department) as RegistrationStudent["department"],
  faculty: ref(item.faculty) as RegistrationStudent["faculty"],
});
const mapCourseLine = (item: Raw): RegistrationCourse => ({
  offeringId: Number(item.offering_id), code: String(item.code), title: String(item.title), units: Number(item.units),
  level: Number(item.level) as Level, lecturer: (item.lecturer as string | null) ?? null, isCarryOver: Boolean(item.is_carry_over),
});
const mapFormStatus = (item: Raw): RegistrationFormStatus => {
  const validatedBy = item.validated_by as Raw | null;
  return {
    id: Number(item.id), status: item.status as RegistrationFormStatus["status"], submittedAt: String(item.submitted_at),
    returnReason: String(item.return_reason ?? ""), validatedAt: (item.validated_at as string | null) ?? null,
    validatedBy: validatedBy ? { id: Number(validatedBy.id), name: String(validatedBy.name) } : null,
  };
};
const mapStudentRegistration = (item: Raw): StudentRegistration => ({
  semester: mapSemester(item.semester as Raw), registrationOpen: Boolean(item.registration_open), maxUnits: Number(item.max_units),
  registration: item.registration ? mapFormStatus(item.registration as Raw) : null,
  courses: ((item.courses as Raw[]) ?? []).map((course) => ({ ...mapCourseLine(course), isSelected: Boolean(course.is_selected) })),
});
const mapForm = (item: Raw): RegistrationForm => ({
  ...mapFormStatus(item), student: mapRegistrationStudent(item.student as Raw), semester: mapSemester(item.semester as Raw),
  totalUnits: Number(item.total_units), courses: ((item.courses as Raw[]) ?? []).map(mapCourseLine),
});
const mapFormSummary = (item: Raw): RegistrationFormSummary => ({
  id: Number(item.id), status: item.status as RegistrationFormSummary["status"], submittedAt: String(item.submitted_at),
  validatedAt: (item.validated_at as string | null) ?? null, student: mapRegistrationStudent(item.student as Raw),
  semester: mapSemester(item.semester as Raw), totalUnits: Number(item.total_units), courseCount: Number(item.course_count),
});
const mapOfferingRegistration = (item: Raw): OfferingRegistration => {
  const offering = item.offering as Raw;
  return {
    id: Number(item.id), student: mapRegistrationStudent(item.student as Raw),
    offering: { id: Number(offering.id), code: String(offering.code), title: String(offering.title), units: Number(offering.units) },
    formId: Number(item.form_id), formStatus: item.form_status as OfferingRegistration["formStatus"],
    registeredAt: String(item.registered_at),
  };
};
const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));
const person = (value: unknown) => {
  const item = value as Raw | null;
  return item ? { id: Number(item.id), name: String(item.name) } : null;
};
const mapCourseRef = (item: Raw): CourseSummary => ({
  id: Number(item.id), code: String(item.code), title: String(item.title), units: Number(item.units), level: Number(item.level) as Level,
});
const mapLecturerCourse = (item: Raw): LecturerCourse => ({
  offeringId: Number(item.id), sheetId: Number(item.sheet_id), course: mapCourseRef(item.course as Raw),
  semester: mapSemester(item.semester as Raw), sheetStatus: item.sheet_status as SheetStatus,
  studentCount: Number(item.student_count), scoredCount: Number(item.scored_count),
});
const mapEntry = (item: Raw): ResultEntry => ({
  registrationId: Number(item.registration_id), matricNumber: String(item.matric_no), studentName: String(item.name),
  department: ref(item.department), isCarryOver: Boolean(item.is_carry_over), ca: num(item.ca_score), exam: num(item.exam_score),
  total: num(item.total), grade: (item.grade as Grade | null) ?? null, gradePoint: num(item.grade_point),
});
const mapEvent = (item: Raw): SheetEvent => ({
  at: String(item.at), action: item.action as SheetAction, actor: person(item.actor), note: (item.note as string) || null,
});
const mapSheetSummary = (item: Raw): ResultSheetSummary => ({
  id: Number(item.id), offeringId: Number(item.offering_id), course: mapCourseRef(item.course as Raw), department: ref(item.department),
  lecturer: person(item.lecturer), semester: mapSemester(item.semester as Raw), status: item.status as SheetStatus,
  editable: Boolean(item.editable), feedback: (item.feedback as string) || null, submittedBy: person(item.submitted_by),
  submittedAt: (item.submitted_at as string | null) ?? null, reviewedBy: person(item.reviewed_by),
  reviewedAt: (item.reviewed_at as string | null) ?? null, studentCount: Number(item.student_count), scoredCount: Number(item.scored_count),
});
const mapSubmission = (item: Raw): ResultSubmission => ({
  ...mapSheetSummary(item), timeline: ((item.timeline as Raw[]) ?? []).map(mapEvent),
});
const mapStats = (item: Raw): SheetStats => ({
  students: Number(item.students), scored: Number(item.scored), incomplete: Number(item.incomplete), average: num(item.average),
  highest: num(item.highest), lowest: num(item.lowest), passRate: num(item.pass_rate), distribution: item.distribution as GradeDistribution,
});
const mapSheet = (item: Raw): ResultSheet => ({
  ...mapSubmission(item), entries: ((item.entries as Raw[]) ?? []).map(mapEntry), summary: mapStats(item.summary as Raw),
});
const mapCourseResult = (item: Raw): CourseResult => ({
  registrationId: Number(item.registration_id), code: String(item.code), title: String(item.title), units: Number(item.units),
  ca: num(item.ca), exam: num(item.exam), total: Number(item.total), grade: item.grade as Grade, gradePoint: Number(item.point),
  isCarryOver: Boolean(item.is_carry_over),
});
const mapStudentResults = (item: Raw): StudentResults => ({
  student: mapRegistrationStudent(item.student as Raw),
  semesters: ((item.semesters as Raw[]) ?? []).map((result) => ({
    semester: mapSemester(result.semester as Raw), courses: ((result.courses as Raw[]) ?? []).map(mapCourseResult),
    units: Number(result.units), gpa: Number(result.gpa),
  })),
  cgpa: num(item.cgpa), unitsAttempted: Number(item.units_attempted), unitsPassed: Number(item.units_passed),
});
const mapGradeBand = (item: Raw): GradeBand => ({
  grade: item.grade as Grade, min: Number(item.min), max: Number(item.max), point: Number(item.point),
});
// a field left out of the patch keeps its saved value, null clears it
const toScoreInput = (score: ScoreInput) => ({
  registration_id: score.registrationId,
  ...(score.ca !== undefined ? { ca_score: score.ca } : {}),
  ...(score.exam !== undefined ? { exam_score: score.exam } : {}),
});
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
  getRegistration: async () => mapStudentRegistration(await get<Raw>("student/registration/")),
  submitRegistration: async (offeringIds: number[]) =>
    mapStudentRegistration(await put<Raw>("student/registration/", { offering_ids: offeringIds })),
  getRegistrationSlip: async (): Promise<RegistrationForm | null> => {
    try {
      return mapForm(await get<Raw>("student/registration/slip/"));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  getMyResults: async () => mapStudentResults(await get<Raw>("student/results/")),

  getMyOfferings: async (semesterId?: number) =>
    (await get<Raw[]>(`lecturer/offerings/${semesterId ? `?semester=${semesterId}` : ""}`)).map(mapLecturerCourse),
  getLecturerSheet: async (offeringId: number) => mapSheet(await get<Raw>(`lecturer/offerings/${offeringId}/sheet/`)),
  saveScores: async (offeringId: number, scores: ScoreInput[]) =>
    mapSheet(await patch<Raw>(`lecturer/offerings/${offeringId}/sheet/entries/`, { entries: scores.map(toScoreInput) })),
  submitSheet: async (offeringId: number, confirmIncomplete: boolean) =>
    mapSheet(await post<Raw>(`lecturer/offerings/${offeringId}/sheet/submit/`, { confirm_incomplete: confirmIncomplete })),
  getMySubmissions: async () => (await get<Raw[]>("lecturer/submissions/")).map(mapSubmission),

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
  getRegistrationForms: async (semesterId: number) =>
    (await getAll<Raw>(`registration-forms/?semester=${semesterId}`)).map(mapFormSummary),
  getRegistrationForm: async (id: number) => mapForm(await get<Raw>(`registration-forms/${id}/`)),
  validateRegistrationForm: async (id: number) => mapForm(await post<Raw>(`registration-forms/${id}/validate/`)),
  returnRegistrationForm: async (id: number, reason: string) =>
    mapForm(await post<Raw>(`registration-forms/${id}/return/`, { reason })),
  getOfferings: async (semesterId: number) => (await getAll<Raw>(`offerings/?semester=${semesterId}`)).map(mapOffering),
  getOfferingRegistrations: async (offeringId: number) =>
    (await getAll<Raw>(`registrations/?offering=${offeringId}`)).map(mapOfferingRegistration),
  getResultSheets: async () => (await getAll<Raw>("result-sheets/")).map(mapSheetSummary),
  getResultSheet: async (id: number) => mapSheet(await get<Raw>(`result-sheets/${id}/`)),
  approveSheet: async (id: number) => mapSheet(await post<Raw>(`result-sheets/${id}/approve/`)),
  rejectSheet: async (id: number, feedback: string) => mapSheet(await post<Raw>(`result-sheets/${id}/reject/`, { feedback })),
  reopenSheet: async (id: number, reason: string) => mapSheet(await post<Raw>(`result-sheets/${id}/reopen/`, { reason })),
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
  setRegistrationOpen: async (semesterId: number, open: boolean) =>
    mapSemester(await patch<Raw>(`semesters/${semesterId}/`, { registration_open: open })),
  getUsers: async () => (await getList<Raw>("users/")).map(mapUser),
  getUser: async (id: number) => mapUserDetail(await get<Raw>(`users/${id}/`)),
  updateUserStatus: async (id: number, status: UserStatus) => mapUser(await post<Raw>(`users/${id}/${status.toLowerCase()}/`)) as UserAccount,
  updateUserRole: async (id: number, input: UserRoleInput) => mapUser(await patch<Raw>(`users/${id}/`, { role: input.role, department: input.departmentId })) as UserAccount,
  changePassword: (input: { current_password: string; new_password: string }) =>
    post<{ detail: string }>("auth/change-password/", input),
  getUniversityReport: () => get<UniversityReport>("reports/university/"),
  getAuditLog: () => get<AuditEntry[]>("audit-log/"),
  getGradeScale: async () => (await get<Raw[]>("grade-scale/")).map(mapGradeBand),
  updateGradeScale: async (bands: GradeBand[]) => (await put<Raw[]>("grade-scale/", { bands })).map(mapGradeBand),
};

export type Api = typeof remoteApi;
