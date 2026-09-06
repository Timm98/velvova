"use client";

import { useState, useTransition } from "react";
import { Check, HelpCircle, Sparkles, Undo2, X } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import {
  automatikAbschalten,
  handlungEntscheiden,
  type Automatikeintrag,
  type Handlungsergebnis,
} from "@/lib/proaktiv/aktionen";

/**
 * Was Nina von selbst getan hat — und wie man es rückgängig macht.
 *
 * ══════════════════════════════════════════════════════════════
 * Drei Fragen, die jeder Eintrag beantworten muss
 * ══════════════════════════════════════════════════════════════
 *
 *   Was hat sie getan?          die Beschreibung
 *   Warum?                      die Beobachtung, mit Belegen
 *   Wie nehme ich es zurück?    ein Knopf, nicht zwei Menüs tief
 *
 * Eine automatische Handlung ohne diese drei ist keine Hilfe, sondern
 * etwas, das mit den eigenen Daten passiert. Der Unterschied liegt
 * nicht darin, ob jemand widerspricht — sondern ob er könnte.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum „Von Nina vorgemerkt“ und nicht „Gespeichert“
 * ══════════════════════════════════════════════════════════════
 *
 * „Gespeichert“ heisst in Velvova: Ich will diese Stelle bewusst
 * behalten. Das ist eine Aussage der Person über sich selbst, und
 * Nina kann sie nicht an ihrer Stelle treffen. Sie hat Interesse
 * vermutet — mehr steht hier nicht.
 */
