import { GraduationCap } from "lucide-react";

import { UNIVERSITY_NAME } from "@/lib/constants";

export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <GraduationCap className="size-4.5" aria-hidden />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-tight">UEMP</p>
        <p className="text-xs text-muted-foreground">{UNIVERSITY_NAME}</p>
      </div>
    </div>
  );
}
