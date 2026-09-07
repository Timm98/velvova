"use client";

import { ArrowLeft, ArrowUpRight, Bookmark, FileText } from "lucide-react";
import { useNinaSteuerung } from "../NinaSteuerung";
import type { WorkspaceDaten } from "./daten";
import { cn } from "@/lib/cn";

/**
 * Die rechte Seite: erst Fakten, Deutung auf Nachfrage.
 *
 * ══════════════════════════════════════════════════════════════
 * Das Prinzip, das diese Datei umsetzt
 * ══════════════════════════════════════════════════════════════
 *
 * Vorher stand hier ein Analysebericht: Warum Monday die Stelle zeigt,
 * Bedingungen, Analyse, dafür, dagegen, offen, Passung, Sicherheit,
 * Arbeitsalltag, Anforderungen, Arbeitsweg — alles gleichzeitig,
 * untereinander, ungefragt.
 *
 * Das Ergebnis war ein Text, den niemand liest, weil er alles
 * beantwortet ausser der Frage, die man gerade hat.
 *
 * Jetzt gilt: Was in der Anzeige steht, steht sofort da. Was daraus
 * folgt, sagt Monday, wenn man fragt. Der Unterschied ist nicht die
 * Menge an Information, sondern wer den Zeitpunkt bestimmt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Ansichten den Inhalt ERSETZEN
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Antwort unten anzuhängen erzeugt genau den Bericht wieder, nur
 * langsamer. Nach drei Fragen steht dieselbe Textwand da, und die
 * Stelle selbst ist drei Bildschirme weiter oben.
 *
 * Deshalb tauscht der Arbeitsbereich seinen Inhalt aus und trägt einen
 * Zurück-Weg. Die Liste links bleibt dabei stehen.
 */
export function JobWorkspace({ daten }: { daten: WorkspaceDaten }) {
  const { ansicht, zurueck, zurueckMoeglich } = useNinaSteuerung();

  if (ansicht === "uebersicht") return <Uebersicht daten={daten} />;

  return (
    <div className="grid gap-5 p-4 lg:p-6">
      {zurueckMoeglich && (
        <button
          type="button"
          onClick={zurueck}
          className="inline-flex min-h-7 w-fit items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink"
        >
          <ArrowLeft aria-hidden className="size-3.5" strokeWidth={1.9} />
          Zurück zur Stelle
        </button>
      )}

      {/*
        `key` an der Ansicht: Ohne ihn läuft der Übergang nur beim
        ersten Mal, weil React denselben Knoten weiterverwendet.
      */}
      <div key={ansicht} className="motion-safe:animate-[fade-up_140ms_ease-out]">
        <Ansichtsinhalt daten={daten} />
      </div>

    </div>
  );
}

/* ── Übersicht: nur Fakten ──────────────────────────────────── */

