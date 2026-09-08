"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { Kontogruppe } from "./kontoeintraege";

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
  gruppen,
  onLogout,
  bildKennung = null,
  assistent,
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
  gruppen: Kontogruppe[];
  /** Der Name der Begleitung — für den Hinweis am Fuss des Menüs. */
  assistent: string;
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
          /*
            ══════════════════════════════════════════════════════
            Die Masse stammen aus der Vorlage, nicht aus dem Gefühl
            ══════════════════════════════════════════════════════

            Beide Menüs nebeneinander gemessen, auf gleicher Skala:

              Breite        Vorlage 350 px   wir 288
              Zeilenhöhe            49              35
              Innenabstand links    32              12
              Zeichen               20              16
              Schriftgrad           16              14

            Unseres war überall enger. Der Unterschied liest sich
            nicht als „kompakt", sondern als gedrängt: Zwölf Zeilen
            in einem schmalen Feld sehen aus wie eine Liste, durch
            die man sich arbeiten muss.

            Die Ecken sind flacher (6 statt 12) und es gibt wieder
            eine Kante — die Vorlage hat beides.
          */
          /*
            ══════════════════════════════════════════════════════
            Die Füllung ist ein Token, weil sie zwei Antworten hat
            ══════════════════════════════════════════════════════

            Hier stand `#10141d` als fester Wert. Im dunklen Theme
            war er richtig gewählt: `--surface-1` (#141a28) war zu
            hell, der Seitengrund (#0c0f18) zu dunkel — das Feld
            verschwand darin. #10141d liegt dazwischen.

            Nur gilt das ausschliesslich dort. Es gibt ein helles
            Theme mit dem Seitengrund #f7f8fc, und in dem war dieses
            Feld eine fast schwarze Fläche — mit `text-ink` darauf,
            also dunkler Schrift auf Dunkel. Gemeldet am 8. September
            2026: „oben rechts, wenn ich das aufklappe, ist
            durchsichtig". Durchsichtig war es nicht; es war
            unlesbar, und das sieht gleich aus.

            Ein fester Farbwert in einem Bauteil ist eine Annahme
            über das Theme. Sie stimmt genau so lange, wie es nur
            eines gibt. Die Absicht — „eine eigene Fläche, klar
            abgesetzt vom Seitengrund" — steht jetzt als
            `--surface-kontofeld` im Kern und hat dort je Theme
            ihren Wert.
          */
          /*
           * Mit Rückfall, obwohl das Token überall definiert ist.
           *
           * Geprüft im gebauten CSS: `:root,[data-theme=light]` setzt
           * es auf #fff, der Dunkelblock auf #10141d. Es kann also
           * nicht fehlen.
           *
           * Der Rückfall steht trotzdem da, weil das Ausbleiben eines
           * Tokens hier keinen sichtbaren Fehler ergibt, sondern ein
           * DURCHSICHTIGES Feld — und ein durchsichtiges Menü sieht
           * nicht nach einem fehlenden Wert aus, sondern nach einem
           * kaputten Bauteil. Genau so wurde es dreimal gemeldet.
           *
           * `--surface-1` gibt es seit der ersten Fassung der Tokens.
           * Sie ist einen Hauch heller als das Kontofeld sein soll;
           * das ist der richtige Preis dafür, dass hier nie wieder
           * etwas durchscheint.
           */
          style={{ background: "var(--surface-kontofeld, var(--surface-1, #141a28))" }}
          className="absolute right-0 top-[calc(100%_+_10px)] z-50 w-[21.75rem] animate-fade-in rounded-(--radius-sm) border border-line-3 px-2 pb-2 pt-12 shadow-xl"
        >
          {/*
            ══════════════════════════════════════════════════════
            Die Spitze zeigt auf das Profilbild
            ══════════════════════════════════════════════════════

            Ein gedrehtes Quadrat mit zwei sichtbaren Kanten, halb
            hinter der Fläche. Es sagt, WOHER das Feld kommt — ohne
            sie schwebt es an der rechten Ecke, und bei zwei Knöpfen
            nebeneinander (Glocke und Bild) rät man, welcher es
            geöffnet hat.

            `right-4`: Das Profilbild ist 44 Pixel breit, seine Mitte
            liegt 22 von der rechten Kante des Behälters. Ein 12er
            Quadrat trifft sie mit 16 Pixeln Abstand.
          */}
          <span
            aria-hidden
            style={{ background: "#10141d" }}
            className="absolute -top-[7px] right-4 size-3 rotate-45 rounded-tl-[2px] border-l border-t border-line-3"
          />

          {/*
            ══════════════════════════════════════════════════════
            Kein Namensblock am Kopf des Menüs
            ══════════════════════════════════════════════════════

            Hier standen Name und Adresse in einem eigenen Feld mit
            Trennlinie. In der Vorlage gibt es das nicht — dort
            beginnt das Menü sofort mit dem ersten Weg.

            Der Grund ist gut: Wer das Menü öffnet, hat gerade auf
            SEIN Profilbild geklickt. Ihm danach seinen Namen zu
            zeigen, beantwortet eine Frage, die er nicht gestellt
            hat — und der Block schob alle Wege zwei Zeilen nach
            unten.

            Für Vorlesegeräte bleibt die Angabe erhalten: Der Knopf
            trägt sie bereits als Beschriftung.
          */}

          {/*
            Zwei Gruppen mit einer Haarlinie dazwischen — wie in der
            Vorlage. Oben die Bereiche, in denen man arbeitet, unten
            das Konto selbst.

            Die Gruppentitel stehen nur für Vorlesegeräte da: Sichtbar
            trennt die Linie, und zwei Überschriften in einem Menü mit
            zwölf Zeilen wären mehr Aufwand als Auskunft.
          */}
          {gruppen.map((gruppe, i) => (
            <div key={gruppe.titel}>
              {/*
                Die Linie als eigenes Element, nicht als Rand der
                Gruppe.

                Mit `border-t` an der Gruppe kam der Einzug der Linie
                (`mx-4`) auch auf ihre Einträge — die zweite Gruppe
                stand vier Pixel weiter rechts als die erste. In der
                Vorlage ist die Linie eingerückt und die Einträge
                stehen auf einer Kante.
              */}
              {i > 0 && <div aria-hidden className="mx-5 my-2 border-t border-line-3" />}
              <h2 className="sr-only">{gruppe.titel}</h2>
              <ul className="grid gap-0.5">
                {gruppe.eintraege.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        role="menuitem"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3.5 rounded-(--radius-sm) px-5 py-3 text-base font-medium text-ink transition-colors hover:bg-sunken"
                      >
                        <Icon className="size-[19px] shrink-0 text-ink" strokeWidth={2} />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <>
            <div aria-hidden className="mx-5 my-2 border-t border-line-3" />
            {onLogout}
          </>

          {/*
            Der Block am Fuss des Menüs — in der Vorlage steht dort
            eine Bitte um Mithilfe an Studien.

            Bei uns steht dort etwas, das es wirklich gibt: die
            nächtliche Suche. Ein erfundenes Studienprogramm wäre
            genau die Art Fläche, die man einmal liest und danach nie
            wieder — weil beim ersten Klick nichts dahinter war.
          */}
          <div aria-hidden className="mx-5 my-2 border-t border-line-3" />

          <div className="px-5 pb-1 pt-1.5">
            <p className="text-sm font-semibold text-ink">Auch wenn du nicht da bist</p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-3">
              Ein Suchauftrag lässt {assistent} über Nacht weitersuchen und meldet nur, was
              wirklich passt.
            </p>
            <Link
              href="/app/jobs#nachts"
              onClick={() => setOpen(false)}
              className="mt-2 inline-block text-xs text-accent-text underline underline-offset-[3px]"
            >
              Suchauftrag einrichten
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
