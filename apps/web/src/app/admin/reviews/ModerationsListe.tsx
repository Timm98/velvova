"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, Check, Pin, Trash2, X } from "lucide-react";
import { Sterne } from "@/components/reviews/Sterne";
import {
  bewertungAblehnen,
  bewertungBearbeiten,
  bewertungFreigeben,
  bewertungKennzeichnen,
  bewertungLoeschen,
} from "@/lib/reviews/aktionen";
import { cn } from "@/lib/cn";

/**
 * Die Moderationsliste.
 *
 * Zwei Dinge, die eine Moderationsoberfläche gefährlich machen, und wie
 * sie hier vermieden werden:
 *
 *   **Ein Klick, der nicht rückgängig zu machen ist.** Löschen entfernt
 *   den Text einer anderen Person endgültig. Deshalb fragt es nach —
 *   und zwar mit dem Namen darin, damit sichtbar ist, welche Zeile
 *   gemeint war. Freigeben und Ablehnen sind umkehrbar und fragen nicht.
 *
 *   **Ein Text, der sich unter der Hand ändert.** Bearbeiten ist
 *   möglich, weil Tippfehler vorkommen, und es ist eingerückt und
 *   ausdrücklich zu öffnen, weil es der fremde Text einer anderen Person
 *   ist. Wer ihn umdeutet, fälscht eine Aussage.
 */

interface Zeile {
  id: string;
  displayName: string;
  roleOrCompany: string | null;
  contactEmail: string | null;
  rating: number;
  headline: string | null;
  body: string;
  status: string;
  isVerified: boolean;
  isFeatured: boolean;
  sortOrder: number;
  helpfulCount: number;
  moderationNote: string | null;
  createdAt: Date;
  publishedAt: Date | null;
}

