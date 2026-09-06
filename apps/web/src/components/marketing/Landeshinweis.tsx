import { landesname, type Landeslage } from "@/lib/landeslage";
import type { Herkunftsquelle } from "@/lib/herkunft";

/**
 * Was für dieses Land gilt — und wie man es richtigstellt.
 *
 * ── Warum das sichtbar sein muss ──────────────────────────────
 *
 * Eine Seite, die sich stillschweigend anpasst, ist schlechter als eine,
 * die es nicht tut: Man merkt die Anpassung nicht, kann sie also nicht
 * korrigieren, und wundert sich nur, warum da etwas anderes steht als
 * beim Kollegen.
 *
 * Deshalb steht hier beides — was angenommen wurde und woher. Wer über
 * ein Firmen-VPN kommt, im Urlaub ist oder umziehen will, sieht sofort,
 * dass die Vermutung nicht stimmt, und ändert sie mit einem Klick.
 *
 * ── Warum es bei Deutschland verschwindet ─────────────────────
 *
 * Für Deutschland gibt es nichts einzuschränken. Ein Band, das immer da
 * ist, liest nach der zweiten Seite niemand mehr — und dann wird es auch
 * dort übersehen, wo es etwas zu sagen hat.
 *
 * Der Schalter bleibt trotzdem erreichbar: als kleine Zeile im Fuss.
 */
export function Landeshinweis({
  lage,
  quelle,
  pfad = "/",
}: {
  lage: Landeslage;
  quelle: Herkunftsquelle;
  pfad?: string;
}) {
  if (!lage.hinweis) return null;

  const woher = {
    gewaehlt: "von dir gewählt",
    netz: "anhand deiner Verbindung angenommen",
    sprache: "aus deiner Spracheinstellung geschlossen",
    unbekannt: "angenommen",
  }[quelle];

  return (
    <div style={{ background: "var(--ed-violet-soft)" }}>
      <div className="mx-auto grid w-full max-w-[1240px] gap-2 px-5 py-4 md:flex md:items-center md:gap-6 md:px-8">
        <p
          className="max-w-[72ch] text-sm leading-relaxed"
          style={{ color: "var(--ed-ink-2)" }}
        >
          <span className="font-medium" style={{ color: "var(--ed-ink)" }}>
            {landesname(lage.code)}
          </span>{" "}
          — {lage.hinweis}
        </p>

        <p className="text-2xs md:ml-auto md:shrink-0" style={{ color: "var(--ed-ink-3)" }}>
          {woher} ·{" "}
          {/*
            Ein gewöhnliches `<a>`, kein `<Link>`.
            
            `<Link>` navigiert im Browser weiter und darf dabei die
            zwischengespeicherte Antwort wiederverwenden — die Route
            setzt das Cookie, und die Seite wird trotzdem aus dem alten
            Stand gezeichnet. Man klickt, und nichts ändert sich.
            
            Ein voller Seitenwechsel holt die Seite neu, mit dem neuen
            Cookie. Er ist ausserdem das, was jemand ohne JavaScript
            ohnehin bekommt.
          */}
          <a
            href={`/api/land?code=DE&zurueck=${encodeURIComponent(pfad)}`}
            className="underline underline-offset-[3px]"
            style={{ color: "var(--ed-violet-text)" }}
          >
            Ich bin in Deutschland
          </a>
        </p>
      </div>
    </div>
  );
}

/**
 * Der Schalter für den Fuss.
 *
 * Er steht auch dann da, wenn oben kein Hinweis erscheint — sonst gäbe
 * es für jemanden in Deutschland, der die Seite für die Schweiz
 * ansehen will, keinen Weg. Und für jemanden, dessen Wahl falsch
 * gespeichert ist, auch keinen zurück.
 */
export function Laenderschalter({ lage, pfad = "/" }: { lage: Landeslage; pfad?: string }) {
  const laender = ["DE", "AT", "CH"];

  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs" style={{ color: "var(--ed-ink-3)" }}>
      <span>Angezeigt für {landesname(lage.code)}.</span>
      <span className="flex flex-wrap gap-x-3">
        {laender
          .filter((c) => c !== lage.code)
          .map((c) => (
            <a
              key={c}
              href={`/api/land?code=${c}&zurueck=${encodeURIComponent(pfad)}`}
              className="underline underline-offset-[3px] transition-colors hover:text-[var(--ed-ink)]"
            >
              {landesname(c)}
            </a>
          ))}
      </span>
    </p>
  );
}
