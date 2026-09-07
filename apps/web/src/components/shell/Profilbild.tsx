import { profilbildEntfernen, profilbildHochladen } from "@/lib/account";

/**
 * Profilbild wählen, ändern, entfernen.
 *
 * ── Warum ein einfaches Formular ──────────────────────────────
 *
 * Kein Ziehen-und-Ablegen, kein Zuschneidewerkzeug, keine Vorschau
 * mit Schieberegler. Ein Dateifeld und ein Knopf funktionieren mit
 * Tastatur, mit Vorlesegerät, auf dem Telefon und ohne JavaScript —
 * und für ein Bild, das mit 40 Pixeln angezeigt wird, ist alles
 * Weitere Aufwand ohne Ertrag.
 *
 * ── Warum das Bild hier gross zu sehen ist ────────────────────
 *
 * Damit man erkennt, was man hochgeladen hat. Im Kontomenü ist es
 * winzig; wer dort einen dunklen Fleck sieht, weiss nicht, ob das Bild
 * schlecht oder nur klein ist.
 */
export function Profilbild({
  bildKennung,
  name,
  kopf = false,
  kennung,
}: {
  bildKennung: string | null;
  name: string;
  /**
   * Als Kopf des Bereichs statt als eigener Abschnitt.
   *
   * Die Vorlage stellt Bild und Name nebeneinander an den Anfang —
   * das ist die Angabe, an der man erkennt, wessen Konto man gerade
   * ansieht. Als eigener Abschnitt mit Überschrift „Profilbild" und
   * drei Zeilen Erklärung stand das Bild dagegen mitten im Formular.
   *
   * Die Erklärung zu den Dateiformaten geht dabei nicht verloren; sie
   * steht klein unter den Knöpfen, wo sie gebraucht wird.
   */
  kopf?: boolean;
  /** Die Kennung unter dem Namen — E-Mail oder Telefonnummer. */
  kennung?: string | null;
}) {
  if (kopf) {
    return (
      /* Der Abstand ist grösser als der Rest der Seite: Bild und Name
         gehören zusammen, sind aber nicht dieselbe Sache. In der
         Vorlage steht der Name deutlich abgesetzt neben dem Bild,
         nicht daran geklebt. */
      <section aria-label="Konto" className="grid gap-6">
        {/*
          ══════════════════════════════════════════════════════════
          Bild und Name auf einer Linie, alles Weitere darunter
          ══════════════════════════════════════════════════════════

          Vorher stand alles rechts vom Bild: Name, Kennung UND die
          beiden Knöpfe. Die Spalte war damit so hoch wie das Bild,
          und der Name sass irgendwo in ihrer Mitte statt neben dem
          Gesicht.

          Jetzt trägt die obere Zeile nur, was zusammen die Person
          benennt — Bild, Name, Kennung, mittig zueinander. Was man
          TUN kann, steht darunter in eigener Zeile. Dieselbe
          Trennung wie im Leerzustand: oben, was IST; darunter, was
          man ändern kann.
        */}
        <div className="flex flex-wrap items-center gap-7">
          <Bild bildKennung={bildKennung} name={name} />

          <div className="grid min-w-0 gap-1">
            <h2 className="font-display text-3xl font-normal tracking-[-0.02em]">{name}</h2>
            {kennung && <p className="truncate text-sm text-ink-3">{kennung}</p>}
          </div>
        </div>

        <Knoepfe bildKennung={bildKennung} />
      </section>
    );
  }

  return (
    <section aria-labelledby="profilbild" className="grid gap-4">
      <div className="grid gap-1">
        <h2 id="profilbild" className="text-base font-semibold">
          Profilbild
        </h2>
        <p className="max-w-[46ch] text-sm leading-relaxed text-ink-2">
          Erscheint im Kontomenü. JPEG, PNG oder WebP, höchstens 2 MB. Es wird nirgends
          veröffentlicht — nur du siehst es.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-5">
        <Bild bildKennung={bildKennung} name={name} />
        <Knoepfe bildKennung={bildKennung} />
      </div>
    </section>
  );
}

