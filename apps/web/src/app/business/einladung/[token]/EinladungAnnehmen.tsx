"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { einladungAnnehmen } from "@/lib/arbeitgeber/aktionen";

export function EinladungAnnehmen({ token }: { token: string }) {
  const [meldung, setMeldung] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await einladungAnnehmen(token);
            setMeldung(r.text);
            if (r.ok) router.push("/business");
          })
        }
        className="inline-flex h-11 items-center gap-2 rounded-(--radius-control) bg-accent px-5 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
        Einladung annehmen
      </button>
      {meldung && (
        <span role="status" className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          {meldung}
        </span>
      )}
    </div>
  );
}
