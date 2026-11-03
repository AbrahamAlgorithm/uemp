import type { Gender, Role, SemesterName, SheetStatus, UserStatus } from "../types";

export interface FacultyRow {
  id: number;
  code: string;
  name: string;
}

export interface DepartmentRow {
  id: number;
  code: string;
  name: string;
  facultyId: number;
}

export interface ProgramRow {
  id: number;
  name: string;
  award: string;
  durationYears: number;
  departmentId: number;
}

export interface SessionRow {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
}

export interface SemesterRow {
  id: number;
  sessionId: number;
  name: SemesterName;
  isCurrent: boolean;
}

export interface UserRow {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserStatus;
  departmentId: number | null;
  phone: string;
  dateJoined: string;
  lastLogin: string | null;
}

export interface StudentRow {
  userId: number;
  matricNumber: string;
  programId: number;
  level: number;
  gender: Gender;
  dateOfBirth: string;
  address: string;
  entrySessionId: number;
  ability: number;
}

export interface StaffRow {
  userId: number;
  staffId: string;
  title: string;
}

export interface CourseRow {
  id: number;
  code: string;
  title: string;
  units: number;
  level: number;
  semester: SemesterName;
  departmentId: number;
  programIds: number[];
}

export const DEMO_PASSWORD = "password123";
export const DEMO_ACTIVATION_CODE = "246810";
export const CURRENT_SESSION_ID = 4;

export const FACULTIES: FacultyRow[] = [
  { id: 1, code: "SCI", name: "Faculty of Science" },
  { id: 2, code: "ENG", name: "Faculty of Engineering" },
];

export const DEPARTMENTS: DepartmentRow[] = [
  { id: 1, code: "CSC", name: "Computer Science", facultyId: 1 },
  { id: 2, code: "MTH", name: "Mathematics", facultyId: 1 },
  { id: 3, code: "EEE", name: "Electrical and Electronics Engineering", facultyId: 2 },
];

export const PROGRAMS: ProgramRow[] = [
  { id: 1, name: "Computer Science", award: "B.Sc.", durationYears: 4, departmentId: 1 },
  { id: 2, name: "Information Technology", award: "B.Sc.", durationYears: 4, departmentId: 1 },
  { id: 3, name: "Mathematics", award: "B.Sc.", durationYears: 4, departmentId: 2 },
  { id: 4, name: "Electrical and Electronics Engineering", award: "B.Eng.", durationYears: 5, departmentId: 3 },
];

export const SESSIONS: SessionRow[] = [
  { id: 1, name: "2023/2024", startDate: "2023-10-02", endDate: "2024-08-30" },
  { id: 2, name: "2024/2025", startDate: "2024-10-07", endDate: "2025-08-29" },
  { id: 3, name: "2025/2026", startDate: "2025-10-06", endDate: "2026-08-28" },
  { id: 4, name: "2026/2027", startDate: "2026-10-05", endDate: "2027-08-27" },
];

export const SEMESTERS: SemesterRow[] = SESSIONS.flatMap((session) => [
  { id: session.id * 2 - 1, sessionId: session.id, name: "FIRST", isCurrent: session.id === CURRENT_SESSION_ID },
  { id: session.id * 2, sessionId: session.id, name: "SECOND", isCurrent: false },
]);

const DEPARTMENT_BY_PREFIX: Record<string, number> = { CSC: 1, MTH: 2, STA: 2, EEE: 3 };

