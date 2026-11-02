import { toast } from "sonner";

import { errorMessage } from "./api";

export async function withToast(action: Promise<unknown>, success: string): Promise<boolean> {
  try {
    await action;
    toast.success(success);
    return true;
  } catch (error) {
    toast.error(errorMessage(error));
    return false;
  }
}
