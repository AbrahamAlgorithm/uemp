import { currentUser, sleep } from "../session";
import { currentSemesterRow, semesterView } from "../views";

export const commonHandlers = {
  async getCurrentSemester() {
    await sleep();
    currentUser();
    return semesterView(currentSemesterRow().id);
  },
};
