"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { stelleAnlegen } from "@/lib/arbeitgeber/stellen";

/**
 * Eine neue Stelle beginnt mit dem Titel und sonst nichts.
 *
 * Das vollständige Formular kommt danach. Wer erst zehn Felder ausfüllen
 * muss, bevor überhaupt ein Entwurf existiert, verliert alles, wenn der
 * Browser abstürzt — und schreibt beim zweiten Mal weniger.
 */
export function NeueStelle({ orgId }: { orgId: string }) {
  const [offen, setOffen] = useState(false);
  const [titel, setTitel] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-(--radius-control) bg-accent px-5 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover"
      >
        <Plus aria-hidden className="size-4" strokeWidth={2} />
        Neue Stelle
      </button>
    );
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await stelleAnlegen(orgId, titel);
          if (r.ok && r.id) router.push(`/business/stellen/${r.id}`);
          else setFehler(r.text);
        });
      }}
    >
      <label className="grid gap-1">
        <span className="sr-only">Titel der Stelle</span>
        <input
          autoFocus
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          placeholder="Disponent (m/w/d)"
          aria-label="Titel der Stelle"
          className="h-11 w-64 rounded-(--radius-control) bg-inset px-3.5 text-[15px] outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>
      <button
        type="submit"
        disabled={pending || titel.trim().length < 3}
        className="inline-flex h-11 items-center gap-2 rounded-(--radius-control) bg-accent px-5 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
        Anlegen
      </button>
      {fehler && (
        <span role="status" className="text-sm text-ink-2">
          {fehler}
        </span>
      )}
    </form>
  );
}
