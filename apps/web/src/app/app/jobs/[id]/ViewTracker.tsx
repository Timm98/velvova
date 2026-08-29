"use client";

import { useEffect, useRef } from "react";
import { viewJob } from "@/lib/jobActions";

/**
 * Erfasst, dass eine Stelle angesehen wurde - Grundlage der
 * Trichterdiagnose. Genau ein Ereignis je Seitenaufruf, kein
 * Verhaltenstracking darueber hinaus.
 */
export function ViewTracker({ jobId }: { jobId: string }) {
  const recorded = useRef(false);

  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    void viewJob(jobId).catch(() => undefined);
  }, [jobId]);

  return null;
}
