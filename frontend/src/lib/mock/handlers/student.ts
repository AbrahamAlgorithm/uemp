import { MAX_UNITS_PER_SEMESTER } from "../../constants";
import type { StudentContactInput } from "../../schemas";
import type { StudentDashboard } from "../../types";
import { db, type RegistrationRow } from "../db";
import { logAudit, requireRole, sleep } from "../session";
import { cgpaOf, currentSemesterRow, findCourse, findStudent, semesterView, studentView } from "../views";

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
      cgpa: cgpaOf(student.userId),
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
};
