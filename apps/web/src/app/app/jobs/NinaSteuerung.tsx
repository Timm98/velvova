"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  aktionPruefen,
  darfOhneRueckfrage,
  type Aktion,
  type Aktionsname,
} from "@/lib/nina/steuerung/aktionen";
import {
  ANFANG,
  kannZurueck,
  naechster,
  sichtbar,
  type Ereignis,
  type Panelzustand,
} from "@/lib/nina/steuerung/panelzustand";
import { toggleSaveJob, startApplication } from "@/lib/jobActions";
import {
  auftragAendernVorschlagen,
  auftragHeuteAussetzen,
  auftragPause,
  einzigerAuftrag,
  mailsAusschalten,
  suchauftragAusText,
} from "@/lib/suchauftrag/aktionen";

/**
 * Die eine Stelle, durch die jede Steuerung der Job-Seite geht.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum ein Kontext und nicht Zustand in der Seite
 * ══════════════════════════════════════════════════════════════
 *
 * Drei Wege führen zu denselben Handlungen:
 *
 *   Ein Knopf im Panel      → „Gehalt prüfen"
 *   Eine Frage im Chat      → „Ist das Gehalt gut?"
 *   Ein Satz über Sprache   → „Was verdient man da?"
 *
 * Alle drei rufen `ausfuehren` mit derselben Aktion auf. Was danach
 * passiert, steht genau einmal hier — und in `panelzustand.ts`, das
 * die Übergänge rein und prüfbar hält.
 *
 * Hinge die Logik an den Knöpfen, gäbe es sie für Chat und Sprache
 * nicht, und der übliche Ausweg wäre, sie dort noch einmal zu
 * schreiben. Drei Fassungen laufen auseinander, sobald eine geändert
 * wird.
 *
 * ══════════════════════════════════════════════════════════════
 * Was hier NICHT passiert
 * ══════════════════════════════════════════════════════════════
 *
 * Serveraktionen laufen nicht von selbst durch, nur weil Monday sie
 * vorschlägt. `darfOhneRueckfrage` trennt: Eine Ansicht öffnen ist
 * gefahrlos, eine Bewerbung anlegen ist es nicht. Kommt eine
 * Serveraktion aus dem Modell, landet sie als Vorschlag in
 * `offeneBitte` — bestätigt wird sie von einem Menschen.
 */

type Steuerung = {
  zustand: Panelzustand;
  ansicht: ReturnType<typeof sichtbar>;
  zurueckMoeglich: boolean;
  /** Eine Aktion ausführen. `vonNina` entscheidet über die Rückfrage. */
  ausfuehren: (name: string, args?: unknown, vonNina?: boolean) => void;
  zurueck: () => void;
  /** Eine Serveraktion, auf die Monday wartet. */
  offeneBitte: Aktion | null;
  bitteBestaetigen: () => void;
  bitteVerwerfen: () => void;
};

const Kontext = createContext<Steuerung | null>(null);

type Innen = { panel: Panelzustand; bitte: Aktion | null };

function reduzieren(s: Innen, e: Ereignis | { art: "bitte"; aktion: Aktion } | { art: "bitte_weg" }): Innen {
  if (e.art === "bitte") return { ...s, bitte: e.aktion };
  if (e.art === "bitte_weg") return { ...s, bitte: null };
  return { ...s, panel: naechster(s.panel, e) };
}

