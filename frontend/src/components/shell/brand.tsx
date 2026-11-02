import { GraduationCap } from "lucide-react";

import { UNIVERSITY_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Brand({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          inverted ? "bg-white text-neutral-950" : "bg-primary text-primary-foreground",
        )}
      >
        <GraduationCap className="size-5" aria-hidden />
      </span>
      <div className="leading-tight">
        <p className="text-[15px] font-semibold tracking-tight">{UNIVERSITY_NAME}</p>
        <p className={cn("text-xs", inverted ? "text-white/60" : "text-muted-foreground")}>Education portal</p>
      </div>
    </div>
  );
}
