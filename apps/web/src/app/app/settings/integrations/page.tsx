import type { Metadata } from "next";
import { getPageContext } from "@/lib/locale";
import { supabaseStatus } from "@/lib/supabase/config";
import { sourceStatuses } from "@paycheck/jobs";
import { Badge, Card } from "@/components/ui";
import { RefreshJobs } from "./RefreshJobs";

export const metadata: Metadata = { title: "Verbundene Dienste" };
export const dynamic = "force-dynamic";

/**
 * Verbundene Dienste.
 *
 * Die wichtigste Seite für Vertrauen: hier steht ungeschönt, was
 * funktioniert und was nicht. Es gibt keine Stelle im Produkt, an der
 * etwas betriebsbereit aussieht und es nicht ist.
 */
export default async function IntegrationsPage() {
  const { integrations } = await getPageContext();
  const sources = sourceStatuses();
  const supabase = supabaseStatus();

  const services = [
    {
      name: "Supabase",
      state: supabase.configured
        ? supabase.serviceRole
          ? "verbunden"
          : "teilweise"
        : "nicht verbunden",
      ok: supabase.configured && supabase.serviceRole,
      detail: supabase.summary,
      env:
        supabase.missing.length > 0
          ? supabase.missing.join(", ")
          : "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY",
    },
    {
      name: "KI-Anbieter",
      state: integrations.ai === "connected" ? "verbunden" : "nicht verbunden",
      ok: integrations.ai === "connected",
      detail:
        integrations.ai === "connected"
          ? `${integrations.aiProvider} mit dem Modell ${integrations.aiModel}. Übermittelt wird nur der Kontext, den der jeweilige Schritt braucht.`
          : "Es ist kein Schlüssel hinterlegt. Es läuft der lokale Demo-Anbieter: seine Antworten sind Beispiele ohne inhaltliche Aussage und werden auch so gekennzeichnet.",
      env: "AI_PROVIDER, OPENAI_API_KEY, OPENAI_PRIMARY_MODEL",
    },
    {
      name: "E-Mail-Versand",
      state: integrations.mail === "connected" ? "verbunden" : "nur Entwurf",
      ok: integrations.mail === "connected",
      detail:
        integrations.mail === "connected"
          ? "Ein Postfach ist verbunden. Versendet wird trotzdem erst nach deiner ausdrücklichen Freigabe."
          : "Es ist kein Postfach verbunden. Bewerbungen entstehen als Entwurf zum Herunterladen und werden nie automatisch versendet.",
      env: "MAIL_PROVIDER, SMTP_URL, MAIL_FROM",
    },
    {
      name: "Dateispeicher",
      state: integrations.storage === "connected" ? "verbunden" : "lokal",
      ok: integrations.storage === "connected",
      detail:
        integrations.storage === "connected"
          ? "Objektspeicher mit privaten Ablagen und zeitlich begrenzten Links."
          : "Hochgeladene Dateien liegen lokal auf diesem Rechner, nicht in einer Cloud. Für die Entwicklung ist das richtig, für den Betrieb nicht.",
      env: "STORAGE_DRIVER, S3_BUCKET, S3_ENDPOINT",
    },
    {
      name: "Sprachanbieter",
      state: integrations.voice === "connected" ? "verbunden" : "nicht verbunden",
      ok: integrations.voice === "connected",
      detail:
        integrations.voice === "connected"
          ? "Spracherkennung und Sprachausgabe laufen serverseitig."
          : "Nicht eingerichtet. Der Sprachmodus nutzt, falls vorhanden, die Erkennung deines Browsers.",
      env: "VOICE_PROVIDER, OPENAI_TRANSCRIBE_MODEL, OPENAI_SPEECH_MODEL",
    },
    {
      name: "Unternehmensbewertungen",
      state: "nicht verbunden",
      ok: false,
      detail:
        "Es ist keine Bewertungsquelle eingerichtet. Sobald ein Schlüssel hinterlegt ist, erscheinen Bewertungen mit Quelle, Datum und Stichprobengröße — und mit einem Link auf das Original, nie als kopierte Seite.",
      env: "GOOGLE_PLACES_API_KEY",
    },
  ];

  return (
    <div className="grid gap-6">
      <Card padded={false}>
        <div className="border-b border-line px-6 py-5">
          <h2 className="text-lg font-semibold">Dienste</h2>
          <p className="mt-1.5 max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Was hier als „nicht verbunden“ steht, ist nicht in Betrieb. Es gibt keine Stelle im
            Produkt, an der etwas funktionsfähig aussieht und es nicht ist.
          </p>
        </div>

        <ul className="divide-y divide-line">
          {services.map((service) => (
            <li key={service.name} className="grid gap-2 px-6 py-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">{service.name}</span>
                <Badge tone={service.ok ? "positive" : "outline"}>{service.state}</Badge>
              </div>
              <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
                {service.detail}
              </p>
              <p className="font-mono text-xs text-ink-3">{service.env}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card padded={false}>
        <div className="border-b border-line px-6 py-5">
          <h2 className="text-lg font-semibold">Stellenquellen</h2>
          <p className="mt-1.5 max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Eine Quelle läuft nur, wenn sie ausgewählt, eingerichtet und rechtlich geklärt ist.
            Portale, die das Auslesen untersagen, werden nicht abgefragt.
          </p>
        </div>

        <div className="border-b border-line px-6 py-5">
          <RefreshJobs />
        </div>

        <ul className="divide-y divide-line">
          {sources.map((source) => (
            <li key={source.key} className="flex flex-wrap items-center gap-3 px-6 py-4">
              <span className="text-sm font-medium">{source.displayName}</span>
              <Badge tone={source.active ? (source.real ? "positive" : "caution") : "outline"}>
                {source.active ? (source.real ? "echte Stellen" : "Demo") : "aus"}
              </Badge>
              <span className="text-sm text-ink-3">{source.reason}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
