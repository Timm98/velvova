"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Das Kontomenü.
 *
 * Hier landet alles, was früher als einzelne Schalter die Kopfzeile
 * verstopft hat: Sprache und Region, Erscheinungsbild, Datenschutz,
 * Abmelden. Ein Menü mit sechs Einträgen ist ruhiger als sechs Schalter
 * nebeneinander — und es sagt zusätzlich, dass all das zum Konto gehört
 * und nicht zur Arbeit an der Bewerbung.
 */
export function AccountMenu({
  userName,
  userEmail,
  items,
  onLogout,
  bildKennung = null,
}: {
  userName: string | null;
  userEmail: string;
  /** Ob ein Profilbild hinterlegt ist. Ohne bleibt der Anfangsbuchstabe. */
  /**
   * Die Kennung des Bildes — nicht nur, DASS eines da ist.
   *
   * Sie steht im Adressanhang und ist der einzige Grund, warum ein
   * gewechseltes Bild überhaupt sichtbar wird: Ohne sie hat jedes
   * Bild dieselbe Adresse, und der Browser holt sie ein Jahr lang
   * nicht neu. Siehe `lib/profilbild-kennung.ts`.
   */
  bildKennung?: string | null;
  items: { href: string; label: string; icon: LucideIcon }[];
  onLogout: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initials = (userName ?? userEmail).trim().slice(0, 1).toUpperCase();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    // Escape schließt, und der Fokus bleibt danach im Auslöser: sonst
    // springt er an den Seitenanfang und die Tastaturbedienung verliert
    // ihren Platz.
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        containerRef.current?.querySelector("button")?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Kontomenü"
        className={cn(
          "relative grid size-11 place-items-center rounded-(--radius-full) text-sm font-medium transition-colors",
          bildKennung ? "border border-line" : "bg-inset text-ink-2 hover:bg-line-2",
          open && "ring-2 ring-brand/40",
        )}
      >
        {/*
          Ein kleiner Pfeil unten rechts sagt, dass sich hier etwas
          aufklappt. Ohne ihn sieht der Kreis aus wie ein Bild, nicht
          wie ein Knopf — und niemand klickt auf ein Bild, um zu den
          Einstellungen zu kommen.

          ── Warum jetzt ohne Plättchen ─────────────────────────

          Vorher sass der Pfeil in einem eigenen kleinen Kreis mit
          Rand und Seitenfarbe. Neben einem Profilbild war das ein
          zweiter Kreis am Rand des ersten — die Vorlage zeichnet dort
          nur den Strich, der über die Kante des Bildes läuft.

          Ein blosser Strich kann auf einem hellen Foto verschwinden.
          Deshalb der Schlagschatten: Er trägt den Kontrast, ohne eine
          zweite Form danebenzusetzen.
        */}
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 text-white [filter:drop-shadow(0_1px_2px_rgb(0_0_0/0.75))]"
        >
          <ChevronDown className="size-3.5" strokeWidth={3} />
        </span>
        {bildKennung ? (
          /*
            Kein `next/image`: Die Route liefert das Bild des
            angemeldeten Nutzers und ist ohne Sitzung nicht abrufbar —
            der Bildoptimierer holt sie serverseitig ohne Cookie und
            bekäme eine 404.

            `alt=""` und `aria-hidden` sind richtig, weil der Knopf
            bereits „Kontomenü" heisst: Ein zweiter Name daneben wäre
            für ein Vorlesegerät eine Wiederholung.
          */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/app/profilbild?v=${bildKennung}`}
            alt=""
            aria-hidden
            className="size-full rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </button>

      {open && (
        <div
          role="menu"
          /* Gefüllt statt umrandet, wie das Fenster unten rechts: Ein
             schwebendes Feld braucht keinen Rahmen, seine Fläche ist
             seine Grenze. */
          className="absolute right-0 top-[calc(100%_+_8px)] z-50 w-64 animate-fade-in rounded-(--radius-xl) bg-elevated p-1.5 shadow-xl"
        >
          <div className="border-b border-line px-3 py-2.5">
            <p className="truncate text-sm font-medium">{userName ?? "Konto"}</p>
            <p className="truncate text-xs text-ink-3">{userEmail}</p>
          </div>

          <ul className="grid gap-0.5 py-1.5">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 rounded-(--radius-sm) px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
                  >
                    <Icon className="size-4 shrink-0 text-ink-3" strokeWidth={1.8} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Das Abmelden-Formular kommt fertig gestaltet vom Server:
              es enthält eine Server Action, die eine Client-Komponente
              nicht auseinandernehmen und neu zusammensetzen darf. */}
          <div className="border-t border-line pt-1.5">{onLogout}</div>
        </div>
      )}
    </div>
  );
}
