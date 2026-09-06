"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmEvidence, deleteEvidence, editEvidence, rejectEvidence } from "@/lib/profile";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { Badge, Button, Card, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { BELEGSTUFENTEXT, belegstufe, type Belegstufe } from "@paycheck/domain";

/**
 * Eine Liste von Evidenz-Einträgen.
 *
 * Vier gleichrangige Handlungen: bestätigen, bearbeiten, ablehnen,
 * löschen. Bewusst kein hervorgehobenes "Bestätigen" - das Produkt
 * soll nicht in eine Richtung drängen, die dem Menschen später im
 * Bewerbungsgespräch um die Ohren fliegt.
 */

export interface EvidenceView {
  id: string;
  statement: string;
  sourceType: string;
  sourceRef: string | null;
  confidence: number;
  userConfirmed: boolean;
  userRejected: boolean;
  type: string;
}

const SOURCE_LABEL: Record<string, { text: string; tone: "positive" | "assistant" | "neutral" | "caution" }> = {
  user_stated: { text: "von dir gesagt", tone: "neutral" },
  user_confirmed: { text: "von dir bestätigt", tone: "positive" },
  document_extract: { text: "aus deinen Unterlagen", tone: "neutral" },
  ai_hypothesis: { text: "Vermutung", tone: "assistant" },
  external_source: { text: "externe Quelle", tone: "caution" },
  work_sample: { text: "aus einer Kurzaufgabe", tone: "neutral" },
};

/**
 * Wie stark der Beleg trägt — als zweites Etikett neben der Herkunft.
 *
 * ── Warum die Herkunft dafür nicht reicht ─────────────────────
 *
 * Die Herkunft sagt, WOHER eine Aussage kommt. Sie sagt nicht, was
 * sie wert ist. „aus einer Kurzaufgabe" stand hier in demselben
 * neutralen Ton wie „von dir gesagt" — dabei ist das eine beobachtet
 * und das andere behauptet. Wer beides gleich darstellt, macht die
 * Unterscheidung wieder zunichte, für die es die Arbeitsproben gibt.
 */
const STUFENTON: Record<Belegstufe, "positive" | "assistant" | "neutral" | "caution"> = {
  beobachtet: "positive",
  bestaetigt: "positive",
  berichtet: "assistant",
  behauptet: "neutral",
};

export function EvidenceList({ items, showConfirm = false }: { items: EvidenceView[]; showConfirm?: boolean }) {
  if (items.length === 0) return null;
  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <EvidenceRow key={item.id} item={item} showConfirm={showConfirm} />
      ))}
    </ul>
  );
}

function EvidenceRow({ item, showConfirm }: { item: EvidenceView; showConfirm: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.statement);

  const source = SOURCE_LABEL[item.sourceType] ?? { text: item.sourceType, tone: "neutral" as const };
  const stufe = belegstufe(item.sourceType, item.userConfirmed, item.sourceRef);

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <Card
      as="li"
      padded={false}
      className={cn(
        "p-5",
        // Kein Abblenden über Deckkraft: das senkt den Kontrast unter die
        // Schwelle und macht den Zustand von der Erscheinung abhängig.
        // Den Zustand trägt das Etikett, sichtbar als Text.
        item.userRejected
          ? "bg-sunken shadow-none"
          : item.userConfirmed
            ? "border-line"
            : "border-assistant-border",
      )}
    >
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STUFENTON[stufe]}>{BELEGSTUFENTEXT[stufe].wort}</Badge>
          <Badge tone={source.tone}>{source.text}</Badge>
          {item.userConfirmed && <Badge tone="positive">bestätigt</Badge>}
          {item.userRejected && <Badge tone="neutral">abgelehnt</Badge>}
        </div>

        {editing ? (
          <div className="grid gap-3">
            <label htmlFor={`edit-${item.id}`} className="sr-only">
              Aussage bearbeiten
            </label>
            <Textarea
              id={`edit-${item.id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => run(() => editEvidence(item.id, draft))}
                disabled={pending || draft.trim().length === 0}
              >
                Speichern
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(item.statement);
                  setEditing(false);
                }}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed">{item.statement}</p>
        )}

        {item.sourceRef && (
          <p className="text-xs leading-relaxed text-ink-3">
            Beleg:{" "}
            {item.sourceRef.replace("interview:", "aus dem Gespräch, Thema ").replace(/:/g, " · ")}
          </p>
        )}

        {!editing && (
          <div className="flex flex-wrap gap-2">
            {showConfirm && !item.userConfirmed && !item.userRejected && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => run(() => confirmEvidence(item.id))}
                disabled={pending}
              >
                <Check className="size-3.5 text-positive" strokeWidth={2.4} />
                Stimmt
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
              disabled={pending}
            >
              <Pencil className="size-3.5" strokeWidth={1.9} />
              Bearbeiten
            </Button>
            {!item.userRejected && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => run(() => rejectEvidence(item.id))}
                disabled={pending}
              >
                <X className="size-3.5" strokeWidth={2.2} />
                Stimmt nicht
              </Button>
            )}
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => run(() => deleteEvidence(item.id))}
              disabled={pending}
              className="ml-auto"
            >
              <Trash2 className="size-3.5" strokeWidth={1.9} />
              Löschen
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
