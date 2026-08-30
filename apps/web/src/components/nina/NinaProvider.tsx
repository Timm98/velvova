"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Ninas Zustand für die ganze Anwendung.
 *
 * Der Provider sitzt im Layout der authentifizierten Seiten. Das ist
 * kein Detail, sondern der ganze Punkt: das Layout bleibt beim
 * Seitenwechsel bestehen, die Seite darunter wird ausgetauscht. Also
 * überlebt das Gespräch die Navigation — ohne globalen Speicher, ohne
 * Umweg über die URL, ohne dass irgendetwas synchronisiert werden muss.
 *
 * Wer auf einer Stellenseite fragt „was fehlt mir hier?“ und dann zu den
 * Bewerbungen wechselt, spricht weiter mit derselben Nina über dieselbe
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

interface NinaContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  messages: NinaMessage[];
  busy: boolean;
  error: string | null;
  conversationId: string | null;
  scopeLabel: string | null;
  suggestions: string[];
  send: (text: string, options?: { fromVoice?: boolean }) => Promise<void>;
  reset: () => void;
  loadConversation: (id: string) => Promise<void>;
  /**
   * Einen serverseitig geladenen Verlauf übernehmen.
   *
   * Für Seiten, die den Verlauf ohnehin schon rendern — sie sollen ihn
   * nicht ein zweites Mal über das Netz holen. Überschreibt nichts,
   * wenn schon ein Gespräch läuft: sonst würde ein `router.refresh()`
   * mitten in einer Antwort den Verlauf zurücksetzen.
   */
  hydrate: (
    conversationId: string | null,
    messages: { id: string; role: "user" | "assistant"; content: string }[],
  ) => void;
  /** Von der Seite gesetzt, damit Nina weiß, worüber gesprochen wird. */
  setScope: (scope: NinaScopeValue) => void;
  scope: NinaScopeValue;
}

const NinaContext = createContext<NinaContextValue | null>(null);

export function useNina(): NinaContextValue {
  const value = useContext(NinaContext);
  if (!value) {
    throw new Error(
      "useNina außerhalb des NinaProvider. Der Provider gehört ins Layout der " +
        "authentifizierten Seiten — nicht in eine einzelne Seite, sonst geht das " +
        "Gespräch beim Seitenwechsel verloren.",
    );
  }
  return value;
}

export function NinaProvider({
  children,
  initialConversationId,
}: {
  children: React.ReactNode;
  initialConversationId?: string | null;
}) {
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<NinaMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId ?? null,
  );
  const [scopeLabel, setScopeLabel] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [scope, setScopeState] = useState<NinaScopeValue>({});

  /*
   * Der Bereich wird von der Seite gemeldet und beim Verlassen wieder
   * geleert. Ohne das Leeren würde Nina auf der Bewerbungsübersicht
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
    if (nachgeladen.current || !initialConversationId) return;
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
  }, [initialConversationId]);

  const send = useCallback(
    async (text: string, options: { fromVoice?: boolean } = {}) => {
      const inhalt = text.trim();
      if (inhalt.length === 0 || busy) return;

      setError(null);
      setBusy(true);

      const eigeneId = `lokal-${Date.now()}`;
      const antwortId = `${eigeneId}-antwort`;
      setMessages((m) => [
        ...m,
        { id: eigeneId, role: "user", content: inhalt },
        { id: antwortId, role: "assistant", content: "", streaming: true },
      ]);

      const controller = new AbortController();
      abbruch.current = controller;

      try {
        const antwort = await fetch("/api/nina/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            message: inhalt,
            conversationId,
            kind: pathname.startsWith("/app/nina") ? "career_interview" : "assistant",
            route: pathname,
            jobId: scope.jobId ?? null,
            applicationId: scope.applicationId ?? null,
            fromVoice: options.fromVoice ?? false,
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
              "Nina ist gerade nicht erreichbar. Deine Nachricht ist gespeichert.",
          );
          return;
        }

        const reader = antwort.body?.getReader();
        if (!reader) throw new Error("Keine Antwort erhalten.");

        const decoder = new TextDecoder();
        let puffer = "";

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
                setConversationId(ereignis.conversationId);
              }
              setScopeLabel((ereignis.scopeLabel as string | null) ?? null);
              setSuggestions((ereignis.suggestions as string[]) ?? []);
              continue;
            }

            if (ereignis.type === "text") {
              const stück = String(ereignis.delta ?? "");
              setMessages((m) =>
                m.map((n) => (n.id === antwortId ? { ...n, content: n.content + stück } : n)),
              );
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

            if (ereignis.type === "done") {
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
        setMessages((m) => m.map((n) => (n.streaming ? { ...n, streaming: false } : n)));
        setBusy(false);
        abbruch.current = null;
      }
    },
    [busy, conversationId, pathname, scope.jobId, scope.applicationId],
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
      setConversationId(id);
      setMessages(
        daten.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content })),
      );
    } catch {
      setError("Das Gespräch konnte nicht geladen werden.");
    }
  }, []);

  const hydrate = useCallback(
    (
      id: string | null,
      vorhandene: { id: string; role: "user" | "assistant"; content: string }[],
    ) => {
      setMessages((m) => (m.length > 0 ? m : vorhandene));
      setConversationId((v) => v ?? id);
    },
    [],
  );

  const reset = useCallback(() => {
    abbruch.current?.abort();
    setMessages([]);
    setConversationId(null);
    setError(null);
    setBusy(false);
  }, []);

  const wert = useMemo<NinaContextValue>(
    () => ({
      open,
      setOpen,
      messages,
      busy,
      error,
      conversationId,
      scopeLabel,
      suggestions,
      send,
      reset,
      loadConversation,
      hydrate,
      setScope,
      scope,
    }),
    [
      open,
      messages,
      busy,
      error,
      conversationId,
      scopeLabel,
      suggestions,
      send,
      reset,
      loadConversation,
      hydrate,
      setScope,
      scope,
    ],
  );

  return <NinaContext.Provider value={wert}>{children}</NinaContext.Provider>;
}
