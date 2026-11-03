"use client";

import { useEffect } from "react";

export function useLeaveWarning(active: boolean, message: string) {
  useEffect(() => {
    if (!active) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    // next's client-side navigation never fires beforeunload, so links are checked before the router sees the click
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link || link.getAttribute("target") === "_blank") return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
    };
  }, [active, message]);
}
