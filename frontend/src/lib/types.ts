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
  userId: number;
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
  currentOfferings: { id: number; code: string; title: string; units: number }[];
  totalUnits: number;
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
  recentActivity: AuditRow[];
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
  feedback: string | null;
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

export type RegistrationState = RegistrationStatus | "NOT_SUBMITTED";

export interface StudentOverview {
  name: string;
  firstName: string;
  matricNumber: string;
  email: string;
  status: UserStatus;
  faculty: CodedRef;
  department: CodedRef;
  program: Ref & { award: string };
  level: Level;
  entrySession: string | null;
  cgpa: number | null;
  semester: Semester | null;
  registration: { status: RegistrationState; returnReason: string; registrationOpen: boolean };
  carryOvers: { code: string; title: string; units: number }[];
}

export interface MySession {
  id: number;
  name: string;
  level: Level;
  label: string;
  isCurrent: boolean;
}

export interface MyCourse {
  offeringId: number;
  code: string;
  title: string;
  units: number;
  lecturer: string | null;
  isCarryOver: boolean;
  ca: number | null;
  exam: number | null;
  total: number | null;
  grade: Grade | null;
  gradePoint: number | null;
}

export interface SemesterCourses {
  semester: Semester;
  isCurrent: boolean;
  registrationOpen: boolean;
  registration: {
    status: RegistrationState;
    returnReason: string;
    submittedAt: string | null;
    validatedAt: string | null;
  };
  courses: MyCourse[];
  totalUnits: number;
  gpa: number | null;
}

export interface MyCourses {
  session: { id: number; name: string; isCurrent: boolean };
  level: Level;
  label: string;
  cgpa: number | null;
  semesters: SemesterCourses[];
}

export interface ResultStatement extends StudentResults {
  bands: GradeBand[];
  generatedAt: string;
}

export interface LecturerOverview {
  semester: Semester | null;
  offerings: {
    id: number;
    course: CourseSummary;
    sheetStatus: SheetStatus;
    feedback: string | null;
    studentCount: number;
    scoredCount: number;
  }[];
  needsAction: number;
}

export interface AuditRow {
  id: number;
  at: string;
  actor: { id: number; name: string; email: string; role: Role } | null;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  target: string;
  details: string;
  department: CodedRef | null;
  ipAddress: string | null;
}

export interface AuditDetail extends AuditRow {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface AuditFilters {
  actions: string[];
  entityTypes: string[];
  actors: Ref[];
}

export interface AuditQuery {
  page: number;
  actor?: string;
  action?: string;
  entityType?: string;
  department?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface Page<T> {
  count: number;
  results: T[];
}

export interface DepartmentOverview {
  department: CodedRef & { faculty: string };
  semester: Semester | null;
  counts: { students: number; lecturers: number; courses: number; currentOfferings: number; unallocatedOfferings: number };
  awaitingValidation: number;
  awaitingReview: number;
  recentActivity: AuditRow[];
}

export interface AdminOverview {
  semester: Semester | null;
  totals: {
    students: number;
    lecturers: number;
    faculties: number;
    departments: number;
    courses: number;
    staff: number;
    awaitingValidation: number;
    awaitingReview: number;
  };
  departments: (CodedRef & { faculty: string; students: number; awaitingValidation: number; awaitingReview: number })[];
  recentActivity: AuditRow[];
}

export interface LevelSummary {
  level: Level;
  studentCount: number;
  entrySessions: { id: number; name: string; studentCount: number }[];
}

export type SemesterRecord = Omit<SemesterCourses, "isCurrent" | "registrationOpen">;

export interface StudentRecord {
  student: Student;
  cgpa: number | null;
  carryOvers: { code: string; title: string; units: number }[];
  semesters: SemesterRecord[];
}

export interface DepartmentAdmin {
  id: number;
  name: string;
  email: string;
  status: UserStatus;
  staffId: string | null;
}

export type ReportKind = "students" | "registrations" | "performance" | "at-risk" | "departments";

export interface ReportTable {
  title: string;
  columns: { key: string; label: string }[];
  rows: Record<string, string | number | null>[];
}

export interface Report {
  title: string;
  department: CodedRef | null;
  semester: Semester | null;
  tables: ReportTable[];
}

export interface ReportQuery {
  department?: number;
  semester?: number;
  level?: number;
  program?: number;
}

export type GradeDistribution = Record<Grade, number>;

export interface GradeBand {
  grade: Grade;
  min: number;
  max: number;
  point: number;
}

export interface GradeScale {
  bands: GradeBand[];
  isDefault: boolean;
}

export type ImportRowStatus = "change" | "unchanged" | "error";

export interface ImportRow {
  rowNumber: number;
  matricNumber: string;
  name: string | null;
  status: ImportRowStatus;
  caBefore: number | null;
  caAfter: number | null;
  examBefore: number | null;
  examAfter: number | null;
  error: string | null;
}

export interface ImportReport {
  summary: { rows: number; willChange: number; unchanged: number; errors: number };
  rows: ImportRow[];
}
