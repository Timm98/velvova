"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Link2, Loader2 } from "lucide-react";
import { Button, Card, Textarea } from "@/components/ui";
import { Badge } from "@/components/ui";

interface Antwort {
  modus?: "imported" | "bookmark" | "failed";
  jobId?: string;
  titel?: string;
  unternehmen?: string;
  quelle?: string;
  hinweis?: string;
  fehler?: string;
  entscheidung?: string;
  grund?: string;
  url?: string;
}

/**
 * Ein Link, drei mögliche Antworten.
 *
 * Die interessante ist die mittlere: von einer nicht freigegebenen
 * Quelle wird nichts abgerufen, und das steht so da. Kein „leider
 * fehlgeschlagen", das nach einem technischen Problem klingt — es ist
 * eine Entscheidung, und die Person soll wissen, dass sie eine ist.
 *
 * Danach steht das Textfeld offen. Was sie selbst liest und einfügt,
 * bleibt ihre Sache und bleibt privat.
 */
export function ImportForm({ assistantName }: { assistantName: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [antwort, setAntwort] = useState<Antwort | null>(null);

  async function pruefen() {
    if (!url.trim()) return;
    setPending(true);
    setAntwort(null);
    try {
      const response = await fetch("/api/jobs/import-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const daten = (await response.json()) as Antwort;
      setAntwort(daten);
      if (daten.modus === "imported" && daten.jobId) {
        router.push(`/app/jobs/${daten.jobId}`);
      }
    } catch {
      setAntwort({ modus: "failed", fehler: "Die Anfrage ist fehlgeschlagen." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card className="grid gap-4">
        <div className="grid gap-1.5">
          <label htmlFor="joburl" className="text-sm font-medium">
            Adresse der Stellenanzeige
          </label>
          <p className="text-xs leading-relaxed text-ink-3">
            {assistantName} prüft zuerst, ob wir von dieser Quelle etwas abrufen dürfen. Wenn
            nicht, wird nichts abgerufen — dann kannst du den Text selbst einfügen.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <input
            id="joburl"
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") pruefen();
            }}
            placeholder="https://…"
            className="min-h-10 min-w-0 flex-1 rounded-(--radius-sm) border border-line-2 bg-inset px-3.5 text-sm outline-none focus-visible:border-accent"
          />
          <Button type="button" variant="primary" onClick={pruefen} disabled={pending || !url.trim()}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                Wird geprüft
              </>
            ) : (
              <>
                <Link2 className="size-4" strokeWidth={1.9} />
                Prüfen
              </>
            )}
          </Button>
        </div>
      </Card>

      {antwort?.modus === "bookmark" && (
        <Card className="grid gap-3.5 border-line-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="caution">nichts abgerufen</Badge>
            {antwort.quelle && (
              <span className="font-mono text-2xs uppercase tracking-wider text-ink-3">
                {antwort.quelle}
              </span>
            )}
          </div>
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            {antwort.hinweis}
          </p>
          {antwort.grund && (
            <p className="max-w-[var(--measure)] text-xs leading-relaxed text-ink-3">
              {antwort.grund}
            </p>
          )}

          <div className="grid gap-2.5 pt-1">
            <label htmlFor="jobtext" className="text-sm font-medium">
              Anzeigentext einfügen
            </label>
            <Textarea
              id="jobtext"
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Kopiere den Text der Anzeige hierher."
              className="min-h-[160px]"
            />
            <div>
              <Button
                type="button"
                variant="primary"
                disabled={text.trim().length < 40}
                onClick={() => router.push(`/app/jobs?eingefuegt=1`)}
              >
                Text analysieren
                <ArrowRight className="size-4" strokeWidth={1.9} />
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-ink-3">
              Was du einfügst, bleibt privat. Es erscheint in keiner öffentlichen Liste und wird
              keiner anderen Person gezeigt.
            </p>
          </div>
        </Card>
      )}

      {antwort?.modus === "failed" && (
        <Card className="border-critical/25">
          <p className="text-sm leading-relaxed text-ink-2">
            {antwort.fehler ?? "Der Abruf ist fehlgeschlagen."}
          </p>
        </Card>
      )}
    </div>
  );
}
