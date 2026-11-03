export type Role = "STUDENT" | "LECTURER" | "DEPT_ADMIN" | "SUPER_ADMIN";
export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type SemesterName = "FIRST" | "SECOND";
export type Level = 100 | 200 | 300 | 400 | 500;
export type SheetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
export type RegistrationStatus = "SUBMITTED" | "VALIDATED" | "RETURNED";
export type Grade = "A" | "B" | "C" | "D" | "E" | "F";
export type Gender = "M" | "F";

export interface Ref {
  id: number;
  name: string;
}

export interface CodedRef extends Ref {
  code: string;
}

export interface SessionUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: Role;
  department: CodedRef | null;
}

export interface Faculty {
  id: number;
  code: string;
  name: string;
  departmentCount: number;
  studentCount: number;
}

export interface Department {
  id: number;
  code: string;
  name: string;
  faculty: CodedRef;
  programCount: number;
  studentCount: number;
  lecturerCount: number;
}

export interface Program {
  id: number;
  name: string;
  award: string;
  durationYears: number;
  department: CodedRef;
  levels: Level[];
  studentsByLevel: { level: Level; count: number }[];
  courseCount: number;
}

export interface Semester {
  id: number;
  name: SemesterName;
  isCurrent: boolean;
  registrationOpen: boolean;
  session: Ref;
}

export interface AcademicSession {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  semesters: Semester[];
}

export interface Student {
  id: number;
  matricNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  gender: Gender;
  dateOfBirth: string;
  status: UserStatus;
  level: Level;
  faculty: CodedRef;
  department: CodedRef;
  program: Ref & { award: string };
  entrySession: string;
}

export interface StaffProfile {
  id: number;
  staffId: string;
  title: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  status: UserStatus;
  role: Role;
  faculty: CodedRef | null;
  department: CodedRef | null;
}

export interface Lecturer extends StaffProfile {
  department: CodedRef;
  courseCount: number;
}

export interface UserAccount {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: Role;
  status: UserStatus;
  department: CodedRef | null;
  identifier: string | null;
  phone: string;
  dateJoined: string;
  lastLogin: string | null;
}

export interface UserDetail extends UserAccount {
  student: Student | null;
  staff: StaffProfile | null;
  recentActivity: AuditEntry[];
}

export interface CourseSummary {
  id: number;
  code: string;
  title: string;
  units: number;
  level: Level;
}

export interface Course extends CourseSummary {
  semester: SemesterName;
  department: CodedRef;
  programs: Ref[];
}

export interface CourseAllocation {
  allocationId: number | null;
  course: CourseSummary & { department: CodedRef };
  lecturer: (Ref & { staffId: string }) | null;
  sheetStatus: SheetStatus | null;
  studentCount: number;
}

export interface LecturerCourse {
  offeringId: number;
  sheetId: number;
  course: CourseSummary;
  semester: Semester;
  sheetStatus: SheetStatus;
  studentCount: number;
  scoredCount: number;
}

export interface RegistrationCourse {
  offeringId: number;
  code: string;
  title: string;
  units: number;
  level: Level;
  lecturer: string | null;
  isCarryOver: boolean;
}

export interface RegistrationOption extends RegistrationCourse {
  isSelected: boolean;
}

export interface RegistrationFormStatus {
  id: number;
  status: RegistrationStatus;
  submittedAt: string;
  returnReason: string;
  validatedBy: Ref | null;
  validatedAt: string | null;
}

export interface StudentRegistration {
  semester: Semester;
  registrationOpen: boolean;
  maxUnits: number;
  registration: RegistrationFormStatus | null;
  courses: RegistrationOption[];
}

export interface RegistrationStudent {
  id: number;
  fullName: string;
  email: string;
  matricNumber: string;
  level: Level;
  program: Ref & { award: string };
  department: CodedRef;
  faculty: CodedRef;
}

export interface RegistrationForm extends RegistrationFormStatus {
  student: RegistrationStudent;
  semester: Semester;
  totalUnits: number;
  courses: RegistrationCourse[];
}

export interface RegistrationFormSummary {
  id: number;
  status: RegistrationStatus;
  submittedAt: string;
  validatedAt: string | null;
  student: RegistrationStudent;
  semester: Semester;
  totalUnits: number;
  courseCount: number;
}

export interface OfferingRegistration {
  id: number;
  student: RegistrationStudent;
  offering: { id: number; code: string; title: string; units: number };
  formId: number;
  formStatus: RegistrationStatus;
  registeredAt: string;
}

