"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { JobVorschlag } from "./JobSuggestions";
import { useNinaVoice } from "./useNinaVoice";

/**
 * Mondays Zustand für die ganze Anwendung.
 *
 * Der Provider sitzt im Layout der authentifizierten Seiten. Das ist
 * kein Detail, sondern der ganze Punkt: das Layout bleibt beim
 * Seitenwechsel bestehen, die Seite darunter wird ausgetauscht. Also
 * überlebt das Gespräch die Navigation — ohne globalen Speicher, ohne
 * Umweg über die URL, ohne dass irgendetwas synchronisiert werden muss.
 *
 * Wer auf einer Stellenseite fragt „was fehlt mir hier?“ und dann zu den
 * Bewerbungen wechselt, spricht weiter mit derselben Monday über dieselbe
 * Stelle. Der Server weiß es ohnehin — die Gesprächskennung geht bei
 * jeder Anfrage mit, und der Verlauf liegt in der Datenbank. Der
 * Provider sorgt nur dafür, dass die Oberfläche nicht vergisst, was der
 * Server längst weiß.
 */

export interface NinaMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Läuft die Antwort gerade ein? Dann ist sie noch unvollständig. */
  streaming?: boolean;
  tools?: { name: string; label: string; ok?: boolean }[];
}

/** Was die aktuelle Seite über sich sagt. Seiten melden das selbst an. */
export interface NinaScopeValue {
  jobId?: string | null;
  applicationId?: string | null;
  documentId?: string | null;
}

export interface NinaReadiness {
  state: "not_ready" | "exploratory" | "ready";
  score: number;
  missing: string[];
  reason: string;
}

/**
 * Was Monday gerade tut — für das Auge.
 *
 * Ausdrücklich eine ABLEITUNG aus dem, was ohnehin schon bekannt ist,
 * und keine zweite Zustandsmaschine daneben. Zwei Maschinen für
 * denselben Sachverhalt laufen irgendwann auseinander, und dann zeigt
 * die Oberfläche etwas anderes an als das, was passiert.
 */
export type NinaVisualState =
  | "idle"
  | "thinking"
  | "speaking"
  | "listening"
  | "success"
  | "error";

/** Ändert sich nie. Deshalb rendert niemand deswegen neu. */
interface NinaActions {
  setOpen: (open: boolean) => void;
  /**
   * Die Blase kurz hervorheben.
   *
   * Für Knöpfe an anderer Stelle, die zu Monday führen: Sie öffnen die
   * Fläche und lassen gleichzeitig das Sprechsymbol blinken. Ohne das
   * springt die Fläche irgendwo am Rand auf, und wer den Knopf oben
   * gedrückt hat, sucht sie.
   */
  pulsAnstossen: () => void;
  send: (text: string, options?: { fromVoice?: boolean }) => Promise<void>;
  reset: () => void;
  loadConversation: (id: string) => Promise<void>;
  hydrate: (
    conversationId: string | null,
    messages: { id: string; role: "user" | "assistant"; content: string }[],
  ) => void;
  setScope: (scope: NinaScopeValue) => void;
  agreeToSeeJobs: () => void;
  /** Eine Antwort mit Mondays Stimme vorlesen. */
  speak: (messageId: string) => void;
  /** Sofort verstummen: Ton, Anfrage und Warteschlange. */
  stopSpeaking: () => void;
  /** Meldet, dass das Mikrofon zuhört. Aus dem Composer. */
  setListening: (listening: boolean) => void;
}