/** Das Bild selbst — oder der Anfangsbuchstabe, wenn keines da ist. */
function Bild({ bildKennung, name }: { bildKennung: string | null; name: string }) {
  return (
    <>
        {bildKennung ? (
          // eslint-disable-next-line @next/next/no-img-element -- Die Route
          // liefert das Bild des angemeldeten Nutzers; sie kennt weder
          // Grösse noch Format im Voraus, und der Bildoptimierer könnte
          // sie ohne Sitzung ohnehin nicht abrufen.
          <img
            src={`/app/profilbild?v=${bildKennung}`}
            alt={`Profilbild von ${name}`}
            className="size-28 shrink-0 rounded-full border border-line object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="grid size-28 shrink-0 place-items-center rounded-full bg-accent text-3xl font-semibold text-accent-on"
          >
            {name.trim().slice(0, 1).toUpperCase()}
          </span>
        )}
    </>
  );
}

/** Hochladen, ersetzen, entfernen — in beiden Fassungen dieselben. */
function Knoepfe({ bildKennung }: { bildKennung: string | null }) {
  return (
        <div className="grid gap-3">
          {/*
            ══════════════════════════════════════════════════════
            Die Dateiauswahl trägt keine Browser-Beschriftung
            ══════════════════════════════════════════════════════

            Vorher stand hier das nackte `<input type="file">`. Der
            Browser malt daran seinen eigenen Knopf und daneben
            „No file chosen" — auf Englisch, mitten in einer deutschen
            Seite, in einer Schrift, die keine unsere ist. Kein `file:`
            -Stil ändert diesen Text; er gehört dem Browser.

            Deshalb ist das Feld versteckt und die Beschriftung ein
            eigener Knopf. `sr-only` statt `hidden`: Ein verstecktes
            Feld ist für die Tastatur nicht erreichbar, ein
            `sr-only`-Feld schon — und die Beschriftung führt den
            Fokus mit.

            Der Name der gewählten Datei erscheint nicht. Er stünde
            zwischen zwei Knöpfen und wäre bei langen Namen die
            breiteste Zeile der Seite; das Bild selbst zeigt nach dem
            Absenden ohnehin, was angekommen ist.
          */}
          <form action={profilbildHochladen} className="flex flex-wrap items-center gap-2.5">
            <label className="inline-flex min-h-9 cursor-pointer items-center rounded-(--radius-control) border border-line-3 px-4 text-sm text-ink transition-colors hover:bg-soft">
              <span>Bild wählen</span>
              <input
                type="file"
                name="bild"
                accept="image/jpeg,image/png,image/webp"
                required
                className="sr-only"
              />
            </label>
            <button
              type="submit"
              className="inline-flex min-h-9 items-center rounded-(--radius-control) bg-accent px-4 text-sm font-semibold text-accent-on transition-colors hover:bg-accent-hover"
            >
              {bildKennung ? "Ersetzen" : "Hochladen"}
            </button>
          </form>

          {bildKennung && (
            <form action={profilbildEntfernen}>
              <button
                type="submit"
                className="inline-flex min-h-9 items-center text-sm text-ink-2 underline underline-offset-[3px] hover:text-ink"
              >
                Bild entfernen
              </button>
            </form>
          )}

          {/*
            Der Hinweis auf Formate und Grösse stand hier und ist
            weg. Er beantwortete eine Frage, die niemand stellt,
            bevor er es versucht hat — und wer eine 8-MB-Datei wählt,
            erfährt es beim Absenden, wo die Antwort hingehört.

            Die Formate stehen weiterhin im `accept` des Feldes: Der
            Dateiwähler zeigt dann von vornherein nur, was geht.
          */}
        </div>
  );
}
