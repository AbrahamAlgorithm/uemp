import type {
  CourseInput,
  DepartmentInput,
  FacultyInput,
  LecturerInput,
  LoginInput,
  ProfileInput,
  ProgramInput,
  SessionInput,
  StudentInput,
  UserRoleInput,
} from "../schemas";
import type {
  AcademicSession,
  AdminOverview,
  AuditDetail,
  AuditFilters,
  AuditQuery,
  AuditRow,
  Course,
  CourseAllocation,
  CourseResult,
  CourseSummary,
  Department,
  DepartmentAdmin,
  DepartmentOverview,
  Faculty,
  Grade,
  GradeBand,
  GradeDistribution,
  GradeScale,
  ImportReport,
  ImportRow,
  Lecturer,
  LecturerCourse,
  LecturerOverview,
  Level,
  LevelSummary,
  MyCourse,
  MyCourses,
  MySession,
  OfferingRegistration,
  Page,
  Program,
  RegistrationCourse,
  RegistrationForm,
  RegistrationFormStatus,
  RegistrationFormSummary,
  RegistrationStudent,
  Report,
  ReportKind,
  ReportQuery,
  ResultEntry,
  ResultSheet,
  ResultSheetSummary,
  ResultStatement,
  ResultSubmission,
  Role,
  ScoreInput,
  Semester,
  SemesterCourses,
  SemesterRecord,
  SessionUser,
  SheetAction,
  SheetEvent,
  SheetStats,
  SheetStatus,
  StaffProfile,
  Student,
  StudentOverview,
  StudentRecord,
  StudentRegistration,
  StudentResults,
  UserAccount,
  UserDetail,
  UserStatus,
} from "../types";
import { ApiError, request, requestFile } from "./http";

const get = <T>(path: string) => request<T>(path);
// asks for page numbers rather than following "next", which drf builds on the api's own host
const getList = async <T>(path: string): Promise<T[]> => {
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
    id: Number(entry.id), at: String(entry.at), actor: { id: Number(item.id), name: String(item.email), email: String(item.email), role: item.role as Role },
    actorEmail: String(item.email), action: String(entry.action), entityType: "", entityId: "", target: String(entry.target ?? ""),
    details: String(entry.details ?? ""), department: null, ipAddress: null,
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
  entrySession: String((item.entry_session_detail as Raw | null)?.name ?? ""),
});
const mapStaff = (item: Raw): StaffProfile => ({
  id: Number(item.id), userId: Number(item.user_id ?? 0), staffId: String(item.staff_id), title: String(item.title ?? ""),
  firstName: String(item.first_name ?? ""), lastName: String(item.last_name ?? ""),
  fullName: `${String(item.first_name ?? "")} ${String(item.last_name ?? "")}`.trim(),
  email: String(item.email), phone: String(item.phone ?? ""), status: item.status as UserStatus,
  role: item.role as StaffProfile["role"], faculty: item.faculty ? ref(item.faculty) as StaffProfile["faculty"] : null,
  department: item.department ? ref(item.department) as StaffProfile["department"] : null,
});
const mapLecturer = (item: Raw): Lecturer => ({
  ...mapStaff(item),
  department: ref(item.department) as Lecturer["department"],
  currentOfferings: ((item.current_offerings as Raw[]) ?? []).map((offering) => ({
    id: Number(offering.id), code: String(offering.code), title: String(offering.title), units: Number(offering.units),
  })),
  totalUnits: Number(item.total_units ?? 0),
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
const num = (value: unknown) => (value as number | null | undefined) ?? null;
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
  feedback: (item.feedback as string) || null, studentCount: Number(item.student_count), scoredCount: Number(item.scored_count),
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
  ca: num(item.ca_score), exam: num(item.exam_score), total: item.total as number, grade: item.grade as Grade,
  gradePoint: item.grade_point as number,
  isCarryOver: Boolean(item.is_carry_over),
});
const mapStudentResults = (item: Raw): StudentResults => ({
  student: mapRegistrationStudent(item.student as Raw),
  semesters: ((item.semesters as Raw[]) ?? []).map((result) => ({
    semester: mapSemester(result.semester as Raw), courses: ((result.courses as Raw[]) ?? []).map(mapCourseResult),
    units: Number(result.units), gpa: result.gpa as number,
  })),
  cgpa: num(item.cgpa), unitsAttempted: Number(item.units_attempted), unitsPassed: Number(item.units_passed),
});
const mapGradeBand = (item: Raw): GradeBand => ({
  grade: item.grade as Grade, min: Number(item.min), max: Number(item.max), point: item.point as number,
});
const mapGradeScale = (item: Raw): GradeScale => ({
  bands: ((item.bands as Raw[]) ?? []).map(mapGradeBand), isDefault: Boolean(item.is_default),
});
const mapImportRow = (item: Raw): ImportRow => ({
  rowNumber: Number(item.row_number), matricNumber: String(item.matric_no ?? ""), name: (item.name as string | null) ?? null,
  status: item.status as ImportRow["status"], caBefore: num(item.ca_before), caAfter: num(item.ca_after),
  examBefore: num(item.exam_before), examAfter: num(item.exam_after), error: (item.error as string | null) ?? null,
});
const mapImportReport = (item: Raw): ImportReport => {
  const summary = item.summary as Raw;
  return {
    summary: {
      rows: Number(summary.rows), willChange: Number(summary.will_change), unchanged: Number(summary.unchanged),
      errors: Number(summary.errors),
    },
    rows: ((item.rows as Raw[]) ?? []).map(mapImportRow),
  };
};
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

