import type { Metadata } from "next";
import Link from "next/link";
import {
  Abschluss,
  Abschnitt,
  Aufklapper,
  Einstieg,
  Grundsaetze,
  Hauptknopf,
  LESEBREITE,
  Nebenknopf,
} from "@/components/unterseiten/Geruest";
import { funktion, hatZiel } from "@/lib/unterseiten/verfuegbarkeit";

export const metadata: Metadata = {
  title: "Sicherheit",
  description:
    "Welche Daten Velvova verarbeitet, wer Zugriff bekommt — und welche Massnahmen umgesetzt sind und welche nicht.",
};

/**
 * ══════════════════════════════════════════════════════════════════
 * Sicherheit — jede Aussage gegen den Code geprüft
 * ══════════════════════════════════════════════════════════════════
 *
 * Diese Seite ist die einzige der fünf, bei der eine falsche Aussage
 * nicht bloss enttäuscht, sondern täuscht. Deshalb wurde jeder
 * technische Satz der alten Fassung nachgeschlagen, bevor er hier
 * wieder auftauchen durfte.
 *
 * ── Was die Prüfung am 9. September 2026 ergab ─────────────────
 *
 * BESTÄTIGT
 *
 *   Passwörter mit scrypt. `lib/auth.ts` nutzt `scryptSync` mit
 *   N=16384, r=8, p=1, zufälligem Salt je Passwort und
 *   `timingSafeEqual` beim Vergleich. Wichtig dabei: Velvova hat eine
 *   EIGENE Anmeldung und benutzt nicht Supabase Auth. Der übliche
 *   Einwand — Supabase hashe mit bcrypt, die Beschreibung passe also
 *   nicht — trifft hier nicht zu, weil die Voraussetzung nicht
 *   stimmt. Eine Supabase-Datenbank zu benutzen heisst nicht,
 *   Supabase Auth zu benutzen.
 *
 *   Sitzungs-Cookie mit `httpOnly: true`, `sameSite: "lax"` und
 *   `secure` in Produktion (`lib/auth.ts`).
 *
 *   Kurzlebige signierte Links statt öffentlicher Adressen.
 *   `lib/supabase/storage.ts` erzeugt sie über `createSignedUrl` mit
 *   Ablauffrist.
 *
 *   Maskierung vor dem Protokollieren. `packages/observability/redact.ts`
 *   führt eine Liste von Feldnamen, die nicht in Protokolle gelangen.
 *
 * NICHT BESTÄTIGT — und deshalb hier gestrichen
 *
 *   „Anbindung für einen Schadsoftware-Scan". Gesucht nach clamav,
 *   virus, malware, scan: kein Scanner, keine Anbindung, kein
 *   Aufrufpunkt. Selbst die vorsichtige Formulierung „Anbindung"
 *   beschrieb etwas, das es nicht gibt.
 *
 *   „Verschlüsselter Objektspeicher" im Sinne eigener Verschlüsselung.
 *   Die Spalten `credentials_encrypted` und `statement_encrypted`
 *   stehen im Schema — geschrieben wird in keine von beiden. Ein
 *   Feld, das „encrypted" heisst und leer bleibt, ist keine
 *   Verschlüsselung, sondern ein Vorhaben mit Namen.
 *
 * Diese beiden Punkte stehen jetzt unter „Was noch nicht umgesetzt
 * ist". Sie zu löschen wäre bequemer gewesen und hätte die Seite
 * positiver aussehen lassen — genau das ist der Grund, es nicht zu
 * tun.
 */

/**
 * Der Stand der letzten Inhaltsprüfung.
 *
 * Ein festes Datum, kein `new Date()`. Ein automatisch eingesetztes
 * Heute behauptet jeden Tag aufs Neue eine Prüfung, die an genau
 * einem Tag stattgefunden hat — das ist die unauffälligste Art, eine
 * Sicherheitsseite unwahr werden zu lassen.
 *
 * Wer den Code ändert, ändert dieses Datum mit. Steht es still,
 * während die Anwendung weiterläuft, ist das die richtige Auskunft:
 * Seitdem hat niemand nachgesehen.
 */
const GEPRUEFT_AM = "9. September 2026";

