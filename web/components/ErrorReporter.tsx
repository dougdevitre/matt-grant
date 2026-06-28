"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/report-error";

// Installs global handlers so uncaught errors and unhandled promise rejections
// anywhere on the page get reported — React error boundaries only catch errors
// thrown during render. Renders nothing.
export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) =>
      reportError(e.error ?? e.message, { kind: "uncaught", source: e.filename ?? "", line: e.lineno ?? 0 });
    const onRejection = (e: PromiseRejectionEvent) => reportError(e.reason, { kind: "unhandledrejection" });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