const query = (params: object) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
};

const mapOverviewSemester = (item: Raw | null) => (item ? mapSemester(item) : null);
const mapAuditRow = (item: Raw): AuditRow => {
  const actor = item.actor as Raw | null;
  const department = item.department as Raw | null;
  return {
    id: Number(item.id), at: String(item.at),
    actor: actor ? { id: Number(actor.id), name: String(actor.name), email: String(actor.email), role: actor.role as Role } : null,
    actorEmail: String(item.actor_email ?? ""), action: String(item.action), entityType: String(item.entity_type),
    entityId: String(item.entity_id), target: String(item.target ?? ""), details: String(item.details ?? ""),
    department: department ? (ref(department) as AuditRow["department"]) : null, ipAddress: (item.ip_address as string | null) ?? null,
  };
};
const mapMyCourse = (item: Raw): MyCourse => ({
  offeringId: Number(item.offering_id), code: String(item.code), title: String(item.title), units: Number(item.units),
  lecturer: (item.lecturer as string | null) ?? null, isCarryOver: Boolean(item.is_carry_over), ca: num(item.ca_score),
  exam: num(item.exam_score), total: num(item.total), grade: (item.grade as Grade | null) ?? null, gradePoint: num(item.grade_point),
});
const mapRecord = (item: Raw): SemesterRecord => {
  const registration = item.registration as Raw;
  return {
    semester: mapSemester(item.semester as Raw),
    registration: {
      status: registration.status as SemesterRecord["registration"]["status"], returnReason: String(registration.return_reason ?? ""),
      submittedAt: (registration.submitted_at as string | null) ?? null, validatedAt: (registration.validated_at as string | null) ?? null,
    },
    courses: ((item.courses as Raw[]) ?? []).map(mapMyCourse), totalUnits: Number(item.total_units), gpa: num(item.gpa),
  };
};
const mapSemesterCourses = (item: Raw): SemesterCourses => ({
  ...mapRecord(item), isCurrent: Boolean(item.is_current), registrationOpen: Boolean(item.registration_open),
});
const mapCarryOvers = (items: unknown) =>
  ((items as Raw[]) ?? []).map((item) => ({ code: String(item.code), title: String(item.title), units: Number(item.units) }));
const mapLevel = (item: Raw): LevelSummary => ({
  level: Number(item.level) as Level, studentCount: Number(item.student_count),
  entrySessions: ((item.entry_sessions as Raw[]) ?? []).map((session) => ({
    id: Number(session.id), name: String(session.name), studentCount: Number(session.student_count),
  })),
});
const mapReport = (item: Raw): Report => ({
  title: String(item.title), department: item.department ? (ref(item.department) as Report["department"]) : null,
  semester: mapOverviewSemester(item.semester as Raw | null), tables: item.tables as Report["tables"],
});

interface ProfileResponse extends MeResponse {
  profile: Raw | null;
  department: ({ faculty: { id: number; name: string; code: string } } & NonNullable<MeResponse["department"]>) | null;
}