function Uebersicht({ daten }: { daten: WorkspaceDaten }) {
  const { ausfuehren } = useNinaSteuerung();
  /* Muss, Wunsch und Unklar in einer Liste: Die Trennung ist eine
     Deutung und gehört in die Ansicht „Was du dafür brauchst". Im
     Wortlaut der Anzeige stehen sie nebeneinander. */
  const alleAnforderungen = [
    ...daten.anforderungen.muss,
    ...daten.anforderungen.wunsch,
    ...daten.anforderungen.unklar,
  ];

  return (
    <div className="grid gap-7 p-4 lg:p-6">
      <header className="grid gap-3">
        <div className="grid gap-1">
          <h2 className="text-2xl font-semibold leading-tight text-titel">{daten.titel}</h2>
          <p className="text-[15px] text-ink-2">{daten.unternehmen}</p>
        </div>

        {/*
          Die Eckdaten als Reihe, nicht als Kästchen.

          Ort, Arbeitsmodell, Vertragsart und Datum sind vier kurze
          Angaben. Vier berandete Kacheln daraus zu machen gäbe ihnen
          ein Gewicht, das sie nicht haben — und die Ruhe, die diese
          Seite braucht, entsteht gerade dadurch, dass Nebensachen wie
          Nebensachen aussehen.
        */}
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-ink-2">
          {daten.eckdaten.map((e, i) => (
            <span key={e.wert ?? e.feld} className="flex items-center gap-2.5">
              {i > 0 && <span aria-hidden className="text-ink-3">·</span>}
              {e.wert ?? <span className="text-ink-3">{e.feld} nicht angegeben</span>}
            </span>
          ))}
        </p>
      </header>

      <section className="grid gap-1.5">
        <h3 className="abschnitts-titel text-ink-3">Gehalt</h3>
        {daten.gehalt.anzeige ? (
          <p className="w-fit rounded-(--radius-md) border border-positive/60 bg-positive-soft px-3 py-1.5 font-mono text-lg tabular text-ink">
            {daten.gehalt.anzeige}
          </p>
        ) : (
          /* Keine Fläche und keine Farbe für eine fehlende Angabe.
             Der grüne Kasten heisst „jemand hat sich festgelegt" — bei
             einer Lücke wäre das eine Behauptung über den Arbeitgeber. */
          <p className="text-[15px] text-ink-3">Nicht angegeben</p>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => ausfuehren("prepare_application", { jobId: daten.jobId })}
          className="inline-flex min-h-10 items-center gap-2 rounded-(--radius-pill) bg-accent px-4 text-sm font-medium text-accent-on transition-opacity hover:opacity-90"
        >
          <FileText aria-hidden className="size-4" strokeWidth={1.9} />
          Bewerbung vorbereiten
        </button>

        <button
          type="button"
          onClick={() =>
            ausfuehren(daten.gemerkt ? "unsave_job" : "save_job", { jobId: daten.jobId })
          }
          aria-pressed={daten.gemerkt}
          className="inline-flex min-h-10 items-center gap-2 rounded-(--radius-pill) border border-line-2 px-4 text-sm transition-colors hover:border-line"
        >
          <Bookmark
            aria-hidden
            className={cn("size-4", daten.gemerkt && "text-accent")}
            strokeWidth={1.9}
            fill={daten.gemerkt ? "currentColor" : "none"}
          />
          {daten.gemerkt ? "Gemerkt" : "Speichern"}
        </button>

        {daten.originalUrl && (
          <a
            href={daten.originalUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex min-h-10 items-center gap-2 rounded-(--radius-pill) border border-line-2 px-4 text-sm transition-colors hover:border-line"
          >
            <ArrowUpRight aria-hidden className="size-4" strokeWidth={1.9} />
            Originalanzeige
          </a>
        )}
      </div>

      {/* ── Monday ─────────────────────────────────────────────── */}
      {/*
        Hier standen Vorschlagsknöpfe: „Passt der Job zu mir?",
        „Gehalt prüfen", „Unternehmen ansehen" und weitere.
        
        Sie sind weg. Eine Reihe von Fragen unter einer Stellenanzeige
        beantwortet keine davon — sie stellt sie nur, und zwar ungefragt.
        Wer eine Anzeige liest, hat seine eigene Frage im Kopf; ihm
        sechs vorzulegen heisst, ihn von ihr abzulenken.
        
        Die Ansichten selbst bleiben erreichbar: über Monday in der Blase
        unten rechts. Der Weg dorthin läuft über dieselben Aktionen,
        die die Knöpfe ausgelöst haben — es fehlt nur die Aufforderung.
      */}

      {/*
        Die vollständige Anzeige steht da, nicht hinter einem Link.
        
        Sie war einen Klick entfernt — mit der Begründung, die Seite
        ruhig zu halten. Das war eine Bevormundung: Wer eine Stelle
        öffnet, will die Stelle lesen, und die Deutung an die Stelle
        des Textes zu setzen macht sie unüberprüfbar.
        
        Aufgaben und Anforderungen stehen dabei getrennt vom
        Fliesstext, weil die meisten Anzeigen sie als Aufzählung
        führen und ein Block daraus eine Textwand macht.
      */}
      <section aria-label="Die Anzeige im Wortlaut" className="grid gap-6 border-t border-line-2 pt-6">
        {daten.aufgaben.length > 0 && (
          <div className="grid gap-2">
            <h3 className="abschnitts-titel text-ink-3">Aufgaben</h3>
            <ul className="grid gap-1.5">
              {daten.aufgaben.map((a, i) => (
                <li key={i} className="text-[15px] leading-relaxed text-ink-2">
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}

        {alleAnforderungen.length > 0 && (
          <div className="grid gap-2">
            <h3 className="abschnitts-titel text-ink-3">
              Anforderungen
            </h3>
            <ul className="grid gap-1.5">
              {alleAnforderungen.map((a, i) => (
                <li key={i} className="text-[15px] leading-relaxed text-ink-2">
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}

        {daten.beschreibung ? (
          <div className="grid gap-2">
            <h3 className="abschnitts-titel text-ink-3">
              Stellenbeschreibung
            </h3>
            {/* `whitespace-pre-line`: Die Absätze der Anzeige bleiben
                erhalten. Sie zu glätten machte aus einer Aufzählung
                einen Block. */}
            <p className="max-w-[var(--measure)] whitespace-pre-line text-[15px] leading-relaxed text-ink-2">
              {daten.beschreibung}
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink-3">
            Die Quelle liefert zu dieser Stelle keinen Anzeigentext.
          </p>
        )}
      </section>
    </div>
  );
}

/* ── Die Ansichten ──────────────────────────────────────────── */

function Ansichtsinhalt({ daten }: { daten: WorkspaceDaten }) {
  const { ansicht } = useNinaSteuerung();

  switch (ansicht) {
    case "passung":
      return <Passung daten={daten} />;
    case "dafuer":
      return (
        <Befundliste
          titel="Das spricht dafür"
          punkte={daten.dafuer}
          leer="Mir ist nichts aufgefallen, was ausdrücklich dafür spricht."
        />
      );
    case "dagegen":
      return <Dagegen daten={daten} />;
    case "gehalt":
      return <Gehalt daten={daten} />;
    case "anforderungen":
      return <Anforderungen daten={daten} />;
    case "arbeitsalltag":
      return <Arbeitsalltag daten={daten} />;
    case "unternehmen":
      return <Unternehmen daten={daten} />;
    case "beschreibung":
      return <Beschreibung daten={daten} />;
    default:
      return (
        <Text>
          Diese Ansicht baue ich gerade. Frag mich unten, dann antworte ich dir direkt.
        </Text>
      );
  }
}

function Passung({ daten }: { daten: WorkspaceDaten }) {
  return (
    <div className="grid gap-5">
      <Titel>Passt die Stelle zu dir?</Titel>

      {daten.passung === null ? (
        /*
         * Keine erfundene Zahl.
         *
         * Der Wert bleibt leer, solange die Grundlage zu dünn ist —
         * `computeFit` entscheidet das über die Deckung, nicht diese
         * Anzeige. Eine Zahl hinzuschreiben wäre die gefährlichste
         * Art zu lügen: präzise, plausibel und unüberprüfbar.
         */
        <p className="font-mono text-xl text-ink-2">Passung noch offen</p>
      ) : (
        <p className="font-mono text-4xl font-semibold leading-none tabular">{daten.passung} %</p>
      )}

      <Text>{daten.einschaetzung}</Text>

      <ul className="grid gap-3">
        {daten.kriterien.map((k) => (
          <li key={k.key} className="grid gap-0.5">
            <div className="flex items-baseline gap-2">
              <span aria-hidden className={cn("font-mono", k.stand === "passt" ? "text-positive" : "text-ink-3")}>
                {k.stand === "passt" ? "✓" : "?"}
              </span>
              <span className="text-sm font-medium">{k.label}</span>
            </div>
            <p className="pl-5 text-sm leading-relaxed text-ink-2">{k.satz}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Dagegen({ daten }: { daten: WorkspaceDaten }) {
  return (
    <div className="grid gap-6">
      <Befundliste
        titel="Darauf solltest du achten"
        punkte={daten.dagegen}
        leer="Mir ist nichts aufgefallen, was ausdrücklich dagegen spricht."
      />

      {daten.offen.length > 0 && (
        <div className="grid gap-2">
          <Titel klein>{daten.assistentin} würde noch klären</Titel>
          <ul className="grid gap-1.5">
            {daten.offen.slice(0, 4).map((o) => (
              <li key={o.key} className="text-sm leading-relaxed text-ink-2">
                {o.satz}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Gehalt({ daten }: { daten: WorkspaceDaten }) {
  const { anzeige, wunsch, markt, hinweis } = daten.gehalt;
  return (
    <div className="grid gap-5">
      <Titel>Gehalt</Titel>
      <dl className="grid gap-4">
        <Wert begriff="In der Anzeige" wert={anzeige} />
        <Wert begriff="Dein Wunsch" wert={wunsch} />
        <Wert begriff="Vergleichbare Stellen" wert={markt} />
      </dl>
      <Text>
        {hinweis ??
          "Für einen zuverlässigen Marktvergleich fehlen mir zu dieser Tätigkeit genügend Daten."}
      </Text>
    </div>
  );
}

function Anforderungen({ daten }: { daten: WorkspaceDaten }) {
  const gruppen = [
    { titel: "Erforderlich", punkte: daten.anforderungen.muss },
    { titel: "Wünschenswert", punkte: daten.anforderungen.wunsch },
    { titel: "Unklar", punkte: daten.anforderungen.unklar },
  ].filter((g) => g.punkte.length > 0);

  return (
    <div className="grid gap-5">
      <Titel>Was du dafür brauchst</Titel>
      {gruppen.length === 0 ? (
        <Text>Die Anzeige nennt keine Anforderungen, die sich eindeutig zuordnen lassen.</Text>
      ) : (
        gruppen.map((g) => (
          <div key={g.titel} className="grid gap-1.5">
            <Titel klein>{g.titel}</Titel>
            <ul className="grid gap-1">
              {g.punkte.map((p, i) => (
                <li key={`${g.titel}-${i}`} className="text-sm leading-relaxed text-ink-2">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

function Arbeitsalltag({ daten }: { daten: WorkspaceDaten }) {
  return (
    <div className="grid gap-5">
      <Titel>Dein möglicher Arbeitsalltag</Titel>
      {daten.aufgaben.length === 0 ? (
        <Text>Die Anzeige beschreibt den Arbeitsalltag leider nicht konkret.</Text>
      ) : (
        <ul className="grid gap-1.5">
          {daten.aufgaben.map((a, i) => (
            <li key={i} className="text-sm leading-relaxed text-ink-2">
              {a}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Unternehmen({ daten }: { daten: WorkspaceDaten }) {
  const bekannt = daten.unternehmensdaten.filter((d) => d.wert !== null);
  return (
    <div className="grid gap-5">
      <Titel>{daten.unternehmen}</Titel>
      {bekannt.length === 0 ? (
        <Text>
          Zu diesem Unternehmen liegen mir nur die Angaben aus der Stellenanzeige vor. Ich erfinde
          dazu nichts.
        </Text>
      ) : (
        <dl className="grid gap-4">
          {daten.unternehmensdaten.map((d) => (
            <Wert key={d.feld} begriff={d.feld} wert={d.wert} />
          ))}
        </dl>
      )}
    </div>
  );
}

function Beschreibung({ daten }: { daten: WorkspaceDaten }) {
  return (
    <div className="grid gap-4">
      <Titel>Die Anzeige im Wortlaut</Titel>
      {daten.beschreibung ? (
        /* `whitespace-pre-line`: Die Absätze der Anzeige bleiben
           erhalten. Sie zu glätten machte aus einer Aufzählung einen
           Block, und die meisten Anzeigen bestehen aus Aufzählungen. */
        <p className="max-w-[var(--measure)] whitespace-pre-line text-sm leading-relaxed text-ink-2">
          {daten.beschreibung}
        </p>
      ) : (
        <Text>Die Quelle liefert zu dieser Stelle keinen Anzeigentext.</Text>
      )}
    </div>
  );
}

/* ── Bausteine ──────────────────────────────────────────────── */

function Titel({ children, klein = false }: { children: React.ReactNode; klein?: boolean }) {
  return klein ? (
    <h4 className="abschnitts-titel text-ink-3">{children}</h4>
  ) : (
    <h3 className="text-lg font-semibold leading-snug">{children}</h3>
  );
}

function Text({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">{children}</p>
  );
}

function Wert({ begriff, wert }: { begriff: string; wert: string | null }) {
  return (
    <div className="grid gap-0.5">
      <dt className="abschnitts-titel text-ink-3">{begriff}</dt>
      <dd className="text-[15px]">
        {wert ?? <span className="text-ink-3">Nicht angegeben</span>}
      </dd>
    </div>
  );
}

function Befundliste({
  titel,
  punkte,
  leer,
}: {
  titel: string;
  punkte: { key: string; satz: string }[];
  leer: string;
}) {
  return (
    <div className="grid gap-3">
      <Titel>{titel}</Titel>
      {punkte.length === 0 ? (
        <Text>{leer}</Text>
      ) : (
        <ul className="grid gap-2.5">
          {/* Höchstens vier. Eine Liste mit acht Punkten wird
              überflogen, eine mit vieren gelesen. */}
          {punkte.slice(0, 4).map((p) => (
            <li key={p.key} className="text-sm leading-relaxed text-ink-2">
              {p.satz}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
