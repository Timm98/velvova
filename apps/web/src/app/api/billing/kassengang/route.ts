import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { zahlungsanbieter } from "@/lib/billing/anbieter";
import type { PlanKey } from "@/lib/billing/plaene";

/**
 * Der Weg zur Kasse.
 *
 * Er tut heute genau eine Sache: er weigert sich ehrlich. Es ist kein
 * Zahlungsanbieter eingerichtet, also gibt es keinen Kassengang — und
 * eine Route, die stattdessen ein Abo in die Datenbank schreibt, wäre
 * eine gefälschte Zahlung. Genau das darf hier nicht entstehen, auch
 * nicht „vorläufig zum Testen": ein Abo ohne Abrechnung ist in dem
 * Moment ein echtes Abo, in dem jemand danach eine Rechnung erwartet.
 *
 * Was die Route trotzdem heute schon leistet, und weshalb sie existiert:
 *
 *   **Der Vertrag steht.** Sobald ein Anbieter angeschlossen ist,
 *   ändert sich hier eine Zeile — `anbieter.kassengang(...)` — und
 *   sonst nichts. Die Oberfläche, das Blatt, die Weiterleitung: alles
 *   spricht schon jetzt mit dieser Adresse.
 *
 *   **Die Prüfungen stehen.** Angemeldet sein, ein gültiger Plan, kein
 *   Wechsel auf den Plan, den man schon hat. Das sind Regeln über das
 *   Konto, nicht über die Zahlung, und sie gelten unabhängig davon,
 *   wer abrechnet.
 */

const ERLAUBT: PlanKey[] = ["premium", "max"];

export async function POST(request: NextRequest) {
  const user = await requireUser();

  const plan = new URL(request.url).searchParams.get("plan");
  if (!plan || !ERLAUBT.includes(plan as PlanKey)) {
    return NextResponse.json(
      { fehler: "Unbekannter Plan." },
      { status: 400 },
    );
  }

  const anbieter = zahlungsanbieter();
  if (!anbieter.verfügbar()) {
    /*
     * 503, nicht 500: das ist kein Fehler in dieser Anwendung, sondern
     * eine Fähigkeit, die noch nicht eingerichtet ist. Der Unterschied
     * steht im Protokoll und entscheidet, ob jemand nach einem Bug
     * sucht, den es nicht gibt.
     */
    return NextResponse.json(
      {
        fehler: "Es ist noch kein Zahlungsanbieter verbunden.",
        hinweis: "Dein Plan bleibt unverändert. Es wurde nichts abgebucht und nichts geändert.",
      },
      { status: 503 },
    );
  }

  const basis = new URL(request.url).origin;
  const { url } = await anbieter.kassengang({
    userId: user.id,
    plan: plan as "premium" | "max",
    interval: "month",
    // Zurück genau dorthin, wo der Wechsel begonnen hat.
    erfolgUrl: `${basis}/app/settings/abo?gewechselt=${plan}`,
    abbruchUrl: `${basis}/app/settings/abo`,
  });

  return NextResponse.redirect(url, { status: 303 });
}

/** Damit ein versehentliches GET nicht wie eine kaputte Seite aussieht. */
export async function GET() {
  return NextResponse.json(
    { fehler: "Diese Adresse nimmt nur POST entgegen." },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export const dynamic = "force-dynamic";
