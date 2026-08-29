"use client";

import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toggleSaveJob } from "@/lib/jobActions";
import { Button } from "@/components/ui";

/**
 * Merken.
 *
 * Der Zustand wechselt sofort im Browser und wird danach vom Server
 * bestätigt. Auf die Antwort zu warten, bevor sich etwas rührt, lässt
 * eine Oberfläche träge wirken — und die Handlung ist gefahrlos genug,
 * dass ein optimistischer Wechsel vertretbar ist.
 */
export function SaveJobButton({
  jobId,
  initiallySaved,
  labels,
  full = false,
}: {
  jobId: string;
  initiallySaved: boolean;
  labels: { save: string; saved: string };
  full?: boolean;
}) {
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant={saved ? "subtle" : "secondary"}
      size="sm"
      full={full}
      aria-pressed={saved}
      disabled={pending}
      onClick={() => {
        setSaved((v) => !v);
        startTransition(async () => {
          const result = await toggleSaveJob(jobId);
          setSaved(result.saved);
        });
      }}
    >
      {saved ? (
        <BookmarkCheck className="size-4 text-accent" strokeWidth={2} />
      ) : (
        <Bookmark className="size-4" strokeWidth={1.9} />
      )}
      {saved ? labels.saved : labels.save}
    </Button>
  );
}
