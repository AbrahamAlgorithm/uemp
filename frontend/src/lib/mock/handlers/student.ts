import { MAX_UNITS_PER_SEMESTER } from "../../constants";
import { semesterLabel } from "../../format";
import type { StudentContactInput } from "../../schemas";
import type { MyCourses, RegistrationOptions, StudentDashboard } from "../../types";
import { availableCourses, db, nextId, type RegistrationRow } from "../db";
import { fail, logAudit, now, requireRole, sleep } from "../session";
import {
  courseSummary,
  currentSemesterRow,
  displayName,
  findCourse,
  findStudent,
  findUser,
  semesterView,
  studentResults,
  studentView,
} from "../views";

function me() {
  const user = requireRole("STUDENT");
  return { user, student: findStudent(user.id)! };
}

function currentRegistrations(studentId: number) {
  const semester = currentSemesterRow();
  return db.registrations.filter((row) => row.studentId === studentId && row.semesterId === semester.id);
}

const unitsOf = (rows: RegistrationRow[]) => rows.reduce((sum, row) => sum + findCourse(row.courseId)!.units, 0);

export const studentHandlers = {
  async getStudentDashboard(): Promise<StudentDashboard> {
    await sleep();
    const { student } = me();
    const registrations = currentRegistrations(student.userId);
    return {
      student: studentView(student),
      semester: semesterView(currentSemesterRow().id),
      cgpa: studentResults(student.userId).cgpa,
      registeredUnits: unitsOf(registrations),
      registeredCourses: registrations.length,
      maxUnits: MAX_UNITS_PER_SEMESTER,
    };
  },

  async getStudentProfile() {
    await sleep();
    return studentView(me().student);
  },

  async updateStudentContact(input: StudentContactInput) {
    await sleep();
    const { user, student } = me();
    user.phone = input.phone;
    student.address = input.address;
    logAudit(user, "UPDATE", "Profile", "Updated phone number and address");
    return studentView(student);
  },

  async getRegistrationOptions(): Promise<RegistrationOptions> {
    await sleep();
    const { student } = me();
    const semester = currentSemesterRow();
    const registered = new Set(currentRegistrations(student.userId).map((row) => row.courseId));
    return {
      semester: semesterView(semester.id),
      maxUnits: MAX_UNITS_PER_SEMESTER,
      courses: availableCourses(db.courses, student.programId, student.level, semester.name).map((course) => ({
        ...courseSummary(course),
        registered: registered.has(course.id),
      })),
    };
  },

  async registerCourses(courseIds: number[]) {
    await sleep();
    const { user, student } = me();
    const semester = currentSemesterRow();
    if (courseIds.length === 0) fail(400, "Select at least one course to register.");
    if (new Set(courseIds).size !== courseIds.length) fail(400, "A course can only be registered once per semester.");

    const available = new Map(
      availableCourses(db.courses, student.programId, student.level, semester.name).map((course) => [course.id, course]),
    );
    const existing = currentRegistrations(student.userId);
    for (const id of courseIds) {
      const course = available.get(id);
      if (!course) fail(400, "One of the selected courses isn't open to you this semester.");
      if (existing.some((row) => row.courseId === id)) fail(400, `${course.code} is already registered for this semester.`);
    }

    const total = unitsOf(existing) + courseIds.reduce((sum, id) => sum + available.get(id)!.units, 0);
    if (total > MAX_UNITS_PER_SEMESTER) {
      fail(400, `That would bring you to ${total} units. The limit is ${MAX_UNITS_PER_SEMESTER} per semester.`);
    }

    const registeredAt = now();
    for (const courseId of courseIds) {
      db.registrations.push({ id: nextId(db.registrations), studentId: student.userId, courseId, semesterId: semester.id, registeredAt });
    }
    logAudit(user, "REGISTER_COURSES", `${courseIds.length} courses`, `${total} units for ${semesterLabel(semesterView(semester.id))}`);
  },

  async getMyCourses(): Promise<MyCourses> {
    await sleep();
    const { student } = me();
    const semester = currentSemesterRow();
    const courses = currentRegistrations(student.userId)
      .map((row) => {
        const course = findCourse(row.courseId)!;
        const allocation = db.allocations.find((item) => item.courseId === course.id && item.semesterId === semester.id);
        return {
          ...courseSummary(course),
          lecturer: allocation ? displayName(findUser(allocation.lecturerId)!) : null,
          registeredAt: row.registeredAt,
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code));
    return {
      semester: semesterView(semester.id),
      student: studentView(student),
      courses,
      totalUnits: courses.reduce((sum, course) => sum + course.units, 0),
    };
  },

  async getMyResults() {
    await sleep();
    return studentResults(me().student.userId);
  },
};