export function VonNinaAutomatisch({ eintraege }: { eintraege: Automatikeintrag[] }) {
  if (eintraege.length === 0) {
    return (
      <Card>
        <div className="grid gap-1.5">
          <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Sparkles aria-hidden className="size-4 text-ink-3" />
            Von Nina automatisch
          </h3>
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Nina hat noch nichts von selbst gemacht. Sobald du dir Stellen mehrfach ansiehst,
            merkt sie sie für dich vor und schreibt hier hin, warum.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="grid gap-4">
        <div className="grid gap-1">
          <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Sparkles aria-hidden className="size-4 text-ink-3" />
            Von Nina automatisch
          </h3>
          <p className="text-sm text-ink-2">
            {eintraege.length === 1
              ? "Eine Sache, die Nina für dich gemacht hat."
              : `${eintraege.length} Sachen, die Nina für dich gemacht hat.`}{" "}
            Du kannst jede davon zurücknehmen.
          </p>
        </div>

        <ul className="grid gap-3">
          {eintraege.map((e) => (
            <li key={e.id}>
              <Eintrag eintrag={e} />
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function Eintrag({ eintrag }: { eintrag: Automatikeintrag }) {
  const [laeuft, starten] = useTransition();
  const [erledigt, setErledigt] = useState<"behalten" | "verworfen" | null>(null);
  const [warumOffen, setWarumOffen] = useState(false);
  const [abgeschaltet, setAbgeschaltet] = useState(false);

  function entscheiden(antwort: "behalten" | "verworfen") {
    starten(async () => {
      await handlungEntscheiden(eintrag.id, antwort);
      setErledigt(antwort);
    });
  }

  function nichtMehr() {
    starten(async () => {
      await automatikAbschalten(eintrag.handlung, false);
      setAbgeschaltet(true);
    });
  }

  if (erledigt) {
    return (
      <div className="rounded-lg border border-line-2 px-3 py-2.5 text-sm text-ink-2">
        {erledigt === "behalten" ? "Behalten." : "Zurückgenommen."}
        {abgeschaltet ? " Nina macht das nicht mehr automatisch." : null}
      </div>
    );
  }

  return (
    <div className="grid gap-2 rounded-lg border border-line-2 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={eintrag.brauchtZustimmung ? "caution" : "assistant"}>
          {eintrag.brauchtZustimmung ? "Vorschlag" : "Von Nina vorgemerkt"}
        </Badge>
        <span className="text-sm font-medium text-ink">{eintrag.beschreibung}</span>
      </div>

      {eintrag.jobTitel ? (
        <p className="text-sm text-ink-2">
          {eintrag.jobTitel}
          {eintrag.arbeitgeber ? ` · ${eintrag.arbeitgeber}` : null}
        </p>
      ) : null}

      {eintrag.nachricht ? (
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          {eintrag.nachricht}
        </p>
      ) : null}

      {/*
        Die Begründung steht hinter einem Klick, nicht dauerhaft im Bild.
        Sichtbar wäre sie bei zehn Einträgen zehnmal derselbe Satzbau —
        versteckt wäre sie eine Behauptung ohne Beleg. Ein Klick ist die
        Mitte.
      */}
      {warumOffen ? (
        <p className="max-w-[var(--measure)] rounded-md bg-soft px-3 py-2 text-sm leading-relaxed text-ink-2">
          {eintrag.begruendung}
        </p>
      ) : null}

      {eintrag.ergebnis ? <Ergebnis ergebnis={eintrag.ergebnis} /> : null}

      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <Button size="sm" variant="secondary" disabled={laeuft} onClick={() => entscheiden("behalten")}>
          <Check aria-hidden />
          {eintrag.brauchtZustimmung ? "Ja, mach das" : "Behalten"}
        </Button>
        <Button size="sm" variant="ghost" disabled={laeuft} onClick={() => entscheiden("verworfen")}>
          <X aria-hidden />
          {eintrag.brauchtZustimmung ? "Nein" : "Nicht interessant"}
        </Button>
        <Button
          size="sm"
          variant="link"
          onClick={() => setWarumOffen((o) => !o)}
          aria-expanded={warumOffen}
        >
          <HelpCircle aria-hidden />
          {warumOffen ? "Warum ausblenden" : "Warum?"}
        </Button>
        {eintrag.abschaltbar ? (
          <Button size="sm" variant="link" disabled={laeuft} onClick={nichtMehr}>
            <Undo2 aria-hidden />
            Nicht mehr automatisch
          </Button>
        ) : null}
      </div>
    </div>
  );
}


/**
 * Was die Handlung hervorgebracht hat.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum eine Lücke als Lücke dasteht
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Vergleichstabelle mit leeren Zellen sieht unfertig aus, und
 * die Versuchung ist gross, sie mit einem Strich zu füllen.
 *
 * Aber „diese Anzeige sagt nichts zum Gehalt“ ist beim Vergleich
 * zweier Stellen die wichtigste Auskunft überhaupt — sie ist der
 * Grund, warum man die eine nicht mit der anderen vergleichen kann.
 */
function Ergebnis({ ergebnis }: { ergebnis: Handlungsergebnis }) {
  if ("fragen" in ergebnis) {
    return (
      <div className="grid gap-1.5 rounded-md bg-soft px-3 py-2.5">
        <span className="text-sm font-medium text-ink">Vor einer Bewerbung klären</span>
        <ul className="grid gap-1">
          {ergebnis.fragen.map((f) => (
            <li key={f.schluessel} className="text-sm leading-relaxed text-ink-2">
              {f.frage}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const v = ergebnis.vergleich;
  return (
    <div className="grid gap-2 rounded-md bg-soft px-3 py-2.5">
      <span className="text-sm font-medium text-ink">
        Unterschiede: {v.unterschiede.join(", ")}
      </span>
      {/* Waagerecht scrollbar statt gequetscht — bei drei Spalten auf
          einem Telefon ist das der Unterschied zwischen lesbar und
          nicht. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="py-1 pr-3 text-left font-medium text-ink-3">
                <span className="sr-only">Merkmal</span>
              </th>
              {v.titel.map((t, i) => (
                <th key={v.jobIds[i]} scope="col" className="py-1 pr-3 text-left font-medium text-ink">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {v.zeilen.map((z) => (
              <tr key={z.merkmal} className="border-t border-line-2">
                <th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink-3">
                  {z.merkmal}
                </th>
                {z.werte.map((w, i) => (
                  <td
                    key={v.jobIds[i]}
                    className={w === null ? "py-1.5 pr-3 text-ink-3" : "py-1.5 pr-3 text-ink-2"}
                  >
                    {w ?? "sagt die Anzeige nicht"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
