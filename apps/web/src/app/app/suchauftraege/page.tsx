import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import {
  aktivitaetVermerken,
  auftraegeLaden,
  klaerungLaden,
  trefferLaden,
} from "@/lib/suchauftrag/aktionen";
import { SuchauftragKarte } from "@/components/suchauftrag/SuchauftragKarte";
import { Trefferliste } from "@/components/suchauftrag/Trefferliste";
import { Mailkanal } from "@/components/suchauftrag/Mailkanal";
import { Klaerung } from "@/components/suchauftrag/Klaerung";
import { AuftragAusText } from "@/components/suchauftrag/AuftragAusText";
import { modellBereit } from "@/lib/suchauftrag/modellrufer";
import { mailstandLaden } from "@/lib/suchauftrag/benachrichtigung";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { Button } from "@/components/ui";

export const metadata: Metadata = { title: "Suchaufträge" };
export const dynamic = "force-dynamic";

/**
 * Die Suchaufträge einer Person.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum „neu für dich" und „zu klären" getrennt stehen
 * ══════════════════════════════════════════════════════════════
 *
 * Das eine ist ein Vorschlag, das andere eine Frage.
 *
 * Eine Stelle, bei der das Gehalt fehlt und die Person ein
 * Mindestgehalt genannt hat, ist keine Empfehlung — sie ist ein
 * offener Punkt. Beides in eine Zahl zu legen hiesse, eine offene
 * Frage als Treffer zu zählen; die Zahl sähe grösser aus und wäre
 * weniger wert.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Seite sagt, wann zuletzt gesucht wurde
 * ══════════════════════════════════════════════════════════════
 *
 * Weil ein Hintergrunddienst unsichtbar ist. Ohne diese Angabe lässt
 * sich nicht unterscheiden, ob nichts gefunden wurde oder ob nichts
 * gelaufen ist — und das ist genau der Unterschied zwischen einem
 * ruhigen Arbeitsmarkt und einem kaputten Produkt.
 */
export default async function SuchauftraegePage() {
  /*
   * Beides gleichzeitig. Zwei `await` hintereinander sind gegen
   * Supabase zwei Netzwege für Daten, die nichts voneinander wissen.
   */
  const [auftraege, treffer, mailstand, klaerung, modell] = await Promise.all([
    auftraegeLaden(),
    trefferLaden(),
    mailstandLaden(),
    klaerungLaden(),
    modellBereit(),
  ]);

  /*
   * Der Besuch selbst ist das Aktivitätssignal.
   *
   * Nicht ein Klick auf etwas Bestimmtes und schon gar kein
   * Öffnungspixel in einer Mail: Der eine misst zu wenig, der andere
   * misst Postfacheinstellungen. Wer hier ist, ist da.
   */
  await aktivitaetVermerken();
  const laufend = auftraege.filter((a) => a.status !== "entwurf");
  const entwuerfe = auftraege.filter((a) => a.status === "entwurf");

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Nina sucht für dich weiter"
        title="Suchaufträge"
        lead="Du musst deine Suche nicht jeden Tag neu beginnen. Nina führt einen bestätigten Suchauftrag weiter und meldet sich mit neuen passenden Stellen."
        actions={
          <Button asChild variant="ghost">
            <Link href="/app/jobs">Zur Stellensuche</Link>
          </Button>
        }
      />

      {/*
        Das Feld steht oben, wenn noch nichts läuft, und unten, wenn
        etwas läuft. Wer schon sucht, will zuerst seine Treffer sehen;
        wer noch nicht sucht, hat hier nichts anderes zu tun.
      */}
      {laufend.length === 0 && entwuerfe.length === 0 && (
        <AuftragAusText modellBereit={modell.bereit} />
      )}

      {entwuerfe.length > 0 && (
        <section className="grid gap-3">
          <h2 className="abschnitts-titel">Wartet auf deine Zustimmung</h2>
          {entwuerfe.map((a) => (
            <SuchauftragKarte key={a.id} auftrag={a} />
          ))}
        </section>
      )}

      {klaerung && <Klaerung frage={klaerung} />}

      {treffer.neu.length > 0 && (
        <section className="grid gap-3">
          <div className="grid gap-1">
            <h2 className="abschnitts-titel">Neu für dich gefunden</h2>
            <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
              Alle Bedingungen erfüllt, die du genannt hast. Der Satz darunter ist der Grund —
              derselbe, den Nina in einer Mail schreiben würde.
            </p>
          </div>
          <Trefferliste treffer={treffer.neu} art="empfehlung" />
        </section>
      )}

      {treffer.zuKlaeren.length > 0 && (
        <section className="grid gap-3">
          <div className="grid gap-1">
            <h2 className="abschnitts-titel">Noch zu klären</h2>
            {/*
              Ausdrücklich keine Empfehlung. Diese Stellen könnten
              passen — die Anzeige sagt es nur nicht. Sie unter „neu
              für dich" zu führen wäre eine Zusage, die niemand gegeben
              hat; sie wegzulassen wäre der andere Fehler, denn ein
              Anruf würde die Frage in einer Minute klären.
            */}
            <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
              Diese Stellen widersprechen nichts, was du gesagt hast — aber die Anzeige lässt eine
              deiner Bedingungen offen. Das ist keine Empfehlung, sondern eine Frage.
            </p>
          </div>
          <Trefferliste treffer={treffer.zuKlaeren} art="frage" />
        </section>
      )}

      {/*
        Der Mailkanal steht unter den Treffern, nicht über ihnen.

        Was Nina gefunden hat, ist das Ergebnis; wohin es geschickt
        wird, ist eine Einstellung. Ein Formular ganz oben liesse die
        Seite wie eine Anmeldemaske aussehen — und wer noch nichts
        gefunden bekommen hat, soll nicht als Erstes nach seiner
        Adresse gefragt werden.
      */}
      {(laufend.length > 0 || treffer.neu.length > 0) && <Mailkanal stand={mailstand} />}

      {(laufend.length > 0 || entwuerfe.length > 0) && (
        <AuftragAusText modellBereit={modell.bereit} />
      )}

      {laufend.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="abschnitts-titel">Laufend</h2>
          {laufend.map((a) => (
            <SuchauftragKarte key={a.id} auftrag={a} />
          ))}
        </section>
      ) : (
        entwuerfe.length === 0 && (
          <EmptyState
            icon={<Search aria-hidden className="size-5" />}
            title="Noch kein Suchauftrag"
            body="Stelle in der Stellensuche deine Filter ein und lass Nina diese Suche weiterführen. Sie prüft von da an neue Anzeigen dagegen — auch wenn du nicht da bist."
            action={
              <Button asChild variant="primary">
                <Link href="/app/jobs">Suche einstellen</Link>
              </Button>
            }
          />
        )
      )}
    </div>
  );
}
