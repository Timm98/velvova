"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { organisationAendern } from "@/lib/arbeitgeber/aktionen";

export function OrgFormular({
  orgId,
  name: start,
  website: startWeb,
  darfAendern,
}: {
  orgId: string;
  name: string;
  website: string;
  darfAendern: boolean;
}) {
  const [name, setName] = useState(start);
  const [website, setWebsite] = useState(startWeb);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [pending, start2] = useTransition();

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start2(async () => {
          const r = await organisationAendern(orgId, { name, website });
          setMeldung(r.text);
        });
      }}
    >
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!darfAendern}
          aria-label="Name"
          className={eingabe}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Website</span>
        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          disabled={!darfAendern}
          placeholder="https://…"
          aria-label="Website"
          className={eingabe}
        />
      </label>

      {darfAendern ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || name.trim().length < 2}
            className="inline-flex h-11 items-center gap-2 rounded-(--radius-control) bg-accent px-5 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
            Speichern
          </button>
          {meldung && (
            <span role="status" className="text-sm text-ink-2">
              {meldung}
            </span>
          )}
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-ink-2">
          Ändern darf das die Verwaltung. Du kannst es ansehen.
        </p>
      )}
    </form>
  );
}

const eingabe =
  "h-11 rounded-(--radius-control) bg-inset px-3.5 text-[15px] outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60";
