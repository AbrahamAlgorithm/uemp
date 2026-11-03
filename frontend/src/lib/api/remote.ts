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
  getCurrentSemester: () => get<Semester>("semesters/current/"),

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
  getStudents: () => get<Student[]>("students/"),
  createStudent: (input: StudentInput) => post<Student>("students/", input),
  updateStudent: (id: number, input: StudentInput) => patch<Student>(`students/${id}/`, input),
  getLecturers: () => get<Lecturer[]>("lecturers/"),
  createLecturer: (input: LecturerInput) => post<Lecturer>("lecturers/", input),
  updateLecturer: (id: number, input: LecturerInput) => patch<Lecturer>(`lecturers/${id}/`, input),
  getCourses: () => get<Course[]>("courses/"),
  createCourse: (input: CourseInput) => post<Course>("courses/", input),
  updateCourse: (id: number, input: CourseInput) => patch<Course>(`courses/${id}/`, input),
  getPrograms: () => get<Program[]>("programs/"),
  createProgram: (input: ProgramInput) => post<Program>("programs/", input),
  updateProgram: (id: number, input: ProgramInput) => patch<Program>(`programs/${id}/`, input),
  getAllocations: () => get<CourseAllocation[]>("allocations/"),
  assignLecturer: (courseId: number, lecturerId: number) =>
    post<CourseAllocation>("allocations/", { courseId, lecturerId }),
  getRegistrations: () => get<Registration[]>("registrations/"),
  getResultSheets: () => get<ResultSheetSummary[]>("result-sheets/"),
  getResultSheet: (id: number) => get<ResultSheet>(`result-sheets/${id}/`),
  approveSheet: (id: number) => post<ResultSheet>(`result-sheets/${id}/approve/`),
  rejectSheet: (id: number, feedback: string) => post<ResultSheet>(`result-sheets/${id}/reject/`, { feedback }),
  reopenSheet: (id: number, reason: string) => post<ResultSheet>(`result-sheets/${id}/reopen/`, { reason }),
  getDepartmentReport: () => get<DepartmentReport>("reports/department/"),

  getAdminDashboard: () => get<AdminDashboard>("admin/dashboard/"),
  getFaculties: () => get<Faculty[]>("faculties/"),
  createFaculty: (input: FacultyInput) => post<Faculty>("faculties/", input),
  updateFaculty: (id: number, input: FacultyInput) => patch<Faculty>(`faculties/${id}/`, input),
  getDepartments: () => get<Department[]>("departments/"),
  createDepartment: (input: DepartmentInput) => post<Department>("departments/", input),
  updateDepartment: (id: number, input: DepartmentInput) => patch<Department>(`departments/${id}/`, input),
  getSessions: () => get<AcademicSession[]>("sessions/"),
  createSession: (input: SessionInput) => post<AcademicSession>("sessions/", input),
  setCurrentSemester: (semesterId: number) => post<Semester>(`semesters/${semesterId}/set-current/`),
  getUsers: () => get<UserAccount[]>("users/"),
  getUser: (id: number) => get<UserDetail>(`users/${id}/`),
  updateUserStatus: (id: number, status: UserStatus) => patch<UserAccount>(`users/${id}/`, { status }),
  updateUserRole: (id: number, input: UserRoleInput) => patch<UserAccount>(`users/${id}/`, input),
  getUniversityReport: () => get<UniversityReport>("reports/university/"),
  getAuditLog: () => get<AuditEntry[]>("audit-log/"),
  getGradeScale: () => get<GradeBand[]>("grade-scale/"),
  updateGradeScale: (bands: GradeBand[]) => put<GradeBand[]>("grade-scale/", { bands }),
};

export type Api = typeof remoteApi;