export function NinaSteuerungProvider({
  jobId,
  children,
}: {
  jobId: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pfad = usePathname();
  const params = useSearchParams();
  const [s, senden] = useReducer(reduzieren, { panel: { ...ANFANG, jobId }, bitte: null });

  /*
   * Die Auswahl links ist die Wahrheit über die aktuelle Stelle.
   *
   * Sie steht in der Adresse, damit ein geteilter Link funktioniert.
   * Ändert sie sich — durch Klick oder durch Monday —, muss das Panel
   * folgen, sonst zeigt es die Analyse der vorigen Stelle.
   */
  useEffect(() => {
    senden({ art: "stelle_gewechselt", jobId });
  }, [jobId]);

  /* Eine Hervorhebung ist ein Hinweis, kein Zustand. Nach vier
     Sekunden hat sie ihren Zweck erfüllt; bliebe sie, würde sie zur
     dauerhaften Einfärbung eines beliebigen Abschnitts. */
  useEffect(() => {
    if (!s.panel.hervorgehoben) return;
    const t = setTimeout(() => senden({ art: "hervorhebung_aus" }), 4000);
    return () => clearTimeout(t);
  }, [s.panel.hervorgehoben]);

  const serverAusfuehren = useCallback(
    async (aktion: Aktion) => {
      if (aktion.name === "save_job" || aktion.name === "unsave_job") {
        await toggleSaveJob(aktion.args.jobId);
        router.refresh();
        return;
      }
      if (aktion.name === "prepare_application") {
        const id = await startApplication(aktion.args.jobId);
        router.push(`/app/applications/${id}`);
        return;
      }

      /*
       * Die Aktionen am Suchauftrag laufen über dieselbe Schicht wie
       * die Karte unter „Suchaufträge".
       *
       * Nicht aus Sparsamkeit: Die Karte prüft vor dem Aktivieren, ob
       * eine Adresse bestätigt ist. Eine zweite Fassung für den
       * Sprachweg hätte diese Prüfung beim nächsten Umbau irgendwann
       * nicht mehr — und niemand merkt es, weil beide Wege etwas tun.
       */
      if (aktion.name === "mails_pausieren") {
        await mailsAusschalten();
        router.refresh();
        return;
      }
      if (aktion.name === "suchauftrag_pausieren" || aktion.name === "suchauftrag_aussetzen") {
        const ziel = aktion.args.auftragId ?? (await einzigerAuftrag());
        const id = typeof ziel === "string" ? ziel : ziel.ok ? ziel.id : null;
        /* Bei mehreren Aufträgen wird nicht geraten. Monday fragt nach —
           den Grund bekommt sie über den Rückgabeweg des Chats. */
        if (id === null) return;
        if (aktion.name === "suchauftrag_pausieren") await auftragPause(id);
        else await auftragHeuteAussetzen(id);
        router.refresh();
        return;
      }
      if (aktion.name === "suchauftrag_anlegen") {
        /*
         * Der Satz geht im Wortlaut weiter, nicht als Stichwortliste.
         *
         * Er ist der Beleg, auf den sich jedes entstandene Kriterium
         * später beruft — und die Antwort auf „woher weisst du das".
         */
        const r = await suchauftragAusText(aktion.args.aussage, "chat");
        if (r.ok) router.push("/app/suchauftraege");
        return;
      }
      if (aktion.name === "suchauftrag_aendern") {
        await auftragAendernVorschlagen({
          auftragId: aktion.args.auftragId ?? null,
          kriterium: aktion.args.kriterium,
          wert: aktion.args.wert,
          staerke: aktion.args.staerke,
          /* Der Satz der Person ist der Beleg. Ohne ihn liesse sich
             später nicht zeigen, worauf sich die Änderung stützt. */
          aussage: `${aktion.args.kriterium}: ${String(aktion.args.wert)}`,
          quelle: "chat",
        });
        router.push("/app/suchauftraege");
      }
    },
    [router],
  );

  const ausfuehren = useCallback(
    (name: string, args?: unknown, vonNina = false) => {
      const p = aktionPruefen(name, args);
      if (!p.ok) {
        /* Ein abgelehnter Vorschlag ist kein Absturz. Er wird
           verworfen; Monday bekommt den Grund über den Rückgabeweg des
           Chats, nicht über eine Ausnahme hier. */
        console.warn("[nina] Aktion abgelehnt:", p.grund);
        return;
      }
      const aktion = p.aktion;

      if (aktion.name === "suchauftrag_zeigen") {
        router.push("/app/suchauftraege");
        return;
      }

      if (!darfOhneRueckfrage(aktion.name as Aktionsname)) {
        if (vonNina) {
          senden({ art: "bitte", aktion });
          return;
        }
        void serverAusfuehren(aktion);
        return;
      }

      /*
       * `open_job` und `filter_jobs` ändern die Adresse.
       *
       * Sie sind Oberflächenaktionen, wirken aber ausserhalb des
       * Panels — in der Liste links und in der Mitte. Beides hängt an
       * Suchparametern, damit ein geteilter Link dorthin führt, wo der
       * Absender war.
       */
      if (aktion.name === "open_job") {
        const n = new URLSearchParams(params.toString());
        n.set("job", aktion.args.jobId);
        router.push(`${pfad}?${n}`, { scroll: false });
      }
      if (aktion.name === "filter_jobs") {
        const n = new URLSearchParams(params.toString());
        if (aktion.args.suche) n.set("q", aktion.args.suche);
        else n.delete("q");
        if (aktion.args.sortierung) n.set("sort", aktion.args.sortierung);
        /* Die Anzahl fällt zurück auf den Anfang: Eine neue Suche mit
           der Seitentiefe der alten anzuzeigen wäre eine Liste, deren
           Länge nichts mit ihr zu tun hat. */
        n.delete("anzahl");
        router.push(`${pfad}?${n}`, { scroll: false });
      }

      senden({ art: "aktion", aktion });
    },
    [params, pfad, router, serverAusfuehren],
  );

  const wert = useMemo<Steuerung>(
    () => ({
      zustand: s.panel,
      ansicht: sichtbar(s.panel),
      zurueckMoeglich: kannZurueck(s.panel),
      ausfuehren,
      zurueck: () => senden({ art: "zurueck" }),
      offeneBitte: s.bitte,
      bitteBestaetigen: () => {
        if (s.bitte) void serverAusfuehren(s.bitte);
        senden({ art: "bitte_weg" });
      },
      bitteVerwerfen: () => senden({ art: "bitte_weg" }),
    }),
    [s.panel, s.bitte, ausfuehren, serverAusfuehren],
  );

  return <Kontext.Provider value={wert}>{children}</Kontext.Provider>;
}

/**
 * Zugriff auf die Steuerung.
 *
 * Wirft ausserhalb des Providers, statt einen Ersatzwert zu liefern:
 * Ein Knopf, der stillschweigend nichts tut, ist schlechter als einer,
 * der beim ersten Rendern auffällt.
 */
export function useNinaSteuerung(): Steuerung {
  const k = useContext(Kontext);
  if (!k) throw new Error("useNinaSteuerung ausserhalb von NinaSteuerungProvider");
  return k;
}
