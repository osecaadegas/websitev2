"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackPageView } from "@/lib/analytics/tracker";

/**
 * Invisible component that auto-tracks page views on route changes.
 * Place once in AppShell or layout.
 */
export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    trackPageView();
  }, [pathname]);

  return null;
}