const fullName = (me: MeResponse) => [me.first_name, me.last_name].filter(Boolean).join(" ") || me.email;

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
  changePassword: (input: { current_password: string; new_password: string }) =>
    post<{ detail: string }>("auth/change-password/", input),

  getStudentProfile: async (): Promise<Student> => {
    const me = await get<ProfileResponse>("auth/me/");
    const profile = (me.profile ?? {}) as Raw;
    const program = profile.program as Raw;
    const entry = profile.entry_session as Raw | null;
    return {
      id: me.id, matricNumber: String(profile.matric_no), firstName: me.first_name, lastName: me.last_name, fullName: fullName(me),
      email: me.email, phone: String(profile.phone ?? ""), address: String(profile.address ?? ""),
      gender: profile.gender as Student["gender"], dateOfBirth: String(profile.date_of_birth ?? ""), status: me.status,
      level: Number(profile.level) as Level, faculty: ref(me.department?.faculty) as Student["faculty"],
      department: ref(me.department) as Student["department"], program: { ...ref(program), award: String(program.award ?? "") },
      entrySession: String(entry?.name ?? ""),
    };
  },
  updateProfile: (input: ProfileInput) =>
    patch<MeResponse>("auth/me/profile/", {
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.dateOfBirth !== undefined ? { date_of_birth: input.dateOfBirth } : {}),
    }),
  getStaffProfile: async (): Promise<StaffProfile> => {
    const me = await get<ProfileResponse>("auth/me/");
    const profile = (me.profile ?? {}) as Raw;
    return {
      id: me.id, userId: me.id, staffId: String(profile.staff_id), title: String(profile.title ?? ""), firstName: me.first_name, lastName: me.last_name,
      fullName: fullName(me), email: me.email, phone: String(profile.phone ?? ""), status: me.status, role: me.role,
      faculty: me.department ? (ref(me.department.faculty) as StaffProfile["faculty"]) : null,
      department: me.department ? (ref(me.department) as StaffProfile["department"]) : null,
    };
  },

  getStudentOverview: async (): Promise<StudentOverview> => {
    const item = await get<Raw>("student/dashboard/");
    const registration = item.registration as Raw;
    return {
      name: String(item.name), firstName: String(item.first_name), matricNumber: String(item.matric_no), email: String(item.email),
      status: item.status as UserStatus, faculty: ref(item.faculty) as StudentOverview["faculty"],
      department: ref(item.department) as StudentOverview["department"], program: { ...ref(item.program), award: String((item.program as Raw).award) },
      level: Number(item.level) as Level, entrySession: (item.entry_session as string | null) ?? null, cgpa: num(item.cgpa),
      semester: mapOverviewSemester(item.semester as Raw | null),
      registration: {
        status: registration.status as StudentOverview["registration"]["status"], returnReason: String(registration.return_reason ?? ""),
        registrationOpen: Boolean(registration.registration_open),
      },
      carryOvers: mapCarryOvers(item.carry_overs),
    };
  },
  getMySessions: async (): Promise<MySession[]> =>
    (await get<Raw[]>("student/sessions/")).map((item) => ({
      id: Number(item.id), name: String(item.name), level: Number(item.level) as Level, label: String(item.label), isCurrent: Boolean(item.is_current),
    })),
  getMyCourses: async (sessionId?: number): Promise<MyCourses> => {
    const item = await get<Raw>(`student/courses/${query({ session: sessionId })}`);
    const session = item.session as Raw;
    return {
      session: { id: Number(session.id), name: String(session.name), isCurrent: Boolean(session.is_current) },
      level: Number(item.level) as Level, label: String(item.label), cgpa: num(item.cgpa),
      semesters: ((item.semesters as Raw[]) ?? []).map(mapSemesterCourses),
    };
  },
  getStatement: async (): Promise<ResultStatement> => {
    const item = await get<Raw>("student/results/statement/");
    return {
      ...mapStudentResults(item),
      bands: ((item.bands as Raw[]) ?? []).map(mapGradeBand),
      generatedAt: String(item.generated_at),
    };
  },
  getRegistration: async () => mapStudentRegistration(await get<Raw>("student/registration/")),
  submitRegistration: async (offeringIds: number[]) =>
    mapStudentRegistration(await put<Raw>("student/registration/", { offering_ids: offeringIds })),
  getRegistrationSlip: async (semesterId?: number): Promise<RegistrationForm | null> => {
    try {
      return mapForm(await get<Raw>(`student/registration/slip/${query({ semester: semesterId })}`));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  getLecturerOverview: async (): Promise<LecturerOverview> => {
    const item = await get<Raw>("lecturer/dashboard/");
    return {
      semester: mapOverviewSemester(item.semester as Raw | null), needsAction: Number(item.needs_action),
      offerings: ((item.offerings as Raw[]) ?? []).map((offering) => ({
        id: Number(offering.id), course: mapCourseRef(offering.course as Raw), sheetStatus: offering.sheet_status as SheetStatus,
        feedback: (offering.feedback as string) || null, studentCount: Number(offering.student_count), scoredCount: Number(offering.scored_count),
      })),
    };
  },
  getLecturerSemesters: async () => (await get<Raw[]>("lecturer/semesters/")).map(mapSemester),
  getMyOfferings: async (semesterId?: number) =>
    (await get<Raw[]>(`lecturer/offerings/${query({ semester: semesterId })}`)).map(mapLecturerCourse),
  getLecturerSheet: async (offeringId: number) => mapSheet(await get<Raw>(`lecturer/offerings/${offeringId}/sheet/`)),
  saveScores: async (offeringId: number, scores: ScoreInput[]) =>
    mapSheet(await patch<Raw>(`lecturer/offerings/${offeringId}/sheet/entries/`, { entries: scores.map(toScoreInput) })),
  submitSheet: async (offeringId: number, confirmIncomplete: boolean) =>
    mapSheet(await post<Raw>(`lecturer/offerings/${offeringId}/sheet/submit/`, { confirm_incomplete: confirmIncomplete })),
  downloadScoreTemplate: (offeringId: number, format: "xlsx" | "csv") =>
    requestFile(`lecturer/offerings/${offeringId}/sheet/template/?format=${format}`),
  importScores: async (offeringId: number, file: File, dryRun: boolean) => {
    const form = new FormData();
    form.append("file", file);
    form.append("dry_run", String(dryRun));
    try {
      return mapImportReport(await request<Raw>(`lecturer/offerings/${offeringId}/sheet/import/`, { method: "POST", form }));
    } catch (error) {
      // rows with errors still come back as a report, so the caller can show which ones failed
      if (error instanceof ApiError && (error.data as Raw | null)?.rows) return mapImportReport(error.data as Raw);
      throw error;
    }
  },

  getDepartmentOverview: async (): Promise<DepartmentOverview> => {
    const item = await get<Raw>("department/dashboard/");
    const counts = item.counts as Raw;
    const department = item.department as Raw;
    return {
      department: { ...ref(department), faculty: String(department.faculty) },
      semester: mapOverviewSemester(item.semester as Raw | null),
      counts: {
        students: Number(counts.students), lecturers: Number(counts.lecturers), courses: Number(counts.courses),
        currentOfferings: Number(counts.current_offerings), unallocatedOfferings: Number(counts.unallocated_offerings),
      },
      awaitingValidation: Number(item.awaiting_validation), awaitingReview: Number(item.awaiting_review),
      recentActivity: ((item.recent_activity as Raw[]) ?? []).map(mapAuditRow),
    };
  },
  getDepartmentActivity: async (page: number): Promise<Page<AuditRow>> => {
    const data = await get<{ count: number; results: Raw[] }>(`department/activity/${query({ page, page_size: 15 })}`);
    return { count: data.count, results: data.results.map(mapAuditRow) };
  },
  getStudents: async (filter: { departmentId?: number; level?: number } = {}) =>
    (await getList<Raw>(`students/${query({ department: filter.departmentId, level: filter.level })}`)).map(mapStudent),
  getStudentLevels: async (departmentId?: number) =>
    (await get<Raw[]>(`students/levels/${query({ department: departmentId })}`)).map(mapLevel),
  getStudentRecord: async (id: number): Promise<StudentRecord> => {
    const item = await get<Raw>(`students/${id}/record/`);
    return {
      student: mapStudent(item.student as Raw), cgpa: num(item.cgpa), carryOvers: mapCarryOvers(item.carry_overs),
      semesters: ((item.semesters as Raw[]) ?? []).map(mapRecord),
    };
  },
  createStudent: async (input: StudentInput) => mapStudent(await post<Raw>("students/", toStudentInput(input))),
  updateStudent: async (id: number, input: StudentInput) => mapStudent(await patch<Raw>(`students/${id}/`, toStudentInput(input))),
  getLecturers: async (departmentId?: number) =>
    (await getList<Raw>(`staff/${query({ role: "LECTURER", department: departmentId })}`)).map(mapLecturer),
  createLecturer: async (input: LecturerInput, departmentId?: number) =>
    mapLecturer(await post<Raw>("staff/", { ...toStaffInput(input), role: "LECTURER", ...(departmentId ? { department: departmentId } : {}) })),
  updateLecturer: async (id: number, input: LecturerInput) => mapLecturer(await patch<Raw>(`staff/${id}/`, toStaffInput(input))),
  getCourses: async (departmentId?: number) => (await getList<Raw>(`courses/${query({ department: departmentId })}`)).map(mapCourse),
  createCourse: async (input: CourseInput) => mapCourse(await post<Raw>("courses/", toCourseInput(input))),
  updateCourse: async (id: number, input: CourseInput) => mapCourse(await patch<Raw>(`courses/${id}/`, toCourseInput(input))),
  deleteCourse: (id: number) => request<void>(`courses/${id}/`, { method: "DELETE" }),
  getPrograms: async (departmentId?: number) => (await getList<Raw>(`programs/${query({ department: departmentId })}`)).map(mapProgram),
  createProgram: async (input: ProgramInput) => mapProgram(await post<Raw>("programs/", toProgramInput(input))),
  updateProgram: async (id: number, input: ProgramInput) => mapProgram(await patch<Raw>(`programs/${id}/`, toProgramInput(input))),
  deleteProgram: (id: number) => request<void>(`programs/${id}/`, { method: "DELETE" }),
  getAllocations: async () => (await getList<Raw>("offerings/?semester=current")).map(mapOffering),
  getUnallocated: async () => (await getList<Raw>("offerings/?semester=current&unallocated=true")).map(mapOffering),
  assignLecturer: async (offeringId: number, lecturerId: number) =>
    mapOffering(await patch<Raw>(`offerings/${offeringId}/`, { lecturer: lecturerId })),
  getRegistrationForms: async (semesterId: number) =>
    (await getList<Raw>(`registration-forms/?semester=${semesterId}`)).map(mapFormSummary),
  getRegistrationForm: async (id: number) => mapForm(await get<Raw>(`registration-forms/${id}/`)),
  validateRegistrationForm: async (id: number) => mapForm(await post<Raw>(`registration-forms/${id}/validate/`)),
  returnRegistrationForm: async (id: number, reason: string) =>
    mapForm(await post<Raw>(`registration-forms/${id}/return/`, { reason })),
  getOfferings: async (semesterId: number) => (await getList<Raw>(`offerings/?semester=${semesterId}`)).map(mapOffering),
  getOfferingRegistrations: async (offeringId: number) =>
    (await getList<Raw>(`registrations/?offering=${offeringId}`)).map(mapOfferingRegistration),
  getResultSheets: async () => (await getList<Raw>("result-sheets/")).map(mapSheetSummary),
  getResultSheet: async (id: number) => mapSheet(await get<Raw>(`result-sheets/${id}/`)),
  approveSheet: async (id: number) => mapSheet(await post<Raw>(`result-sheets/${id}/approve/`)),
  rejectSheet: async (id: number, feedback: string) => mapSheet(await post<Raw>(`result-sheets/${id}/reject/`, { feedback })),
  reopenSheet: async (id: number, reason: string) => mapSheet(await post<Raw>(`result-sheets/${id}/reopen/`, { reason })),

  getReport: async (kind: ReportKind, params: ReportQuery = {}) => mapReport(await get<Raw>(`reports/${kind}/${query(params)}`)),
  downloadReport: (kind: ReportKind, params: ReportQuery = {}) => requestFile(`reports/${kind}/${query({ ...params, format: "csv" })}`),

  getAdminOverview: async (): Promise<AdminOverview> => {
    const item = await get<Raw>("admin/dashboard/");
    const totals = item.totals as Raw;
    return {
      semester: mapOverviewSemester(item.semester as Raw | null),
      totals: {
        students: Number(totals.students), lecturers: Number(totals.lecturers), faculties: Number(totals.faculties),
        departments: Number(totals.departments), courses: Number(totals.courses), staff: Number(totals.staff),
        awaitingValidation: Number(totals.awaiting_validation), awaitingReview: Number(totals.awaiting_review),
      },
      departments: ((item.departments as Raw[]) ?? []).map((row) => ({
        ...ref(row), faculty: String(row.faculty), students: Number(row.students),
        awaitingValidation: Number(row.awaiting_validation), awaitingReview: Number(row.awaiting_review),
      })),
      recentActivity: ((item.recent_activity as Raw[]) ?? []).map(mapAuditRow),
    };
  },
  getFaculties: async () => (await getList<Raw>("faculties/")).map(mapFaculty),
  createFaculty: async (input: FacultyInput) => mapFaculty(await post<Raw>("faculties/", input)),
  updateFaculty: async (id: number, input: FacultyInput) => mapFaculty(await patch<Raw>(`faculties/${id}/`, input)),
  deleteFaculty: (id: number) => request<void>(`faculties/${id}/`, { method: "DELETE" }),
  getDepartments: async (facultyId?: number) => (await getList<Raw>(`departments/${query({ faculty: facultyId })}`)).map(mapDepartment),
  createDepartment: async (input: DepartmentInput) => mapDepartment(await post<Raw>("departments/", toDepartmentInput(input))),
  updateDepartment: async (id: number, input: DepartmentInput) => mapDepartment(await patch<Raw>(`departments/${id}/`, toDepartmentInput(input))),
  deleteDepartment: (id: number) => request<void>(`departments/${id}/`, { method: "DELETE" }),
  getDepartmentAdmins: async (id: number): Promise<DepartmentAdmin[]> =>
    (await get<Raw[]>(`departments/${id}/admins/`)).map((item) => ({
      id: Number(item.id), name: String(item.name), email: String(item.email), status: item.status as UserStatus,
      staffId: (item.staff_id as string | null) ?? null,
    })),
  getSemesters: async () => (await getList<Raw>("semesters/")).map(mapSemester),
  getSessions: async () => (await getList<Raw>("sessions/")).map(mapSession),
  createSession: async (input: SessionInput) => mapSession(await post<Raw>("sessions/", toSessionInput(input))),
  setCurrentSemester: async (semesterId: number) => mapSemester(await post<Raw>(`semesters/${semesterId}/set-current/`)),
  setRegistrationOpen: async (semesterId: number, open: boolean) =>
    mapSemester(await patch<Raw>(`semesters/${semesterId}/`, { registration_open: open })),
  getUsers: async () => (await getList<Raw>("users/")).map(mapUser),
  getUser: async (id: number) => mapUserDetail(await get<Raw>(`users/${id}/`)),
  updateUserStatus: async (id: number, status: UserStatus) => mapUser(await post<Raw>(`users/${id}/${status.toLowerCase()}/`)) as UserAccount,
  updateUserRole: async (id: number, input: UserRoleInput) => mapUser(await patch<Raw>(`users/${id}/`, { role: input.role, department: input.departmentId })) as UserAccount,

  getAuditLog: async (params: AuditQuery): Promise<Page<AuditRow>> => {
    const data = await get<{ count: number; results: Raw[] }>(
      `audit-log/${query({
        page: params.page, page_size: 20, actor: params.actor, action: params.action, entity_type: params.entityType,
        department: params.department, date_from: params.dateFrom, date_to: params.dateTo, search: params.search,
      })}`,
    );
    return { count: data.count, results: data.results.map(mapAuditRow) };
  },
  getAuditEntry: async (id: number): Promise<AuditDetail> => {
    const item = await get<Raw>(`audit-log/${id}/`);
    return { ...mapAuditRow(item), before: (item.before as AuditDetail["before"]) ?? null, after: (item.after as AuditDetail["after"]) ?? null };
  },
  getAuditFilters: async (): Promise<AuditFilters> => {
    const item = await get<Raw>("audit-log/filters/");
    return {
      actions: item.actions as string[], entityTypes: item.entity_types as string[],
      actors: ((item.actors as Raw[]) ?? []).map((actor) => ({ id: Number(actor.id), name: String(actor.name) })),
    };
  },
  getGradeScale: async () => mapGradeScale(await get<Raw>("grade-scale/")),
  updateGradeScale: async (bands: GradeBand[]) => mapGradeScale(await put<Raw>("grade-scale/", { bands, confirm: true })),
  resetGradeScale: async () => mapGradeScale(await post<Raw>("grade-scale/reset/")),
};

export type Api = typeof remoteApi;
