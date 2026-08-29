"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmEvidence, deleteEvidence, editEvidence, rejectEvidence } from "@/lib/profile";
import { Badge, buttonClass, Card } from "@/components/ui";

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

export function EvidenceList({ items, showConfirm = false }: { items: EvidenceView[]; showConfirm?: boolean }) {
  if (items.length === 0) return null;
  return (
    <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-3)" }}>
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
      style={{
        // Kein Abblenden ueber Deckkraft: das senkt den Kontrast unter
        // die Schwelle und macht den Zustand von der Erscheinung
        // abhaengig. Den Zustand traegt das Etikett, sichtbar als Text.
        background: item.userRejected ? "var(--surface-sunken)" : "var(--surface-raised)",
        borderColor: item.userConfirmed
          ? "var(--border-subtle)"
          : item.userRejected
            ? "var(--border-default)"
            : "var(--assistant-border)",
      }}
    >
      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
          <Badge tone={source.tone}>{source.text}</Badge>
          {item.userConfirmed && <Badge tone="positive">bestätigt</Badge>}
          {item.userRejected && <Badge tone="neutral">abgelehnt</Badge>}
        </div>

        {editing ? (
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <label htmlFor={`edit-${item.id}`} className="sr-only">
              Aussage bearbeiten
            </label>
            <textarea
              id={`edit-${item.id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                padding: "var(--space-3)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                background: "var(--surface-raised)",
                fontSize: "var(--text-sm)",
                lineHeight: 1.6,
                resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button
                type="button"
                onClick={() => run(() => editEvidence(item.id, draft))}
                disabled={pending || draft.trim().length === 0}
                className={buttonClass("primary", false, "sm")}
              >
                Speichern
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(item.statement);
                  setEditing(false);
                }}
                className={buttonClass("quiet", false, "sm")}
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: "var(--text-sm)", lineHeight: 1.65 }}>{item.statement}</p>
        )}

        {item.sourceRef && (
          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            Beleg: {item.sourceRef.replace("interview:", "aus dem Gespräch, Thema ").replace(/:/g, " · ")}
          </p>
        )}

        {!editing && (
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            {showConfirm && !item.userConfirmed && !item.userRejected && (
              <button
                type="button"
                onClick={() => run(() => confirmEvidence(item.id))}
                disabled={pending}
                className={buttonClass("secondary", false, "sm")}
              >
                Stimmt
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={pending}
              className={buttonClass("quiet", false, "sm")}
            >
              Bearbeiten
            </button>
            {!item.userRejected && (
              <button
                type="button"
                onClick={() => run(() => rejectEvidence(item.id))}
                disabled={pending}
                className={buttonClass("quiet", false, "sm")}
              >
                Stimmt nicht
              </button>
            )}
            <button
              type="button"
              onClick={() => run(() => deleteEvidence(item.id))}
              disabled={pending}
              className={buttonClass("danger", false, "sm")}
            >
              Löschen
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
