import type { Metadata } from "next";
import { PROGRESS_GROUPS, STAGE_STATUS_DE, completedGroups } from "@paycheck/ai";
import { getPageContext } from "@/lib/locale";
import { loadInterview } from "@/lib/interview";
import { requireUser } from "@/lib/auth";
import { ensureConversation, loadMessages } from "@/lib/nina/conversations";
import { bestandAufnehmen } from "@/lib/nina/engine";
import { InterviewRoom } from "./InterviewRoom";

export const metadata: Metadata = { title: "Gespräch" };
export const dynamic = "force-dynamic";

/**
 * Fast gleiche Aussagen zusammenführen.
 *
 * Die Extraktion legt dieselbe Aussage gern in zwei Feldern ab — „Ich
 * arbeite seit fünf Jahren im Kundenservice“ ist zugleich Erfahrung und
 * Ziel. In der Datenbank ist das richtig: die Kategorie zählt für
 * verschiedene Zwecke. Auf dem Bildschirm ist es eine Bitte, dasselbe
 * zweimal zu bestätigen.
 *
 * Verglichen wird auf den ersten 60 Zeichen in Kleinschreibung ohne
 * Satzzeichen — grob genug für Umformulierungen, eng genug, um zwei
 * echte Aussagen nicht zu verschmelzen.
 */
function entdoppeln<T extends { statement: string }>(items: T[]): T[] {
  const gesehen = new Set<string>();
  return items.filter((i) => {
    const schlüssel = i.statement
      .toLowerCase()
      .replace(/[^a-zäöüß0-9 ]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
    if (gesehen.has(schlüssel)) return false;
    gesehen.add(schlüssel);
    return true;
  });
}

/**
 * Das Karrieregespräch.
 *
 * Die Seite lädt, was der Server über den Menschen weiß, und gibt es
 * weiter: Verlauf, offene Vermutungen, Stufe, Fortschritt. Alles
 * Weitere passiert im Gespräch.
 *
 * Der Verlauf kommt aus der Datenbank, nicht aus dem Zustand einer
 * Komponente. Deshalb ist er nach einem Neuladen noch da — und auf
 * einem zweiten Gerät auch.
 */
export default async function NinaPage({
  searchParams,
}: {
  searchParams: Promise<{ g?: string }>;
}) {
  const { t, brand } = await getPageContext();
  const user = await requireUser();

  /*
   * ══════════════════════════════════════════════════════════════
   * Das Gespräch läuft neben dem Interview, nicht dahinter
   * ══════════════════════════════════════════════════════════════
   *
   * Hier standen `ensureConversation` und `loadMessages` UNTER der
   * Sammelrunde — nacheinander, obwohl sie mit `view` und `bestand`
   * nichts zu tun haben. Sie brauchen nur die Nutzerkennung.
   *
   * Gemessen, Zeitpunkte ab Anfang der Anfrage:
   *
   *     bestandAufnehmen      355 ms
   *     loadInterview         616
   *     ensureConversation    789   ← wartete auf beide
   *     loadMessages          969   ← wartete auf ensureConversation
   *
   * Dreihundertfünfzig Millisekunden, in denen nichts gerechnet
   * wurde: Jede dieser Funktionen macht eine eigene Transaktion auf,
   * und das sind vier Netzrunden gegen Supabase.
   *
   * `loadMessages` bleibt an `ensureConversation` gebunden — es
   * braucht die Gesprächskennung. Diese Kette läuft jetzt aber NEBEN
   * `loadInterview` statt danach, und sie ist kürzer als die: 353
   * gegen 566 Millisekunden. Sie kostet damit gar nichts mehr.
   */
  const [view, bestand, { gespräch, nachrichten }] = await Promise.all([
    loadInterview(),
    bestandAufnehmen(user.id),
    (async () => {
      /*
       * ── Ein bestimmtes Gespräch öffnen ──────────────────────────
       *
       * `?g=` kommt aus der Liste der letzten Gespräche in der
       * Seitenleiste. Ohne diesen Weg wäre die Liste eine Reihe von
       * Verweisen, die alle dasselbe öffnen — sichtbar erst, wenn
       * jemand den zweiten anklickt und wieder im ersten landet.
       *
       * Die Prüfung, ob das Gespräch der Person gehört, macht
       * `ensureConversation` selbst: Es sucht nach Kennung UND
       * Nutzer. Findet es nichts, legt es ein neues an — eine fremde
       * Kennung führt also nicht zu fremdem Inhalt, sondern ins
       * Leere. Das ist die richtige Antwort auf eine geratene Adresse.
       */
      const gewuenscht = (await searchParams).g?.trim();

      /*
       * ── Ohne `?g=` beginnt ein neues Gespräch ────────────────────
       *
       * Hier wurde bisher IMMER das Karrieregespräch geladen — für
       * jeden, der die App öffnete, mit allem, was je darin stand.
       * Die Startansicht bekam damit niemand zu sehen, sobald er
       * einmal geschrieben hatte: Statt Core, Name und Frage stand
       * dort ein Verlauf von letzter Woche.
       *
       * Jetzt entscheidet die Adresse. Mit `?g=` das gemeinte
       * Gespräch, ohne sie ein leeres.
       *
       * Kein Gespräch anzulegen, solange niemand etwas gesagt hat:
       * Jeder Aufruf legte sonst eine Zeile an, die nie einen Inhalt
       * bekommt. Die Kennung entsteht beim ersten Senden — die Route
       * nimmt `null` entgegen und schickt sie zurück.
       */
      if (!gewuenscht || gewuenscht.length >= 64) {
        return { gespräch: null, nachrichten: [] };
      }

      const g = await ensureConversation(user.id, {
        conversationId: gewuenscht,
        kind: "career_interview",
        locale: user.locale,
        route: "/app/monday",
      });
      const n = await loadMessages(user.id, g.id);
      return { gespräch: g, nachrichten: n };
    })(),
  ]);

  const fertigeGruppen = new Set(completedGroups(bestand));

  return (
    <InterviewRoom
      assistantName={brand.assistantName}
      /* Aus dem angemeldeten Profil, nie fest im Code. Fehlt er,
         steht in der Begrüssung nur „Hallo" — freundlicher als ein
         Platzhalter und ehrlicher als ein erfundener Vorname. */
      displayName={user.displayName?.trim() || null}
      openingQuestion={view.step.text}
      conversationId={gespräch?.id ?? null}
      initialMessages={nachrichten
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          modell: m.model ?? null,
        }))}
      hypotheses={entdoppeln(view.openHypotheses).slice(0, 4)}
      initialStage={bestand.stage}
      initialStatus={STAGE_STATUS_DE[bestand.stage]}
      progress={{
        groups: PROGRESS_GROUPS.map((g) => ({
          key: g.key,
          label: g.label,
          done: fertigeGruppen.has(g.key),
        })),
        completeness: bestand.readiness.score,
      }}
      labels={{
        yourAnswer: t("interview.yourAnswer"),
        pauseSession: t("interview.pauseSession"),
      }}
    />
  );
}
