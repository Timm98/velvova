"use client";

import { useState, useTransition } from "react";
import { toggleSaveJob } from "@/lib/jobActions";
import { buttonClass } from "@/components/ui";

export function SaveJobButton({
  jobId,
  initiallySaved,
  labels,
}: {
  jobId: string;
  initiallySaved: boolean;
  labels: { save: string; saved: string };
}) {
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() =>
        startTransition(async () => {
          const result = await toggleSaveJob(jobId);
          setSaved(result.saved);
        })
      }
      disabled={pending}
      className={buttonClass(saved ? "quiet" : "secondary")}
    >
      {saved ? `✓ ${labels.saved}` : labels.save}
    </button>
  );
}