export function ModerationsListe({
  titel,
  hinweis,
  zeilen,
}: {
  titel: string;
  hinweis: string;
  zeilen: Zeile[];
}) {
  return (
    <section className="grid gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">{titel}</h2>
        <p className="mt-1 text-sm text-ink-3">{hinweis}</p>
      </div>

      {zeilen.length === 0 ? (
        <p className="text-sm text-ink-3">Nichts hier.</p>
      ) : (
        <ul className="grid gap-3">
          {zeilen.map((z) => (
            <li key={z.id}>
              <Eintrag zeile={z} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Eintrag({ zeile }: { zeile: Zeile }) {
  const [pending, startTransition] = useTransition();
  const [bearbeiten, setBearbeiten] = useState(false);
  const [headline, setHeadline] = useState(zeile.headline ?? "");
  const [body, setBody] = useState(zeile.body);
  const [loeschfrage, setLoeschfrage] = useState(false);

  const tun = (fn: () => Promise<void>) => startTransition(() => void fn());

  return (
    <div className="grid gap-4 rounded-(--radius-md) border border-line-2 bg-inset p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Sterne wert={zeile.rating} groesse="sm" />
            <span className="text-sm font-medium">{zeile.displayName}</span>
            {zeile.roleOrCompany && (
              <span className="text-sm text-ink-3">{zeile.roleOrCompany}</span>
            )}
          </div>
          <p className="mt-1 font-mono text-2xs text-ink-3">
            {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(
              zeile.createdAt,
            )}
            {/* Nur hier sichtbar, nie öffentlich. */}
            {zeile.contactEmail ? ` · ${zeile.contactEmail}` : " · keine E-Mail"}
            {zeile.helpfulCount > 0 ? ` · ${zeile.helpfulCount}× hilfreich` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {zeile.isVerified && (
            <span className="inline-flex items-center gap-1 rounded-(--radius-pill) bg-positive-soft px-2.5 py-1 text-2xs">
              <BadgeCheck aria-hidden className="size-3.5 text-positive" strokeWidth={2.2} />
              verifiziert
            </span>
          )}
          {zeile.isFeatured && (
            <span className="inline-flex items-center gap-1 rounded-(--radius-pill) bg-lavender px-2.5 py-1 text-2xs">
              <Pin aria-hidden className="size-3.5" strokeWidth={2} />
              hervorgehoben · {zeile.sortOrder}
            </span>
          )}
        </div>
      </div>

      {bearbeiten ? (
        <div className="grid gap-2">
          <input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={120}
            placeholder="Überschrift"
            className="min-h-10 rounded-(--radius-sm) border border-line bg-surface px-3 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            maxLength={5000}
            className="rounded-(--radius-sm) border border-line bg-surface p-3 text-sm leading-relaxed"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || body.trim().length < 30}
              onClick={() =>
                tun(async () => {
                  await bewertungBearbeiten(zeile.id, { headline, body });
                  setBearbeiten(false);
                })
              }
              className="inline-flex min-h-9 items-center rounded-(--radius-pill) bg-accent px-4 text-sm text-accent-on disabled:opacity-60"
            >
              Übernehmen
            </button>
            <button
              type="button"
              onClick={() => {
                setHeadline(zeile.headline ?? "");
                setBody(zeile.body);
                setBearbeiten(false);
              }}
              className="inline-flex min-h-9 items-center rounded-(--radius-pill) px-4 text-sm text-ink-2 hover:bg-soft"
            >
              Verwerfen
            </button>
          </div>
        </div>
      ) : (
        <>
          {zeile.headline && <p className="text-sm font-medium">{zeile.headline}</p>}
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">{zeile.body}</p>
        </>
      )}

      {zeile.moderationNote && zeile.status === "rejected" && (
        <p className="rounded-(--radius-sm) bg-surface px-3 py-2 text-xs text-ink-3">
          Notiz: {zeile.moderationNote}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 border-t border-line-2 pt-3">
        {zeile.status !== "approved" && (
          <Knopf
            aus="primaer"
            pending={pending}
            onClick={() => tun(() => bewertungFreigeben(zeile.id))}
          >
            <Check className="size-4" strokeWidth={2.2} />
            Freigeben
          </Knopf>
        )}
        {zeile.status !== "rejected" && (
          <Knopf pending={pending} onClick={() => tun(() => bewertungAblehnen(zeile.id))}>
            <X className="size-4" strokeWidth={2} />
            Ablehnen
          </Knopf>
        )}
        <Knopf pending={pending} onClick={() => setBearbeiten((v) => !v)}>
          Bearbeiten
        </Knopf>
        <Knopf
          pending={pending}
          onClick={() => tun(() => bewertungKennzeichnen(zeile.id, { verifiziert: !zeile.isVerified }))}
        >
          {zeile.isVerified ? "Verifizierung entfernen" : "Als verifiziert markieren"}
        </Knopf>
        <Knopf
          pending={pending}
          onClick={() =>
            tun(() => bewertungKennzeichnen(zeile.id, { hervorgehoben: !zeile.isFeatured }))
          }
        >
          {zeile.isFeatured ? "Nicht mehr hervorheben" : "Hervorheben"}
        </Knopf>
        {zeile.isFeatured && (
          <label className="inline-flex min-h-9 items-center gap-2 rounded-(--radius-pill) px-3 text-sm text-ink-2">
            Reihenfolge
            <input
              type="number"
              defaultValue={zeile.sortOrder}
              min={0}
              max={99}
              onBlur={(e) =>
                tun(() =>
                  bewertungKennzeichnen(zeile.id, { reihenfolge: Number(e.target.value) || 0 }),
                )
              }
              className="h-8 w-16 rounded-(--radius-sm) border border-line bg-surface px-2 font-mono text-sm tabular"
            />
          </label>
        )}

        {/*
         * Löschen fragt nach — mit dem Namen darin.
         *
         * Es entfernt den Text einer anderen Person endgültig. Ein
         * Bestätigungsdialog, der nur „Wirklich löschen?" fragt, hilft
         * nicht: bei zwanzig Einträgen untereinander weiss man nach dem
         * Klick nicht mehr sicher, welchen man getroffen hat.
         */}
        {loeschfrage ? (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span className="text-sm text-critical">
              Bewertung von {zeile.displayName} endgültig löschen?
            </span>
            <Knopf
              aus="gefahr"
              pending={pending}
              onClick={() => tun(() => bewertungLoeschen(zeile.id))}
            >
              Ja, löschen
            </Knopf>
            <Knopf pending={pending} onClick={() => setLoeschfrage(false)}>
              Abbrechen
            </Knopf>
          </span>
        ) : (
          <Knopf pending={pending} onClick={() => setLoeschfrage(true)}>
            <Trash2 className="size-4" strokeWidth={1.9} />
            Löschen
          </Knopf>
        )}
      </div>
    </div>
  );
}

function Knopf({
  children,
  onClick,
  pending,
  aus,
}: {
  children: React.ReactNode;
  onClick: () => void;
  pending: boolean;
  aus?: "primaer" | "gefahr";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-(--radius-pill) px-3.5 text-sm transition-colors disabled:opacity-60",
        aus === "primaer"
          ? "bg-accent text-accent-on hover:bg-accent-hover"
          : aus === "gefahr"
            ? "bg-critical text-white"
            : "text-ink-2 hover:bg-soft hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
