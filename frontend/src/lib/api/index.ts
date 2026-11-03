import { actAsDemoUser, mockApi } from "../mock";
import { remoteApi, type Api } from "./remote";

export const usingMocks = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

// sign-in is always real; pages still on mock data show the demo user for the signed-in role
const realAuth: Pick<Api, "login" | "logout" | "getSession"> = {
  async login(input) {
    const user = await remoteApi.login(input);
    actAsDemoUser(user.role);
    return user;
  },
  async logout() {
    await remoteApi.logout();
    actAsDemoUser(null);
  },
  async getSession() {
    const user = await remoteApi.getSession();
    actAsDemoUser(user?.role ?? null);
    return user;
  },
};

const managementApi: Partial<Api> = {
  getCurrentSemester: remoteApi.getCurrentSemester,
  getFaculties: remoteApi.getFaculties,
  createFaculty: remoteApi.createFaculty,
  updateFaculty: remoteApi.updateFaculty,
  getDepartments: remoteApi.getDepartments,
  createDepartment: remoteApi.createDepartment,
  updateDepartment: remoteApi.updateDepartment,
  getSessions: remoteApi.getSessions,
  createSession: remoteApi.createSession,
  setCurrentSemester: remoteApi.setCurrentSemester,
  getUsers: remoteApi.getUsers,
  getUser: remoteApi.getUser,
  updateUserStatus: remoteApi.updateUserStatus,
  updateUserRole: remoteApi.updateUserRole,
  getPrograms: remoteApi.getPrograms,
  createProgram: remoteApi.createProgram,
  updateProgram: remoteApi.updateProgram,
  getStudents: remoteApi.getStudents,
  createStudent: remoteApi.createStudent,
  updateStudent: remoteApi.updateStudent,
  getLecturers: remoteApi.getLecturers,
  createLecturer: remoteApi.createLecturer,
  updateLecturer: remoteApi.updateLecturer,
  getCourses: remoteApi.getCourses,
  createCourse: remoteApi.createCourse,
  updateCourse: remoteApi.updateCourse,
  getAllocations: remoteApi.getAllocations,
  assignLecturer: remoteApi.assignLecturer,
  changePassword: remoteApi.changePassword,
};

export const api: Api = usingMocks ? { ...mockApi, ...realAuth, ...managementApi } : remoteApi;

export { ApiError, errorMessage } from "./http";
