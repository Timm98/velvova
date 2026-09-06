"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { organisationGruenden } from "@/lib/arbeitgeber/aktionen";

/**
 * Das Firmenkonto anlegen.
 *
 * ── Warum dieselben Formen wie bei der Anmeldung ──────────────
 *
 * Das Formular benutzte den Baukasten der Anwendung: Pillenfelder,
 * 44 Pixel hoch, Knopf in der Zeile daneben. Wer von der Anmeldung
 * kommt — und das tun hier fast alle — sah damit dieselbe Marke mit
 * anderen Bauteilen.
 *
 * Feldhöhe, Rundung und Knopfform sind jetzt die aus
 * `(auth)/formstuecke`. Übernommen, nicht importiert: Der
 * Arbeitgeberbereich soll nicht am Anmeldebereich hängen, nur weil
 * zwei Formulare gleich aussehen sollen.
 */

const FELD =
  "h-[56px] w-full rounded-[10px] border border-line-3 bg-transparent px-4 text-[15px] text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] hover:border-ink-3 focus-visible:border-(--primary) focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--primary)] disabled:opacity-60";

export function GruendenFormular() {
  const [name, setName] = useState("");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await organisationGruenden(name);
          setMeldung(r.text);
          if (r.ok) router.push("/business/bestaetigen");
        });
      }}
    >
      <label className="grid gap-2">
        <span className="text-sm text-ink-2">Name des Unternehmens</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nordwind GmbH"
          disabled={pending}
          className={FELD}
        />
      </label>

      <button
        type="submit"
        disabled={pending || name.trim().length < 2}
        className="inline-flex h-[56px] w-full items-center justify-center gap-2 rounded-[10px] bg-accent text-[15px] font-medium text-accent-on transition-[opacity,transform] hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
      >
        {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
        {pending ? "Wird angelegt …" : "Firmenkonto anlegen"}
      </button>

      {meldung && (
        <p aria-live="polite" className="text-center text-sm text-ink-2">
          {meldung}
        </p>
      )}
    </form>
  );
}
