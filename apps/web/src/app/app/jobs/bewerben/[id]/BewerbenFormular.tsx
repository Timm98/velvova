"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { bewerben } from "@/lib/arbeitgeber/bewerbungen";

export function BewerbenFormular({
  postingId,
  vorschlagName,
  vorschlagEmail,
}: {
  postingId: string;
  vorschlagName: string;
  vorschlagEmail: string;
}) {
  const [name, setName] = useState(vorschlagName);
  const [email, setEmail] = useState(vorschlagEmail);
  const [headline, setHeadline] = useState("");
  const [note, setNote] = useState("");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await bewerben(postingId, {
            displayName: name,
            contactEmail: email,
            headline,
            coverNote: note,
          });
          setMeldung(r.text);
          if (r.ok) router.push("/app/applications");
        });
      }}
    >
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Name"
          className={eingabe}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Kontaktadresse</span>
        <span className="text-2xs text-ink-3">
          An diese Adresse meldet sich das Unternehmen. Du kannst eine andere angeben als die, mit
          der du hier angemeldet bist.
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Kontaktadresse"
          className={eingabe}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">In einem Satz</span>
        <input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Disponentin mit vier Jahren Erfahrung im Nahverkehr"
          aria-label="In einem Satz"
          className={eingabe}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Anschreiben</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={10}
          aria-label="Anschreiben"
          className="rounded-(--radius-control) bg-inset p-3.5 text-[15px] leading-relaxed outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || name.trim().length < 2}
          className="inline-flex h-11 items-center gap-2 rounded-(--radius-control) bg-accent px-5 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
          Bewerbung abschicken
        </button>
        {meldung && (
          <span role="status" className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            {meldung}
          </span>
        )}
      </div>
    </form>
  );
}

const eingabe =
  "h-11 rounded-(--radius-control) bg-inset px-3.5 text-[15px] outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent";