const COURSE_LIST: [code: string, title: string, units: number, programIds: number[]][] = [
  ["CSC 101", "Introduction to Computer Science", 3, [1, 2]],
  ["CSC 103", "Introduction to Problem Solving", 2, [1, 2]],
  ["CSC 105", "Computer Applications", 2, [2]],
  ["MTH 101", "Elementary Mathematics I", 3, [1, 2, 3, 4]],
  ["MTH 103", "Set Theory and Logic", 2, [3]],
  ["STA 101", "Introduction to Statistics", 3, [3]],
  ["EEE 101", "Introduction to Electrical Engineering", 3, [4]],
  ["EEE 103", "Engineering Drawing", 2, [4]],
  ["CSC 102", "Introduction to Programming", 3, [1, 2]],
  ["CSC 104", "Introduction to Web Technologies", 2, [1, 2]],
  ["MTH 102", "Elementary Mathematics II", 3, [1, 2, 3, 4]],
  ["MTH 104", "Vectors and Geometry", 3, [3]],
  ["STA 102", "Probability I", 3, [3]],
  ["EEE 102", "Basic Electrical Circuits", 3, [4]],
  ["EEE 104", "Workshop Practice", 2, [4]],
  ["CSC 201", "Computer Programming I", 3, [1, 2]],
  ["CSC 203", "Discrete Structures", 3, [1, 2]],
  ["CSC 205", "Digital Logic Design", 3, [1]],
  ["CSC 207", "Introduction to Information Systems", 2, [2]],
  ["MTH 201", "Mathematical Methods I", 3, [1, 3, 4]],
  ["MTH 203", "Abstract Algebra I", 3, [3]],
  ["MTH 205", "Real Analysis I", 3, [3]],
  ["EEE 201", "Circuit Theory I", 3, [4]],
  ["EEE 203", "Electronics I", 3, [4]],
  ["EEE 205", "Electrical Measurements", 2, [4]],
  ["CSC 202", "Computer Programming II", 3, [1, 2]],
  ["CSC 204", "Fundamentals of Data Structures", 3, [1, 2]],
  ["CSC 206", "Computer Organisation", 3, [1]],
  ["CSC 208", "Introduction to Databases", 2, [2]],
  ["MTH 202", "Linear Algebra I", 3, [1, 3]],
  ["MTH 204", "Ordinary Differential Equations", 3, [3]],
  ["MTH 206", "Real Analysis II", 3, [3]],
  ["EEE 202", "Circuit Theory II", 3, [4]],
  ["EEE 204", "Electronics II", 3, [4]],
  ["EEE 206", "Signals and Systems", 3, [4]],
  ["CSC 301", "Data Structures and Algorithms", 3, [1, 2]],
  ["CSC 303", "Operating Systems", 3, [1, 2]],
  ["CSC 305", "Database Management Systems", 3, [1, 2]],
  ["CSC 307", "Computer Architecture", 3, [1]],
  ["CSC 309", "Software Engineering", 3, [1, 2]],
  ["CSC 311", "Object-Oriented Programming", 3, [1, 2]],
  ["CSC 313", "Theory of Computation", 2, [1]],
  ["CSC 315", "Computer Networks", 3, [1, 2]],
  ["CSC 317", "Systems Analysis and Design", 3, [2]],
  ["MTH 301", "Numerical Analysis", 3, [1, 3]],
  ["CSC 302", "Compiler Construction", 3, [1]],
  ["CSC 304", "Human-Computer Interaction", 2, [1, 2]],
  ["CSC 306", "Artificial Intelligence", 3, [1, 2]],
  ["CSC 308", "Web Application Development", 3, [1, 2]],
  ["CSC 310", "Research Methods", 2, [1, 2]],
  ["CSC 401", "Machine Learning", 3, [1, 2]],
  ["CSC 403", "Computer Security", 3, [1, 2]],
  ["CSC 405", "Distributed Systems", 3, [1]],
  ["CSC 407", "Project Management", 2, [1, 2]],
  ["CSC 409", "Cloud Computing", 3, [1, 2]],
  ["CSC 402", "Final Year Project", 6, [1, 2]],
  ["CSC 404", "Mobile Computing", 3, [1, 2]],
  ["CSC 406", "Professional Ethics in Computing", 2, [1, 2]],
  ["CSC 408", "Data Mining", 3, [1, 2]],
];

// nigerian course codes encode the level in the first digit and the semester in the last (odd = first)
export const COURSES: CourseRow[] = COURSE_LIST.map(([code, title, units, programIds], index) => {
  const number = Number(code.slice(4));
  return {
    id: index + 1,
    code,
    title,
    units,
    level: Math.floor(number / 100) * 100,
    semester: number % 2 === 1 ? "FIRST" : "SECOND",
    departmentId: DEPARTMENT_BY_PREFIX[code.slice(0, 3)]!,
    programIds,
  };
});

const staff = (
  id: number,
  title: string,
  firstName: string,
  lastName: string,
  role: Role,
  departmentId: number | null,
  status: UserStatus = "ACTIVE",
) => ({ id, title, firstName, lastName, role, departmentId, status });

export const STAFF = [
  staff(1, "Mr.", "Tunde", "Bakare", "SUPER_ADMIN", null),
  staff(2, "Mrs.", "Bisi", "Adewale", "DEPT_ADMIN", 1),
  staff(3, "Mr.", "Kunle", "Ojo", "DEPT_ADMIN", 2),
  staff(4, "Mrs.", "Grace", "Effiong", "DEPT_ADMIN", 3),
  staff(10, "Dr.", "Adebayo", "Ogunleye", "LECTURER", 1),
  staff(11, "Prof.", "Ngozi", "Eze", "LECTURER", 1),
  staff(12, "Dr.", "Ibrahim", "Musa", "LECTURER", 1),
  staff(13, "Mrs.", "Funmilayo", "Adeyemi", "LECTURER", 1),
  staff(14, "Mr.", "Emeka", "Nwosu", "LECTURER", 1),
  staff(15, "Dr.", "Aisha", "Bello", "LECTURER", 2),
  staff(16, "Prof.", "Olumide", "Akinola", "LECTURER", 2),
  staff(17, "Engr.", "Chukwudi", "Obi", "LECTURER", 3),
  staff(18, "Dr.", "Halima", "Yusuf", "LECTURER", 3),
  staff(19, "Dr.", "Femi", "Oladipo", "LECTURER", 1, "INACTIVE"),
];