/** Ändert sich oft — beim Streamen bei jedem Zeichen. */
interface NinaState {
  open: boolean;
  /** Läuft gerade die kurze Hervorhebung? */
  puls: boolean;
  /**
   * Wie oft in dieser Sitzung etwas gesendet wurde.
   *
   * Die Fläche unten rechts zeigt nur, was auf DIESER Seite gefragt
   * wurde. Sie hat sich das bisher selbst gemerkt — und bekam davon
   * nichts mit, wenn eine Frage von woanders kam, etwa aus den
   * Berufsfragen der Stellenanzeige. Die Antwort lief dann, war aber
   * unsichtbar.
   *
   * Der Zähler steht deshalb hier, wo jedes `send` vorbeikommt.
   */
  sendezaehler: number;
  messages: NinaMessage[];
  busy: boolean;
  error: string | null;
  conversationId: string | null;
  scopeLabel: string | null;
  suggestions: string[];
  /** Die serverseitig gültige Stufe. Nie vom Client gesetzt. */
  stage: string | null;
  /** Die menschliche Statuszeile zur Stufe. */
  stageStatus: string | null;
  /** Was der Server über die Jobreife weiß. */
  readiness: NinaReadiness | null;
  /** Jobvorschläge, die Monday in diesem Zug gezeigt hat. Höchstens drei. */
  jobs: JobVorschlag[];
  /** Der aktuelle Fortschritt. `null`, solange der Server nichts geschickt hat. */
  progressGroups: { key: string; label: string; done: boolean }[] | null;
  /**
   * Bietet Monday gerade Stellen an?
   *
   * Kommt aus `recommended_action` und ist die Voraussetzung dafür,
   * dass die Oberfläche einen Zustimmungsknopf zeigt. Ohne diesen
   * Zwischenschritt landen Stellen ungefragt auf dem Bildschirm — und
   * genau das soll nicht passieren.
   */
  offeringJobs: boolean;
  /** Von der Seite gesetzt, damit Monday weiß, worüber gesprochen wird. */
  scope: NinaScopeValue;
  /** Spricht Monday gerade? Welche Nachricht? */
  speakingMessageId: string | null;
  isSpeaking: boolean;
  isListening: boolean;
  /** Nur die Sprachausgabe betreffend. Der Textchat läuft weiter. */
  voiceError: string | null;
  /** Die Ableitung für das Monday-Bild. */
  visualState: NinaVisualState;
}

type NinaContextValue = NinaActions & NinaState;

/**
 * Zwei Kontexte, nicht einer.
 *
 * Der Grund ist das spürbarste Leistungsproblem des Produkts gewesen:
 * bei einem einzigen Kontext rendert JEDER Verbraucher neu, sobald sich
 * irgendetwas ändert — und beim Streamen ändert sich `messages`
 * buchstäblich bei jedem Zeichen. Der Header, die Navigation, die
 * Jobliste, alles unter dem Provider lief also mehrmals pro Sekunde neu
 * durch, nur weil Monday einen Buchstaben geschrieben hat.
 *
 * Deshalb getrennt:
 *
 *   `NinaActionsContext`  Funktionen und `setOpen`. Der Wert ändert
 *                         sich nie — alle Funktionen sind über
 *                         `useCallback` stabil. Wer nur handelt (der
 *                         Header, die Suchleiste, `NinaScope`), rendert
 *                         beim Streamen gar nicht neu.
 *
 *   `NinaStateContext`    Verlauf, Zustand, Reife. Ändert sich oft —
 *                         aber nur der Drawer und die Gesprächsseite
 *                         lesen ihn.
 */
const NinaActionsContext = createContext<NinaActions | null>(null);
const NinaStateContext = createContext<NinaState | null>(null);

function fehlenderProvider(): never {
  throw new Error(
    "useNina außerhalb des NinaProvider. Der Provider gehört ins Layout der " +
      "authentifizierten Seiten — nicht in eine einzelne Seite, sonst geht das " +
      "Gespräch beim Seitenwechsel verloren.",
  );
}

/**
 * Nur die Handlungen.
 *
 * Für alles, was Monday auslöst, ohne ihren Verlauf zu zeigen. Diese
 * Bauteile rendern beim Streamen nicht mit.
 */
export function useNinaActions(): NinaActions {
  return useContext(NinaActionsContext) ?? fehlenderProvider();
}

/**
 * Der Zustand, falls es einen gibt.
 *
 * Für Stellen, an denen Monday AUSSERHALB der Anwendung erscheint — auf
 * der Startseite etwa. Dort gibt es keinen Provider, weil es kein
 * Gespräch gibt, und `useNina()` würde zu Recht werfen.
 *
 * Gibt `null` zurück statt zu werfen. Wer diesen Haken benutzt, muss
 * einen eigenen Zustand mitbringen; wer den Zustand aus dem Gespräch
 * braucht, nimmt weiterhin `useNina()` und bekommt bei fehlendem
 * Provider einen klaren Fehler statt einer stillen Voreinstellung.
 */
export function useNinaFallsVorhanden(): NinaContextValue | null {
  const actions = useContext(NinaActionsContext);
  const state = useContext(NinaStateContext);
  if (!actions || !state) return null;
  return { ...state, ...actions };
}