export default function SicherheitSeite() {
  const einstellungen = funktion("datenschutz-einstellungen");

  return (
    <>
      <Einstieg
        oberzeile="Sicherheit"
        titel="Deine Daten. Klar geregelt."
        text="Hier steht, welche Daten Velvova verarbeitet, wer Zugriff bekommt und was du selbst verwalten kannst. Und zwar auch das, was noch nicht umgesetzt ist."
        aktionen={
          <>
            {hatZiel(einstellungen) ? (
              <Hauptknopf href={einstellungen.route}>Einstellungen öffnen</Hauptknopf>
            ) : null}
            <Nebenknopf href="/privacy">Datenschutzerklärung lesen</Nebenknopf>
          </>
        }
        unter={
          <p className="text-[13px] leading-[1.6] text-ink-3">
            Inhalt zuletzt gegen den Code geprüft am {GEPRUEFT_AM}. Das ist ein Prüfdatum, kein
            Audit — eine externe Zertifizierung oder ein Penetrationstest liegt nicht vor.
          </p>
        }
      />

      <Abschnitt
        titel="Drei Fragen, kurz beantwortet"
        kinder={
          <Grundsaetze
            punkte={[
              {
                titel: "Zugriff auf deine Angaben",
                text: "Dein Karrieregespräch, deine Dokumente und deine Notizen gehören in den privaten Bereich. Ein Arbeitgeberzugang, der davon etwas sieht, existiert heute nicht — und wenn er kommt, nur für gezielt freigegebene Angaben.",
              },
              {
                titel: "Verarbeitung durch KI",
                text: "Einordnungen laufen über Sprachmodelle von OpenAI und Anthropic. Was dorthin geht, ist die Frage und der zugehörige Text — nicht dein gesamtes Profil. Die Supportantworten bekommen ausschliesslich die Produktdokumentation.",
              },
              {
                titel: "Speichern und löschen",
                text: "Was du eingibst, kannst du ändern und löschen. Wie weit das heute per Selbstbedienung geht und wo es über den Kontakt läuft, steht unten bei den offenen Punkten.",
              },
            ]}
          />
        }
      />

      <Abschnitt
        titel="Was umgesetzt ist"
        text="Jeder Punkt hier ist an einer Stelle im Code nachgeschlagen. Die Stelle steht dabei."
        kinder={
          <Aufklapper
            fragen={[
              {
                frage: "Anmeldung und Sitzungen",
                antwort: (
                  <>
                    <p>
                      Gespeichert wird kein Passwort, sondern ein scrypt-Hash mit zufälligem Salt je
                      Konto. Der Vergleich läuft in konstanter Zeit, damit die Antwortdauer nicht
                      verrät, wie weit ein Rateversuch gekommen ist. Verlangt werden mindestens acht
                      Zeichen — Länge schützt besser als erzwungene Sonderzeichen.
                    </p>
                    <p>
                      Velvova hat dafür eine eigene Anmeldung und benutzt nicht die Anmeldung des
                      Datenbankanbieters. Das ist ein Unterschied, der oft übersehen wird: Eine
                      Supabase-Datenbank zu verwenden heisst nicht, Supabase Auth zu verwenden.
                    </p>
                    <p>
                      Das Sitzungs-Cookie ist <code>httpOnly</code> — Javascript im Browser kommt
                      nicht heran — und <code>SameSite=Lax</code>; in Produktion zusätzlich{" "}
                      <code>secure</code>, also nur über TLS.
                    </p>
                  </>
                ),
              },
              {
                frage: "Dateien und Uploads",
                antwort: (
                  <>
                    <p>
                      Typ und Grösse werden geprüft. Dateien liegen nicht unter öffentlichen
                      Adressen: Der Zugriff läuft über kurzlebige signierte Links, die nach einer
                      Frist ungültig werden.
                    </p>
                    <p>
                      Einen Schadsoftware-Scan gibt es nicht — siehe unten. Lade deshalb nichts hoch,
                      was du nicht auch per E-Mail verschicken würdest.
                    </p>
                  </>
                ),
              },
              {
                frage: "Protokolle und Supportzugriff",
                antwort: (
                  <>
                    <p>
                      Vor dem Protokollieren werden Felder maskiert, die Persönliches enthalten
                      können — darunter Freitexte, Begründungen, Notizen und Zugangsdaten. Die Liste
                      steht an einer Stelle und gilt für alles, was protokolliert wird.
                    </p>
                    <p>
                      Was ein Hosting-Anbieter unabhängig davon in seinen eigenen Protokollen führt,
                      liegt ausserhalb dieses Codes und damit ausserhalb dessen, was hier zugesagt
                      werden kann.
                    </p>
                  </>
                ),
              },
              {
                frage: "Externe Inhalte und KI-Verarbeitung",
                antwort: (
                  <>
                    <p>
                      Für Einordnungen werden Sprachmodelle von OpenAI und Anthropic eingesetzt.
                      Übermittelt wird, was für die jeweilige Frage nötig ist.
                    </p>
                    <p>
                      Der Support-Faden ist davon getrennt: Er bekommt die Frage und die
                      Produktdokumentation, nicht dein Karrieregespräch. Das ist keine Einstellung,
                      sondern ein eigener Endpunkt mit eigenem Kontext.
                    </p>
                    <p>
                      Einzelheiten dazu stehen in der{" "}
                      <Link
                        href="/ai-transparency"
                        className="text-accent-text underline underline-offset-[3px]"
                      >
                        KI-Transparenz
                      </Link>
                      .
                    </p>
                  </>
                ),
              },
            ]}
          />
        }
      />

      {/*
        Der Abschnitt, den man am liebsten weglassen würde.

        Er steht bewusst gross und nicht in einer Unterebene: Eine
        bekannte Lücke, die man suchen muss, ist praktisch keine
        Auskunft. Beide Punkte standen vorher als Leistung auf dieser
        Seite.
      */}
      <Abschnitt
        titel="Was noch nicht umgesetzt ist"
        text={`Diese Punkte standen bis zum ${GEPRUEFT_AM} auf dieser Seite, als wären sie fertig. Sie sind es nicht.`}
        kinder={
          <ul className="grid gap-6">
            {[
              {
                titel: "Kein Schadsoftware-Scan für Uploads",
                text: "Die frühere Fassung nannte eine „Anbindung für einen Schadsoftware-Scan“. Es gibt weder einen Scanner noch eine Anbindung noch eine Stelle, an der einer aufgerufen würde. Hochgeladene Dateien werden auf Typ und Grösse geprüft und sonst nicht.",
              },
              {
                titel: "Keine zusätzliche Verschlüsselung einzelner Felder",
                text: "Im Datenmodell gibt es Spalten mit dem Zusatz „encrypted“. Geschrieben wird in keine davon. Der Schutz der Daten ruht damit auf der Verschlüsselung des Datenbankanbieters und auf den Zugriffsregeln — nicht auf einer eigenen Feldverschlüsselung.",
              },
              {
                titel: "Kein externer Nachweis",
                text: "Es gibt keine Zertifizierung und keinen Penetrationstest von aussen. Was auf dieser Seite steht, beruht auf einer Durchsicht des eigenen Codes — mehr behauptet das Prüfdatum oben nicht.",
              },
            ].map((p) => (
              <li key={p.titel} className="grid gap-2 border-t border-line pt-5">
                <h3 className="text-[17px] font-semibold text-ink">{p.titel}</h3>
                <p className={`${LESEBREITE} text-[15px] leading-[1.6] text-ink-2`}>{p.text}</p>
              </li>
            ))}
          </ul>
        }
      />

      <Abschnitt
        titel="Einstellungen sind im Konto, nicht hier"
        kinder={
          <p className={`${LESEBREITE} text-[16px] leading-[1.65] text-ink-2`}>
            Diese Seite erklärt, was passiert. Verändern lässt sich nichts von hier aus — Schalter
            auf einer öffentlichen Seite hätten kein Konto, an dem sie etwas speichern könnten, und
            ein Schalter, der nur die Farbe wechselt, ist keine Datenschutzfunktion. Die echten
            Einstellungen stehen im angemeldeten Bereich.
          </p>
        }
      />

      <Abschluss
        titel="Etwas gefunden, das nicht stimmt?"
        text="Wenn dir eine Sicherheitslücke auffällt, schreib uns direkt, bevor du es öffentlich machst. Bitte keine Passwörter oder Zugangsschlüssel in der Nachricht."
        aktionen={
          <>
            <Hauptknopf href="/contact">Sicherheitsproblem melden</Hauptknopf>
            <Nebenknopf href="/privacy">Datenschutzerklärung</Nebenknopf>
          </>
        }
      />
    </>
  );
}