export interface ResultEntry {
  registrationId: number;
  matricNumber: string;
  studentName: string;
  department: CodedRef;
  isCarryOver: boolean;
  ca: number | null;
  exam: number | null;
  total: number | null;
  grade: Grade | null;
  gradePoint: number | null;
}

export type SheetAction = "SUBMITTED" | "APPROVED" | "REJECTED" | "REOPENED";

export interface SheetEvent {
  at: string;
  action: SheetAction;
  actor: Ref | null;
  note: string | null;
}

export interface ResultSheetSummary {
  id: number;
  offeringId: number;
  course: CourseSummary;
  department: CodedRef;
  lecturer: Ref | null;
  semester: Semester;
  status: SheetStatus;
  editable: boolean;
  feedback: string | null;
  submittedBy: Ref | null;
  submittedAt: string | null;
  reviewedBy: Ref | null;
  reviewedAt: string | null;
  studentCount: number;
  scoredCount: number;
}

export interface ResultSubmission extends ResultSheetSummary {
  timeline: SheetEvent[];
}

export interface SheetStats {
  students: number;
  scored: number;
  incomplete: number;
  average: number | null;
  highest: number | null;
  lowest: number | null;
  passRate: number | null;
  distribution: GradeDistribution;
}

export interface ResultSheet extends ResultSubmission {
  entries: ResultEntry[];
  summary: SheetStats;
}

export interface ScoreInput {
  registrationId: number;
  ca?: number | null;
  exam?: number | null;
}

export interface CourseResult {
  registrationId: number;
  code: string;
  title: string;
  units: number;
  ca: number | null;
  exam: number | null;
  total: number;
  grade: Grade;
  gradePoint: number;
  isCarryOver: boolean;
}

export interface SemesterResult {
  semester: Semester;
  courses: CourseResult[];
  units: number;
  gpa: number;
}

export interface StudentResults {
  student: RegistrationStudent;
  semesters: SemesterResult[];
  cgpa: number | null;
  unitsAttempted: number;
  unitsPassed: number;
}

export interface StudentDashboard {
  student: Student;
  semester: Semester;
  cgpa: number | null;
  registeredUnits: number;
  registeredCourses: number;
  maxUnits: number;
}

export type AuditAction =
  | "LOGIN"
  | "CREATE"
  | "UPDATE"
  | "REGISTER_COURSES"
  | "SAVE_SCORES"
  | "SUBMIT_RESULTS"
  | "APPROVE_RESULTS"
  | "REJECT_RESULTS"
  | "REOPEN_RESULTS"
  | "ASSIGN_LECTURER"
  | "CHANGE_STATUS"
  | "CHANGE_ROLE"
  | "SET_CURRENT_SEMESTER"
  | "UPDATE_GRADE_SCALE";

export interface AuditEntry {
  id: number;
  at: string;
  actor: Ref & { role: Role };
  action: AuditAction;
  target: string;
  details: string;
  ipAddress: string;
  department: CodedRef | null;
}

export interface DepartmentDashboard {
  department: CodedRef & { faculty: string };
  semester: Semester;
  counts: { students: number; lecturers: number; courses: number; pendingApprovals: number };
  pending: ResultSheetSummary[];
  unallocatedCourses: number;
  recentActivity: AuditEntry[];
}

export interface AdminDashboard {
  semester: Semester;
  counts: {
    students: number;
    lecturers: number;
    faculties: number;
    departments: number;
    courses: number;
    registrations: number;
  };
  pendingByDepartment: {
    department: CodedRef;
    faculty: string;
    pending: number;
    oldestSubmittedAt: string | null;
  }[];
  recentActivity: AuditEntry[];
}

export type GradeDistribution = Record<Grade, number>;

export interface CoursePerformance {
  course: CourseSummary;
  status: SheetStatus;
  students: number;
  average: number | null;
  passRate: number | null;
  distribution: GradeDistribution;
}

export interface DepartmentReport {
  department: CodedRef;
  semester: Semester;
  students: Student[];
  registrations: { course: CourseSummary; registered: number }[];
  performance: CoursePerformance[];
}

export interface DepartmentStats {
  department: CodedRef;
  faculty: string;
  students: number;
  lecturers: number;
  courses: number;
  registrations: number;
  averageCgpa: number | null;
  passRate: number | null;
}

export interface UniversityReport {
  semester: Semester;
  departments: DepartmentStats[];
  studentsByLevel: { level: Level; count: number }[];
  resultStatus: Record<SheetStatus, number>;
}

export interface GradeBand {
  grade: Grade;
  min: number;
  max: number;
  point: number;
}