/** Zustand und Handlungen. Für den Drawer und die Gesprächsseite. */
export function useNina(): NinaContextValue {
  const actions = useContext(NinaActionsContext);
  const state = useContext(NinaStateContext);
  if (!actions || !state) fehlenderProvider();
  return { ...state, ...actions };
}

export function NinaProvider({
  children,
  initialConversationId,
  autoSpeak = false,
}: {
  children: React.ReactNode;
  initialConversationId?: string | null;
  /**
   * Mondays Antworten von selbst vorlesen.
   *
   * Voreinstellung AUS. Ton, der ungefragt losgeht, ist im Büro, im Zug
   * und im Wartezimmer ein Problem — und wer einen Job sucht, sitzt oft
   * an genau solchen Orten. Wer es will, schaltet es in den
   * Einstellungen ein.
   */
  autoSpeak?: boolean;
}) {
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [puls, setPuls] = useState(false);
  const [sendezaehler, setSendezaehler] = useState(0);

  /*
   * Der Puls läuft 2,4 Sekunden und schaltet sich selbst ab.
   *
   * Ein Zustand, den der Auslöser wieder zurücksetzen müsste, bleibt
   * irgendwann hängen — beim Seitenwechsel, bei einem Fehler, bei
   * einem zweiten Klick. Er beendet sich deshalb selbst.
   */
  const pulsAnstossen = useCallback(() => {
    setOpen(true);
    setPuls(true);
  }, []);

  useEffect(() => {
    if (!puls) return;
    const t = setTimeout(() => setPuls(false), 2400);
    return () => clearTimeout(t);
  }, [puls]);
  const [messages, setMessages] = useState<NinaMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /*
   * Eine Kennung JE GESPRÄCHSART, nicht eine für alles.
   *
   * Vorher stand hier ein einzelner Wert. Die Art wechselte mit dem
   * Pfad, die Kennung nicht — wer im Karrieregespräch war und danach
   * auf dem Radar etwas fragte, schickte `kind: "assistant"` mit der
   * Kennung des Interviews. Der Server nahm die Kennung, und die Frage
   * zur Schlagzeile landete mitten im Karrieregespräch.
   *
   * Der Server verwirft eine unpassende Kennung inzwischen (siehe
   * `ensureConversation`). Das allein genügte aber nicht: der Client
   * hätte weiterhin die falsche Kennung geschickt und beim Zurückgehen
   * die neu erhaltene Kennung über die alte geschrieben — das
   * Karrieregespräch wäre nach jedem Ausflug verloren gewesen.
   *
   * Mit einer Kennung je Art behält jeder Faden seine eigene.
   */
  const [kennungen, setKennungen] = useState<Record<string, string | null>>(() => ({
    career_interview: initialConversationId ?? null,
  }));
  const [scopeLabel, setScopeLabel] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [stage, setStage] = useState<string | null>(null);
  const [stageStatus, setStageStatus] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<NinaReadiness | null>(null);
  const [jobs, setJobs] = useState<JobVorschlag[]>([]);
  const [isListening, setIsListening] = useState(false);
  const stimme = useNinaVoice();
  const [progressGroups, setProgressGroups] = useState<
    { key: string; label: string; done: boolean }[] | null
  >(null);
  const [offeringJobs, setOfferingJobs] = useState(false);
  /* Die Zustimmung geht beim nächsten Senden einmalig mit und wird
     serverseitig vermerkt. Danach steht sie in der Datenbank, nicht
     hier — ein Zustand im Browser ist keine Zustimmung. */
  const zustimmung = useRef(false);
  const [scope, setScopeState] = useState<NinaScopeValue>({});

  /*
   * Der Bereich wird von der Seite gemeldet und beim Verlassen wieder
   * geleert. Ohne das Leeren würde Monday auf der Bewerbungsübersicht
   * noch die Stelle von vorhin für den aktuellen Kontext halten — und
   * genau solche Verwechslungen sind hier verboten.
   */
  const setScope = useCallback((next: NinaScopeValue) => {
    setScopeState((vorher) => {
      const gleich =
        vorher.jobId === next.jobId &&
        vorher.applicationId === next.applicationId &&
        vorher.documentId === next.documentId;
      return gleich ? vorher : next;
    });
  }, []);

  // Beim Routenwechsel fällt der Bereich weg, bis die neue Seite ihren
  // eigenen meldet. Das passiert im selben Renderdurchlauf, es blinkt
  // also nichts.
  const letzterPfad = useRef(pathname);
  useEffect(() => {
    if (letzterPfad.current !== pathname) {
      letzterPfad.current = pathname;
      setScopeState({});
    }
  }, [pathname]);

  const abbruch = useRef<AbortController | null>(null);
  useEffect(() => () => abbruch.current?.abort(), []);

  /*
   * Das laufende Gespräch beim ersten Rendern nachladen.
   *
   * Der Provider überlebt eine Navigation innerhalb der App — aber
   * nicht ein vollständiges Neuladen der Seite, und auch keinen
   * Gerätewechsel. Der Verlauf liegt ohnehin in der Datenbank; es wäre
   * also der falsche Ort, ihn nur im Speicher zu haben.
   *
   * Deshalb: einmal beim Start das aktive Gespräch holen. Danach nie
   * wieder — der Wächter verhindert, dass ein späteres Rendern eine
   * laufende Antwort überschreibt.
   */
  const nachgeladen = useRef(false);
  useEffect(() => {
    /*
     * Erst laden, wenn jemand hinsieht.
     *
     * Vorher lief diese Anfrage bei jedem Seitenaufbau — auch auf
     * `/app/jobs`, wo der Verlauf niemanden interessiert, und auf
     * `/app/monday`, wo die Seite ihn ohnehin serverseitig mitbringt. Sie
     * war also fast immer überflüssig und hing beim Navigieren als
     * abgebrochene Anfrage im Netzwerkprotokoll.
     *
     * Jetzt: nur wenn der Drawer geöffnet wird und noch nichts da ist.
     */
    if (nachgeladen.current || !initialConversationId) return;
    if (!open || messages.length > 0) return;
    nachgeladen.current = true;

    /*
     * Kein Abbruch beim Aufräumen.
     *
     * React ruft Effekte in der Entwicklung absichtlich doppelt auf:
     * einbinden, aufräumen, wieder einbinden. Mit einem
     * Abbruch-Merker im Aufräumen verwarf der erste Lauf sein
     * Ergebnis, und der zweite stieg am Wächter oben aus — der Verlauf
     * kam nie an. Genau das war zu sehen: der Drawer öffnete leer,
     * obwohl der Endpunkt sechs Nachrichten lieferte.
     *
     * Das Ergebnis darf hier gefahrlos ankommen: `setMessages`
     * überschreibt nichts, wenn schon etwas da ist.
     */
    /*
     * Kein eigener Abbruch — weder beim Aufräumen noch beim Verlassen.
     *
     * Der Versuch, beim `pagehide` sauber abzubrechen, hat den Fehler
     * erzeugt, den er verhindern sollte: Safari meldet einen selbst
     * ausgelösten `abort()` als Seitenfehler („due to access control
     * checks"), während eine vom Browser beim Entladen gekappte Anfrage
     * gar nichts meldet.
     *
     * Der Browser räumt beim Verlassen ohnehin auf. Das `catch` unten
     * fängt den Rest.
     */
    void (async () => {
      try {
        const antwort = await fetch(`/api/nina/conversations/${initialConversationId}`);
        if (!antwort.ok) return;
        const daten = (await antwort.json()) as {
          messages: { id: string; role: string; content: string }[];
        };
        setMessages((vorhanden) =>
          vorhanden.length > 0
            ? vorhanden
            : daten.messages
                .filter((m) => m.role === "user" || m.role === "assistant")
                .map((m) => ({
                  id: m.id,
                  role: m.role as "user" | "assistant",
                  content: m.content,
                })),
        );
      } catch {
        // Ohne Verlauf ist das Gespräch leer, nicht kaputt. Eine
        // Fehlermeldung dafür wäre lauter als der Verlust.
      }
    })();

  }, [initialConversationId, open, messages.length]);

  const agreeToSeeJobs = useCallback(() => {
    zustimmung.current = true;
    setOfferingJobs(false);
  }, []);

  /*
   * Das Mikrofon unterbricht Monday.
   *
   * Wer zu sprechen anfängt, während Monday spricht, will nicht warten,
   * bis sie ausgeredet hat — er will, dass sie aufhört. Das ist der
   * Unterschied zwischen einem Gespräch und einer Ansage.
   */
  const setListening = useCallback(
    (listening: boolean) => {
      setIsListening(listening);
      if (listening) stimme.stoppen();
    },
    [stimme],
  );

  /*
   * Welcher Faden gerade gilt.
   *
   * Der Pfad entscheidet: unter /app/monday läuft das Karrieregespräch,
   * überall sonst die schwebende Monday. Eine Frage auf dem Radar gehört
   * nicht ins Interview — und umgekehrt.
   */
  const art: "career_interview" | "assistant" = pathname.startsWith("/app/monday")
    ? "career_interview"
    : "assistant";

  const send = useCallback(
    async (text: string, options: { fromVoice?: boolean } = {}) => {
      const inhalt = text.trim();
      if (inhalt.length === 0 || busy) return;

      setError(null);
      setBusy(true);
      /* Jedes Senden zählt — egal von wo. Die Fläche unten rechts
         entscheidet daran, ob sie etwas anzeigen darf. */
      setSendezaehler((n) => n + 1);
      // Eine neue Frage unterbricht die laufende Antwort. Sonst redet
      // Monday über die eigene nächste Antwort hinweg.
      stimme.stoppen();

      const eigeneId = `lokal-${Date.now()}`;
      /*
       * Veränderlich, weil die Kennung mitten im Strom wechselt.
       *
       * Bis zum Speichern trägt die Antwort eine Behelfskennung; danach
       * schickt der Server die echte, und ab da müssen alle weiteren
       * Änderungen an dieser Nachricht die neue treffen.
       */
      let antwortId = `${eigeneId}-antwort`;
      setMessages((m) => [
        ...m,
        { id: eigeneId, role: "user", content: inhalt },
        { id: antwortId, role: "assistant", content: "", streaming: true },
      ]);

      const controller = new AbortController();
      abbruch.current = controller;

      /*
       * Der Schreibtakt gehört VOR das `try`.
       *
       * Der `finally`-Block muss ihn abräumen können — auch wenn der
       * Strom mit einem Fehler endet oder jemand die Seite wechselt.
       * Stünde er im `try`, kennte ihn `finally` nicht, und ein
       * Intervall liefe weiter und schriebe in eine Nachricht, die es
       * nicht mehr gibt.
       */
      const takt = { rest: "", fertig: false, uhr: 0 as number | ReturnType<typeof setInterval> };

      try {
        const antwort = await fetch("/api/nina/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            message: inhalt,
            conversationId: kennungen[art] ?? null,
            kind: art,
            route: pathname,
            jobId: scope.jobId ?? null,
            applicationId: scope.applicationId ?? null,
            fromVoice: options.fromVoice ?? false,
            agreeToSeeJobs: zustimmung.current,
          }),
        });

        if (!antwort.ok) {
          /*
           * Ein Fehler ist ein Fehler und keine Antwort.
           *
           * Der Server schickt bei fehlender KI-Verbindung 503 mit
           * einem verständlichen Satz. Hier wird genau dieser Satz
           * angezeigt — es wird nichts erfunden, und der leere
           * Antwortplatz verschwindet wieder.
           */
          const daten = await antwort.json().catch(() => null);
          setMessages((m) => m.filter((n) => n.id !== antwortId));
          setError(
            daten?.message ??
              "Monday ist gerade nicht erreichbar. Deine Nachricht ist gespeichert.",
          );
          return;
        }

        const reader = antwort.body?.getReader();
        if (!reader) throw new Error("Keine Antwort erhalten.");

        const decoder = new TextDecoder();
        let puffer = "";

        /*
         * ══════════════════════════════════════════════════════════
         * Monday schreibt in gleichmässigem Takt, nicht in Schüben
         * ══════════════════════════════════════════════════════════
         *
         * Das Modell liefert seinen Text in Stücken — mal drei Zeichen,
         * mal dreissig, mit Pausen dazwischen. Direkt angehängt sieht
         * das aus, als würde jemand hektisch tippen und dann warten.
         *
         * Die Stücke laufen deshalb erst in einen Zwischenpuffer, und
         * ein Takt lässt sie mit fester Geschwindigkeit heraus. Das ist
         * nicht nur ruhiger, es ist auch LESBAR: Man kann mitlesen,
         * statt jedem Sprung hinterherzuspringen.
         *
         * Fünfundsiebzig Zeichen je Sekunde. Fünfzig waren der erste
         * Versuch und lasen sich als Vorlesetempo — gemeldet kam
         * zurück: etwas schneller. Fünfundsiebzig ist noch immer
         * gleichmässig und schon zügig; darüber beginnt es wieder
         * ruckhaft zu wirken, weil einzelne Zeichen nicht mehr zu
         * verfolgen sind.
         *
         * ── Warum der Rest am Ende schneller läuft ──────────────
         *
         * Kommt die Antwort zu Ende, während noch Zeichen im Puffer
         * stehen, würde die Nachricht mit gleichem Takt weiterlaufen —
         * bei einem langen Absatz Sekunden nach dem eigentlichen Ende.
         * Ab dem Schlusssignal räumt der Takt deshalb vierfach ab. Es
         * bleibt eine Bewegung, nur eine schnellere.
         */
        const takt = { rest: "", fertig: false, uhr: 0 as number | ReturnType<typeof setInterval> };
        const TAKT_MS = 40;
        const ZEICHEN_JE_TAKT = 3;

        const abgeraeumt = () =>
          new Promise<void>((fertig) => {
            takt.uhr = setInterval(() => {
              if (takt.rest.length === 0) {
                if (takt.fertig) {
                  clearInterval(takt.uhr as ReturnType<typeof setInterval>);
                  fertig();
                }
                return;
              }
              const wieViele = takt.fertig ? ZEICHEN_JE_TAKT * 4 : ZEICHEN_JE_TAKT;
              const stueck = takt.rest.slice(0, wieViele);
              takt.rest = takt.rest.slice(wieViele);
              setMessages((m) =>
                m.map((n) => (n.id === antwortId ? { ...n, content: n.content + stueck } : n)),
              );
            }, TAKT_MS);
          });
        const taktLaeuft = abgeraeumt();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          puffer += decoder.decode(value, { stream: true });
          const teile = puffer.split("\n\n");
          puffer = teile.pop() ?? "";

          for (const teil of teile) {
            const zeile = teil.trim();
            if (!zeile.startsWith("data:")) continue;

            let ereignis: Record<string, unknown>;
            try {
              ereignis = JSON.parse(zeile.slice(5).trim());
            } catch {
              continue;
            }

            if (ereignis.type === "meta") {
              if (typeof ereignis.conversationId === "string") {
                // Nur den Faden dieser Art fortschreiben.
                const neueKennung = ereignis.conversationId;
                setKennungen((k) => (k[art] === neueKennung ? k : { ...k, [art]: neueKennung }));
              }
              setScopeLabel((ereignis.scopeLabel as string | null) ?? null);
              setSuggestions((ereignis.suggestions as string[]) ?? []);
              if (typeof ereignis.stage === "string") setStage(ereignis.stage);
              if (typeof ereignis.stageStatus === "string") setStageStatus(ereignis.stageStatus);
              if (ereignis.readiness) setReadiness(ereignis.readiness as NinaReadiness);
              // Die Zustimmung ist verbraucht — sie steht jetzt serverseitig.
              zustimmung.current = false;
              continue;
            }

            if (ereignis.type === "text") {
              /* In den Puffer, nicht direkt in die Nachricht — der Takt
                 oben lässt die Zeichen gleichmässig heraus. */
              takt.rest += String(ereignis.delta ?? "");
              continue;
            }

            if (ereignis.type === "tool_start") {
              setMessages((m) =>
                m.map((n) =>
                  n.id === antwortId
                    ? {
                        ...n,
                        tools: [
                          ...(n.tools ?? []),
                          { name: String(ereignis.name), label: String(ereignis.label) },
                        ],
                      }
                    : n,
                ),
              );
              continue;
            }

            if (ereignis.type === "tool_done") {
              setMessages((m) =>
                m.map((n) =>
                  n.id === antwortId
                    ? {
                        ...n,
                        tools: (n.tools ?? []).map((w) =>
                          w.name === ereignis.name ? { ...w, ok: Boolean(ereignis.ok) } : w,
                        ),
                      }
                    : n,
                ),
              );
              continue;
            }

            if (ereignis.type === "error") {
              setError(String(ereignis.message));
              continue;
            }

            if (ereignis.type === "jobs") {
              // Höchstens drei — auch wenn der Server mehr schickte.
              setJobs(((ereignis.jobs as JobVorschlag[]) ?? []).slice(0, 3));
              continue;
            }

            if (ereignis.type === "turn") {
              /*
               * Die Auswertung des Zuges. Sie kommt NACH dem Text —
               * deshalb aktualisiert sie Stufe und Reife hier und nicht
               * im meta-Ereignis.
               */
              if (typeof ereignis.stage === "string") setStage(ereignis.stage);
              if (typeof ereignis.stageStatus === "string") setStageStatus(ereignis.stageStatus);
              if (ereignis.readiness) setReadiness(ereignis.readiness as NinaReadiness);
              setOfferingJobs(ereignis.recommendedAction === "offer_jobs");
              if (Array.isArray(ereignis.progressGroups)) {
                setProgressGroups(
                  ereignis.progressGroups as { key: string; label: string; done: boolean }[],
                );
              }
              continue;
            }

            if (ereignis.type === "saved" && typeof ereignis.messageId === "string") {
              const echteId = ereignis.messageId;

              /*
               * Die lokale Kennung gegen die echte tauschen.
               *
               * Genau das fehlte, und die Folge war unsichtbar und
               * total: der Vorlesen-Knopf erschien NIE.
               *
               * Während des Streams trägt die Antwort eine
               * Behelfskennung `lokal-…`. `SpeakButton` blendet sich
               * dafür bewusst aus — die Sprachroute liest nur
               * gespeicherte Nachrichten, für eine Behelfskennung gäbe
               * es serverseitig nichts abzuholen. Nach dem Speichern
               * schickt der Server die echte Kennung, aber sie wurde
               * hier nur fürs automatische Vorlesen benutzt und nie an
               * die Nachricht geschrieben.
               *
               * Also blieb `lokal-…` stehen, `SpeakButton` gab für
               * immer `null` zurück, und die Sprachausgabe war über die
               * Oberfläche nicht erreichbar. Nichts warf, nichts sah
               * kaputt aus — es fehlte einfach ein Knopf, den niemand
               * vermisste, weil er nie da gewesen war.
               */
              setMessages((m) =>
                m.map((n) => (n.id === antwortId ? { ...n, id: echteId } : n)),
              );
              antwortId = echteId;

              /*
               * Erst wenn die Nachricht gespeichert ist.
               *
               * Vorher gibt es keine Kennung, und die Sprachroute liest
               * ausschließlich gespeicherte Nachrichten vor — sie nimmt
               * keinen Text vom Client entgegen.
               */
              if (autoSpeak) void stimme.vorlesen(echteId);
              continue;
            }

            if (ereignis.type === "done") {
              /*
               * Erst abwarten, bis der Puffer leer ist.
               *
               * Ohne das stünde die Nachricht als „fertig" da, während
               * die letzten Zeichen noch unterwegs sind — und der
               * Vorlese-Knopf erschiene über einem halben Satz.
               */
              takt.fertig = true;
              await taktLaeuft;
              setMessages((m) =>
                m.map((n) => (n.id === antwortId ? { ...n, streaming: false } : n)),
              );
            }
          }
        }
      } catch (fehler) {
        // Ein Abbruch durch Seitenwechsel ist kein Fehler, sondern das
        // Ende. Ihn als Fehler zu zeigen wäre falsch und beunruhigend.
        if (fehler instanceof DOMException && fehler.name === "AbortError") return;
        setMessages((m) => m.filter((n) => n.id !== antwortId));
        setError("Die Verbindung ist abgebrochen. Deine Nachricht ist gespeichert.");
      } finally {
        /*
         * Der Takt muss in JEDEM Fall enden — auch bei Abbruch oder
         * Fehler. Ein Intervall, das niemand mehr abräumt, schreibt
         * bis zum Seitenwechsel in eine Nachricht, die es nicht mehr
         * gibt.
         */
        takt.fertig = true;
        clearInterval(takt.uhr as ReturnType<typeof setInterval>);
        if (takt.rest.length > 0) {
          const rest = takt.rest;
          takt.rest = "";
          setMessages((m) =>
            m.map((n) => (n.id === antwortId ? { ...n, content: n.content + rest } : n)),
          );
        }
        setMessages((m) => m.map((n) => (n.streaming ? { ...n, streaming: false } : n)));
        setBusy(false);
        abbruch.current = null;
      }
    },
    [busy, art, kennungen, pathname, scope.jobId, scope.applicationId, stimme, autoSpeak],
  );

  const loadConversation = useCallback(async (id: string) => {
    setError(null);
    try {
      const antwort = await fetch(`/api/nina/conversations/${id}`);
      if (!antwort.ok) {
        setError("Das Gespräch konnte nicht geladen werden.");
        return;
      }
      const daten = (await antwort.json()) as {
        messages: { id: string; role: string; content: string }[];
      };
      // Ein geöffnetes Gespräch gehört zum gerade sichtbaren Faden.
      setKennungen((k) => ({ ...k, [art]: id }));
      setMessages(
        daten.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content })),
      );
    } catch {
      setError("Das Gespräch konnte nicht geladen werden.");
    }
  }, [art]);

  const hydrate = useCallback(
    (
      id: string | null,
      vorhandene: { id: string; role: "user" | "assistant"; content: string }[],
    ) => {
      setMessages((m) => (m.length > 0 ? m : vorhandene));
      setKennungen((k) => (k[art] ? k : { ...k, [art]: id }));
    },
    [art],
  );

  const reset = useCallback(() => {
    abbruch.current?.abort();
    setMessages([]);
    /*
     * Nur den aktuellen Faden zurücksetzen.
     *
     * Vorher fiel die eine Kennung auf `null` — und damit auch die des
     * Karrieregesprächs, selbst wenn man gerade nur die schwebende
     * Monday geleert hat. Beim nächsten Öffnen begann das Interview von
     * vorn, obwohl es weiterlief.
     */
    setKennungen((k) => ({ ...k, [art]: null }));
    setError(null);
    setBusy(false);
    setJobs([]);
  }, [art]);

  /*
   * Die Handlungen sind stabil — deshalb der leere Abhängigkeitsblock.
   *
   * Alle sieben Funktionen kommen aus `useCallback` und behalten ihre
   * Identität, solange ihre eigenen Abhängigkeiten stehen. `send` hängt
   * an `busy`, `conversationId`, `pathname` und dem Bereich; das sind
   * seltene Änderungen, keine je Zeichen.
   */
  const handlungen = useMemo<NinaActions>(
    () => ({
      setOpen,
      pulsAnstossen,
      send,
      reset,
      loadConversation,
      hydrate,
      setScope,
      agreeToSeeJobs,
      speak: stimme.vorlesen,
      stopSpeaking: stimme.stoppen,
      setListening,
    }),
    [
      pulsAnstossen,
      send,
      reset,
      loadConversation,
      hydrate,
      setScope,
      agreeToSeeJobs,
      stimme.vorlesen,
      stimme.stoppen,
      setListening,
    ],
  );

  const zustand = useMemo<NinaState>(
    () => ({
      open,
      messages,
      busy,
      error,
      // Nach aussen die Kennung des aktuellen Fadens — wer sie liest,
      // meint immer das Gespräch, das gerade sichtbar ist.
      conversationId: kennungen[art] ?? null,
      scopeLabel,
      suggestions,
      stage,
      stageStatus,
      readiness,
      jobs,
      progressGroups,
      offeringJobs,
      scope,
      speakingMessageId: stimme.aktiveNachricht,
      isSpeaking: stimme.zustand === "spricht",
      isListening,
      puls,
      sendezaehler,
      voiceError: stimme.fehler,
      /*
       * Die Reihenfolge ist die Rangfolge.
       *
       * Zuhören schlägt Sprechen (das Mikrofon hat Monday eben
       * unterbrochen), Sprechen schlägt Denken (der Ton läuft bereits),
       * Denken schlägt Stille. Keine Zeitschaltung, keine Zufälle —
       * jeder Zustand hat eine technische Ursache.
       */
      visualState: (isListening
        ? "listening"
        : stimme.zustand === "spricht"
          ? "speaking"
          : busy
            ? "thinking"
            : "idle") as NinaVisualState,
    }),
    [
      open,
      messages,
      busy,
      error,
      art,
      kennungen,
      scopeLabel,
      suggestions,
      stage,
      stageStatus,
      readiness,
      jobs,
      progressGroups,
      offeringJobs,
      scope,
      stimme.aktiveNachricht,
      stimme.zustand,
      stimme.fehler,
      isListening,
      puls,
      sendezaehler,
    ],
  );

  return (
    <NinaActionsContext.Provider value={handlungen}>
      <NinaStateContext.Provider value={zustand}>{children}</NinaStateContext.Provider>
    </NinaActionsContext.Provider>
  );
}