const student = (
  id: number,
  firstName: string,
  lastName: string,
  gender: Gender,
  programId: number,
  entrySessionId: number,
  status: UserStatus = "ACTIVE",
) => ({ id, firstName, lastName, gender, programId, entrySessionId, status });

export const STUDENTS = [
  student(100, "Tobiloba", "Adeyemi", "M", 1, 4),
  student(101, "Zainab", "Abdullahi", "F", 1, 4),
  student(102, "Chukwuemeka", "Nnamdi", "M", 2, 4),
  student(103, "Obinna", "Agu", "M", 1, 4, "INACTIVE"),
  student(104, "Oluwaseun", "Bamidele", "M", 1, 3),
  student(105, "Amarachi", "Uche", "F", 1, 3),
  student(106, "Yusuf", "Danjuma", "M", 2, 3),
  student(107, "Chiamaka", "Okafor", "F", 1, 2),
  student(108, "Ifeanyi", "Okonkwo", "M", 1, 2),
  student(109, "Temitope", "Alabi", "F", 1, 2),
  student(110, "Abubakar", "Sani", "M", 2, 2, "SUSPENDED"),
  student(111, "Damilola", "Oyelaran", "F", 2, 2),
  student(112, "Kehinde", "Ogunbiyi", "M", 1, 1),
  student(113, "Hauwa", "Ibrahim", "F", 1, 1),
  student(114, "Babatunde", "Olawale", "M", 3, 3),
  student(115, "Ngozi", "Chukwu", "F", 3, 3),
  student(116, "Musa", "Garba", "M", 3, 4),
  student(117, "Folasade", "Ajayi", "F", 3, 4),
  student(118, "Emeka", "Eze", "M", 4, 3),
  student(119, "Rukayat", "Lawal", "F", 4, 3),
  student(120, "Segun", "Afolabi", "M", 4, 4),
  student(121, "Blessing", "Etim", "F", 4, 4),
];

export const DEMO_USER_IDS = { STUDENT: 107, LECTURER: 10, DEPT_ADMIN: 2, SUPER_ADMIN: 1 } as const;

export const ADDRESSES = [
  "14 Adebayo Street, Bodija, Ibadan",
  "7 Ring Road, Challenge, Ibadan",
  "22 Awolowo Avenue, Old Bodija, Ibadan",
  "3 Oluyole Estate Road, Ibadan",
  "45 Agodi GRA, Ibadan",
  "11 Akobo Road, Ibadan",
  "9 Mokola Hill, Ibadan",
  "18 Iwo Road, Ibadan",
];

export const IP_ADDRESSES = ["102.89.34.118", "105.112.45.201", "197.210.53.77", "41.184.122.9", "102.88.71.14"];

export interface CurrentPlan {
  lecturerId: number | null;
  status?: SheetStatus;
  filled?: number;
}

export const CURRENT_PLAN: Record<string, CurrentPlan> = {
  "CSC 301": { lecturerId: 10, filled: 0.6 },
  "CSC 305": { lecturerId: 10, status: "REJECTED" },
  "CSC 101": { lecturerId: 10, status: "SUBMITTED" },
  "CSC 401": { lecturerId: 10, status: "APPROVED" },
  "CSC 303": { lecturerId: 11, status: "SUBMITTED" },
  "CSC 313": { lecturerId: 11, status: "SUBMITTED" },
  "CSC 403": { lecturerId: 11 },
  "CSC 307": { lecturerId: 12, status: "APPROVED" },
  "CSC 201": { lecturerId: 12, status: "SUBMITTED" },
  "CSC 405": { lecturerId: 12 },
  "CSC 309": { lecturerId: 13, filled: 0.3 },
  "CSC 203": { lecturerId: 13 },
  "CSC 207": { lecturerId: 13 },
  "CSC 407": { lecturerId: 13 },
  "CSC 103": { lecturerId: 14, status: "SUBMITTED" },
  "CSC 105": { lecturerId: 14 },
  "CSC 205": { lecturerId: 14 },
  "CSC 311": { lecturerId: 14 },
  "CSC 315": { lecturerId: null },
  "CSC 317": { lecturerId: null },
  "CSC 409": { lecturerId: null },
  "MTH 101": { lecturerId: 15, status: "SUBMITTED" },
  "MTH 103": { lecturerId: 15 },
  "MTH 205": { lecturerId: 15 },
  "MTH 301": { lecturerId: 15 },
  "MTH 201": { lecturerId: 16, status: "APPROVED" },
  "MTH 203": { lecturerId: 16, status: "SUBMITTED" },
  "STA 101": { lecturerId: 16 },
  "EEE 101": { lecturerId: 17, status: "SUBMITTED" },
  "EEE 203": { lecturerId: 17 },
  "EEE 103": { lecturerId: 18 },
  "EEE 201": { lecturerId: 18, status: "APPROVED" },
  "EEE 205": { lecturerId: null },
};
