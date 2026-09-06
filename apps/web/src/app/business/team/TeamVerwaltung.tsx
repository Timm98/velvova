"use client";

import { useState, useTransition } from "react";
import { Copy, Loader2 } from "lucide-react";
import {
  einladen,
  einladungZuruecknehmen,
  mitgliedEntfernen,
  rolleAendern,
} from "@/lib/arbeitgeber/aktionen";
import { ROLLENBESCHREIBUNG, ROLLENNAME, type Rolle } from "@/lib/arbeitgeber/rollen";

const WAEHLBAR: Rolle[] = ["viewer", "recruiter", "admin"];

export function TeamVerwaltung({
  orgId,
  eigeneUserId,
  eigeneRolle,
  darfVerwalten,
  mitglieder,
  einladungen,
}: {
  orgId: string;
  eigeneUserId: string;
  eigeneRolle: Rolle;
  darfVerwalten: boolean;
  mitglieder: { userId: string; rolle: Rolle; email: string; name: string | null; seit: string }[];
  einladungen: { id: string; email: string; rolle: Rolle; laeuftAb: string }[];
}) {
  const [meldung, setMeldung] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [rolle, setRolle] = useState<Rolle>("recruiter");
  const [pending, start] = useTransition();

  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <h2 className="text-base font-semibold">Mitglieder</h2>
        <ul className="grid gap-2">
          {mitglieder.map((m) => (
            <li
              key={m.userId}
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-(--radius-surface) bg-surface p-4 ring-1 ring-line"
            >
              <span className="grid gap-0.5">
                <span className="text-sm font-medium text-ink">{m.name ?? m.email}</span>
                <span className="text-2xs text-ink-2">
                  {m.email} · seit {new Date(m.seit).toLocaleDateString("de-DE")}
                </span>
              </span>

              <span className="flex flex-wrap items-center gap-3">
                {darfVerwalten && m.rolle !== "owner" ? (
                  <label className="flex items-center gap-2 text-sm">
                    <span className="sr-only">Rolle von {m.email}</span>
                    <select
                      value={m.rolle}
                      disabled={pending}
                      onChange={(e) =>
                        start(async () => {
                          const r = await rolleAendern(orgId, m.userId, e.target.value as Rolle);
                          setMeldung(r.text);
                        })
                      }
                      className="h-9 rounded-(--radius-control) bg-inset px-2.5 text-sm outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {WAEHLBAR.map((r) => (
                        <option key={r} value={r}>
                          {ROLLENNAME[r]}
                        </option>
                      ))}
                      {eigeneRolle === "owner" && <option value="owner">Besitzer</option>}
                    </select>
                  </label>
                ) : (
                  <span className="text-sm text-ink-2">{ROLLENNAME[m.rolle]}</span>
                )}

                {(darfVerwalten || m.userId === eigeneUserId) && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await mitgliedEntfernen(orgId, m.userId);
                        setMeldung(r.text);
                      })
                    }
                    className="text-sm text-ink-3 underline underline-offset-[3px] hover:text-ink"
                  >
                    {m.userId === eigeneUserId ? "Austreten" : "Entfernen"}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {darfVerwalten && (
        <section className="grid gap-3 border-t border-line pt-8">
          <h2 className="text-base font-semibold">Jemanden einladen</h2>
          <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
            {ROLLENBESCHREIBUNG[rolle]}
          </p>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await einladen(orgId, email, rolle);
                setMeldung(r.text);
                setLink(r.link ?? null);
                if (r.ok) setEmail("");
              });
            }}
          >
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">E-Mail-Adresse</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="E-Mail-Adresse"
                className="h-11 w-72 rounded-(--radius-control) bg-inset px-3.5 text-[15px] outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Rolle</span>
              <select
                value={rolle}
                onChange={(e) => setRolle(e.target.value as Rolle)}
                aria-label="Rolle"
                className="h-11 rounded-(--radius-control) bg-inset px-3 text-[15px] outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-accent"
              >
                {WAEHLBAR.map((r) => (
                  <option key={r} value={r}>
                    {ROLLENNAME[r]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={pending || email.trim().length < 5}
              className="inline-flex h-11 items-center gap-2 rounded-(--radius-control) bg-accent px-5 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
              Einladen
            </button>
          </form>

          {link && (
            /*
             * Der Link steht hier und wird nicht verschickt.
             *
             * E-Mail-Versand hängt an einer Zustellung, die scheitern
             * kann — und dann sitzt jemand vor einer Einladung, die
             * angeblich raus ist. Der Link zum Weitergeben ist ehrlicher
             * und funktioniert sofort.
             */
            <div className="grid max-w-[var(--measure)] gap-2 rounded-(--radius-surface) bg-soft p-4">
              <p className="text-sm text-ink-2">
                Schick diesen Link an die eingeladene Person. Er gilt sieben Tage und funktioniert
                nur mit der angegebenen E-Mail-Adresse.
              </p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto rounded-(--radius-sm) bg-inset px-3 py-2 font-mono text-2xs text-ink">
                  {link}
                </code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(window.location.origin + link)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-(--radius-control) px-3 text-sm text-ink-2 ring-1 ring-line hover:bg-surface"
                >
                  <Copy aria-hidden className="size-3.5" strokeWidth={1.9} />
                  Kopieren
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {einladungen.length > 0 && (
        <section className="grid gap-3 border-t border-line pt-8">
          <h2 className="text-base font-semibold">Offene Einladungen</h2>
          <ul className="grid gap-2">
            {einladungen.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-(--radius-surface) bg-inset p-4"
              >
                <span className="text-sm text-ink-2">
                  {e.email} · {ROLLENNAME[e.rolle]} · gültig bis{" "}
                  {new Date(e.laeuftAb).toLocaleDateString("de-DE")}
                </span>
                {darfVerwalten && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await einladungZuruecknehmen(orgId, e.id);
                        setMeldung(r.text);
                      })
                    }
                    className="text-sm text-ink-3 underline underline-offset-[3px] hover:text-ink"
                  >
                    Zurücknehmen
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {meldung && (
        <p role="status" className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          {meldung}
        </p>
      )}
    </div>
  );
}
