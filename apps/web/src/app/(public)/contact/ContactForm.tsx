"use client";

import { useState } from "react";
import { Button, Field, Input, Textarea } from "@/components/ui";

/**
 * Das Kontaktformular.
 *
 * Es geht durch denselben Weg wie eine Rückmeldung aus dem Produkt —
 * ein zweites Postfach mit eigener Logik wäre ein zweites Postfach,
 * das irgendwann niemand mehr liest.
 */

const THEMEN = [
  ["support", "Support"],
  ["partnership", "Partnerschaft"],
  ["privacy", "Datenschutz"],
  ["press", "Presse"],
  ["feedback", "Rückmeldung"],
  ["other", "Anderes"],
] as const;

export function ContactForm() {
  const [gesendet, setGesendet] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function senden(formData: FormData) {
    setPending(true);
    setFehler(null);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: formData.get("topic") === "privacy" ? "privacy" : "other",
          title: `Kontakt: ${formData.get("topic")}`,
          message: `${formData.get("message")}\n\n— ${formData.get("name")} (${formData.get("email")})`,
          route: "/contact",
          consentToContact: formData.get("consent") === "on",
          // Unsichtbares Feld. Menschen lassen es leer, Automaten nicht.
          website: formData.get("website") ?? "",
          ticketId: (formData.get("ticketId") as string | null)?.trim() || undefined,
        }),
      });
      const daten = (await response.json()) as { id?: string; fehler?: string };
      if (!response.ok) throw new Error(daten.fehler ?? "Unbekannter Fehler");
      setGesendet(daten.id ?? "ok");
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Die Nachricht konnte nicht gesendet werden.");
    } finally {
      setPending(false);
    }
  }

  if (gesendet) {
    return (
      <div className="grid gap-2 rounded-(--radius-md) border border-positive/25 bg-positive-soft px-4 py-3.5">
        <p className="text-sm font-medium text-positive">Angekommen.</p>
        <p className="text-sm leading-relaxed text-ink-2">
          Wir melden uns, wenn du der Kontaktaufnahme zugestimmt hast.
        </p>
        {/* Die Kennung ist die Brücke: sie nennen, und wir finden den
            Vorgang wieder. */}
        <p className="font-mono text-2xs text-ink-3">Vorgang: {gesendet.slice(0, 8)}</p>
      </div>
    );
  }

  return (
    <form action={senden} className="grid gap-4">
      {fehler && (
        <p role="alert" className="text-sm text-critical">
          {fehler}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name">
          <Input id="name" name="name" required autoComplete="name" />
        </Field>
        <Field label="E-Mail" htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </Field>
      </div>

      <Field label="Thema" htmlFor="topic">
        <select
          id="topic"
          name="topic"
          defaultValue="support"
          className="min-h-10 w-full rounded-(--radius-sm) border border-line-2 bg-inset px-3 text-sm"
        >
          {THEMEN.map(([wert, label]) => (
            <option key={wert} value={wert}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Nachricht" htmlFor="message">
        <Textarea id="message" name="message" rows={6} required minLength={10} />

        {/*
          Die Ticketnummer, falls es schon eine gibt (§25).
          Optional und ganz unten: die meisten schreiben zum ersten Mal,
          und ein Pflichtfeld für eine Nummer, die man nicht hat, ist
          eine Hürde für den Normalfall.
        */}
        <div className="grid gap-1.5">
          <label htmlFor="ticketId" className="text-sm font-medium">
            Vorgangsnummer <span className="font-normal text-ink-3">— falls vorhanden</span>
          </label>
          <input
            id="ticketId"
            name="ticketId"
            placeholder="z. B. aus einer früheren Antwort"
            className="h-11 w-full rounded-(--radius-input) bg-soft px-4 text-base text-ink outline-none placeholder:text-ink-3 focus-visible:bg-raised focus-visible:shadow-[0_0_0_2px_var(--primary)]"
          />
        </div>

        {/*
          Der Honigtopf.

          `aria-hidden` und `tabIndex={-1}` halten ihn von
          Vorlesegeräten und der Tabulatortaste fern; `hidden` wäre
          zwar kürzer, wird aber von manchen Automaten erkannt und
          übersprungen. Wer ihn ausfüllt, ist kein Mensch.
        */}
        <div aria-hidden className="absolute left-[-9999px] h-px w-px overflow-hidden">
          <label htmlFor="website">Website (bitte leer lassen)</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
      </Field>

      <label className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-2">
        <input type="checkbox" name="consent" className="mt-1 size-4 shrink-0 accent-accent" />
        <span>
          Ich bin damit einverstanden, dass ihr meine Angaben zur Bearbeitung dieser Anfrage
          verwendet und mir antwortet.
        </span>
      </label>

      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Wird gesendet …" : "Nachricht senden"}
        </Button>
      </div>
    </form>
  );
}
