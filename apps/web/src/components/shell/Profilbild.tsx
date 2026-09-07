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
      <section aria-label="Konto" className="flex flex-wrap items-center gap-6">
        <Bild bildKennung={bildKennung} name={name} />

        <div className="grid min-w-0 gap-2">
          <div className="grid gap-0.5">
            <h2 className="font-display text-2xl font-normal tracking-[-0.02em]">{name}</h2>
            {kennung && <p className="truncate text-sm text-ink-3">{kennung}</p>}
          </div>
          <Knoepfe bildKennung={bildKennung} />
        </div>
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
            className="size-20 shrink-0 rounded-full border border-line object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="grid size-20 shrink-0 place-items-center rounded-full bg-accent text-2xl font-semibold text-accent-on"
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
          <form action={profilbildHochladen} className="flex flex-wrap items-center gap-3">
            <label className="grid gap-1.5">
              <span className="sr-only">Bilddatei wählen</span>
              <input
                type="file"
                name="bild"
                accept="image/jpeg,image/png,image/webp"
                required
                className="max-w-full text-sm text-ink-2 file:mr-3 file:min-h-9 file:cursor-pointer file:rounded-(--radius-md) file:border file:border-line file:bg-surface file:px-3 file:text-sm file:font-medium file:text-ink hover:file:bg-soft"
              />
            </label>
            <button
              type="submit"
              className="inline-flex min-h-9 items-center rounded-(--radius-pill) bg-accent px-4 text-sm font-semibold text-accent-on transition-opacity hover:opacity-90"
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

          <p className="max-w-[46ch] text-2xs leading-relaxed text-ink-3">
            JPEG, PNG oder WebP, höchstens 2 MB. Es wird nirgends veröffentlicht — nur du
            siehst es.
          </p>
        </div>
  );
}
