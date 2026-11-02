import { mockApi } from "../mock";
import { remoteApi, type Api } from "./remote";

export const usingMocks = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export const api: Api = usingMocks ? mockApi : remoteApi;

export { ApiError, errorMessage } from "./http";
