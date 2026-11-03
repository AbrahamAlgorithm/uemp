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

export const api: Api = usingMocks ? { ...mockApi, ...realAuth } : remoteApi;

export { ApiError, errorMessage } from "./http";
