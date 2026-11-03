import { GraduationCap } from "lucide-react";

import { UNIVERSITY_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Brand({ className, inverted, vertical }: { className?: string; inverted?: boolean; vertical?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", vertical && "flex-col gap-1 text-center", className)}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl",
          vertical ? "size-12" : "size-9",
          inverted ? "bg-white text-neutral-950" : "bg-primary text-primary-foreground",
        )}
      >
        <GraduationCap className={vertical ? "size-7" : "size-5"} aria-hidden />
      </span>
      <div className="leading-tight">
        <p className={cn("font-semibold tracking-tight", vertical ? "text-[16px]" : "text-[15px]")}>{UNIVERSITY_NAME}</p>
        <p className={cn(vertical ? "text-[13px]" : "text-xs", inverted ? "text-white/60" : "text-muted-foreground")}>Education portal</p>
      </div>
    </div>
  );
}
