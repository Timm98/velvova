/**
 * Fünf Fragen, aufklappbar — ohne eine Zeile JavaScript.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum `<details>` und kein eigenes Accordion
 * ══════════════════════════════════════════════════════════════
 *
 * Ein selbstgebautes Accordion braucht Zustand, `aria-expanded`,
 * `aria-controls`, Tastaturbedienung und einen Fokusring — und jede
 * dieser vier Stellen ist eine, an der es später falsch wird.
 *
 * `<details>`/`<summary>` bringt alles davon mit: Enter und Leertaste
 * funktionieren, der Zustand ist für Vorleseprogramme korrekt
 * ausgezeichnet, und er stimmt immer mit dem überein, was man sieht.
 * Das Pluszeichen dreht sich per CSS zum Minus — die Anzeige kann gar
 * nicht vom Zustand abweichen, weil sie derselbe Zustand ist.
 *
 * ══════════════════════════════════════════════════════════════
 * Was in den Antworten NICHT steht
 * ══════════════════════════════════════════════════════════════
 *
 * Keine Preise: Es gibt keine freigegebenen Tarife. Die Frage danach
 * bleibt trotzdem stehen, weil sie gestellt wird — sie wird nur
 * ehrlich beantwortet.
 *
 * Keine Partnerschaften, keine Verfügbarkeitszusagen, keine
 * Datenschutzversprechen über das hinaus, was die Anwendung heute
 * tatsächlich tut.
 */
const FRAGEN: { frage: string; antwort: string }[] = [
  {
    frage: "Was macht {NAME} für mich?",
    antwort:
      "{NAME} liest Stellenanzeigen und ordnet sie ein: was darin steht, was fehlt und was zu deinen " +
      "Angaben passt. Aus deinen Sätzen entstehen Suchkriterien, die du jederzeit ändern kannst. " +
      "Entscheiden tust du.",
  },
  {
    frage: "Was unterscheidet Velvova von einer klassischen Jobbörse?",
    antwort:
      "Eine Jobbörse zeigt Treffer. Velvova zeigt zusätzlich, worauf sich ein Treffer stützt — welche " +
      "Angabe aus der Anzeige stammt, welche offen ist und wo etwas deinen Bedingungen widerspricht. " +
      "Fehlende Angaben werden benannt, nicht überspielt.",
  },
  {
    frage: "Brauche ich ein Konto?",
    antwort:
      "Zum Anmelden genügt Google oder eine E-Mail-Adresse. Ohne Konto lassen sich Stellen ansehen, " +
      "aber nichts speichern und nichts fortsetzen — deine Angaben und dein Suchstand hängen am Konto.",
  },
  {
    frage: "Was kostet Velvova?",
    antwort:
      "Es gibt derzeit keine veröffentlichten Tarife. Sobald Preise feststehen, stehen sie hier und auf " +
      "der Preisseite. Bis dahin geben wir keine Zusage über künftige Kosten ab.",
  },
  {
    frage: "Wie kann ich Velvova als Unternehmen nutzen?",
    antwort:
      "Über \u201eUnternehmen registrieren\u201c legst du einen Arbeitgeberzugang an. Er ist von persönlichen " +
      "Konten getrennt: Ein Unternehmenszugang sieht keine privaten Suchdaten, und ein persönliches " +
      "Konto wird nicht stillschweigend zu einem Arbeitgeberkonto.",
  },
];

/** Ersetzt `{NAME}` durch den konfigurierten Assistentennamen. */
function fragenFuer(name: string) {
  return FRAGEN.map((f) => ({
    frage: f.frage.replaceAll("{NAME}", name),
    antwort: f.antwort.replaceAll("{NAME}", name),
  }));
}

export function HaeufigeFragen({ assistentName }: { assistentName: string }) {
  return (
    <section className="mx-auto w-full max-w-[720px] px-5 py-20 md:px-8 md:py-28">
      <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] font-normal leading-tight tracking-[-0.02em]">
        Häufige Fragen
      </h2>

      <div className="mt-8 border-t border-line">
        {fragenFuer(assistentName).map(({ frage, antwort }) => (
          <details key={frage} className="group border-b border-line">
            <summary
              /*
               * `list-none` und der WebKit-Zusatz nehmen das voreingestellte
               * Dreieck weg. Ohne beides steht neben unserem Zeichen noch
               * das des Browsers — in Safari ein zweites Symbol, in Firefox
               * ein drittes.
               */
              className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-[17px] font-medium text-ink outline-none [&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {frage}
              {/*
                Ein Kreuz, das sich zum Minus dreht.

                Zwei Striche übereinander: Der senkrechte verschwindet
                beim Öffnen. Kein Symbolwechsel, keine zweite Grafik —
                und damit keine Möglichkeit, dass Zeichen und Zustand
                auseinanderlaufen.
              */}
              <span aria-hidden className="relative size-4 shrink-0">
                <span className="absolute left-0 top-1/2 h-px w-4 -translate-y-1/2 bg-ink-3" />
                <span className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 bg-ink-3 transition-transform duration-200 group-open:scale-y-0" />
              </span>
            </summary>
            <p className="pb-6 pr-10 text-[15px] leading-relaxed text-ink-2">{antwort}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
