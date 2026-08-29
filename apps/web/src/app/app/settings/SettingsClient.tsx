"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAccount, exportData, setConsent, signOutDevice } from "@/lib/privacy";
import { Badge, buttonStyle, Card, Stack } from "@/components/ui";

/** Einwilligungen einzeln schalten. Der Widerruf wirkt sofort. */
export function ConsentToggles({
  state,
  texts,
}: {
  state: Record<string, boolean>;
  texts: Record<string, { title: string; body: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-5)" }}>
      {Object.entries(texts).map(([kind, text]) => {
        const granted = state[kind] ?? false;
        return (
          <li key={kind}>
            <label
              htmlFor={`consent-${kind}`}
              style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "var(--space-3)", cursor: "pointer", alignItems: "start" }}
            >
              <input
                id={`consent-${kind}`}
                type="checkbox"
                checked={granted}
                disabled={pending}
                onChange={(e) => {
                  const next = e.target.checked;
                  setBusy(kind);
                  startTransition(async () => {
                    await setConsent(kind as never, next);
                    setBusy(null);
                    router.refresh();
                  });
                }}
                style={{ width: 20, height: 20, marginTop: 3 }}
              />
              <div>
                <span style={{ fontWeight: 500, display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
                  {text.title}
                  {granted ? <Badge tone="positive">erteilt</Badge> : <Badge tone="neutral">nicht erteilt</Badge>}
                  {busy === kind && <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>…</span>}
                </span>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: 2 }}>
                  {text.body}
                </p>
              </div>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/** Angemeldete Geraete. Jede Sitzung einzeln beendbar. */
export function DeviceList({
  sessions,
}: {
  sessions: { id: string; deviceLabel: string; lastSeenAt: string; isCurrent: boolean }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (sessions.length === 0) {
    return <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>Keine aktiven Sitzungen.</p>;
  }

  return (
    <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-3)" }}>
      {sessions.map((s) => (
        <li
          key={s.id}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}
        >
          <span style={{ fontSize: "var(--text-sm)" }}>
            <strong>{s.deviceLabel}</strong>
            {s.isCurrent && <Badge tone="positive"> dieses Geraet</Badge>}
            <br />
            <span style={{ color: "var(--text-muted)" }}>
              zuletzt aktiv {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(s.lastSeenAt))}
            </span>
          </span>
          {!s.isCurrent && (
            <button
              type="button"
              className="compact"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await signOutDevice(s.id);
                  router.refresh();
                })
              }
              style={{ ...buttonStyle("quiet"), padding: "var(--space-2) var(--space-4)" }}
            >
              Abmelden
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Export. Die Datei entsteht im Browser aus den Serverdaten - sie wird
 * nirgends zwischengespeichert.
 */
export function ExportButton({ label }: { label: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  return (
    <div style={{ display: "grid", gap: "var(--space-2)" }}>
      <div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const json = await exportData();
              const blob = new Blob([json], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `paycheck-export-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              setDone(true);
            })
          }
          style={buttonStyle("secondary")}
        >
          {pending ? "…" : label}
        </button>
      </div>
      {done && (
        <p role="status" style={{ fontSize: "var(--text-sm)", color: "var(--positive)" }}>
          Export heruntergeladen.
        </p>
      )}
    </div>
  );
}

/**
 * Kontoloeschung.
 *
 * Bewusst mit Tippbestaetigung statt mit einem Knopf. Und die Beschreibung
 * sagt, was tatsaechlich passiert - nicht mehr.
 */
export function DangerZone({ title, body }: { title: string; body: string }) {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card style={{ borderColor: "var(--critical)" }}>
      <Stack gap={4}>
        <div>
          <h3 style={{ fontSize: "var(--text-base)", color: "var(--critical)" }}>{title}</h3>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: "var(--space-2)", maxWidth: "var(--measure)" }}>
            {body} Deine Inhalte werden sofort unzugaenglich; die endgueltige Entfernung erfolgt
            durch einen nachgelagerten Loeschlauf. Diesen Ablauf nennen wir dir, statt
            &bdquo;sofort und unwiederbringlich&ldquo; zu behaupten.
          </p>
        </div>

        <div style={{ display: "grid", gap: "var(--space-2)", maxWidth: 320 }}>
          <label htmlFor="delete-confirm" style={{ fontSize: "var(--text-sm)" }}>
            Tippe <strong>loeschen</strong> zur Bestaetigung
          </label>
          <input
            id="delete-confirm"
            type="text"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            aria-invalid={error ? true : undefined}
            style={{
              minHeight: 44,
              padding: "var(--space-3) var(--space-4)",
              border: `1px solid ${error ? "var(--critical)" : "var(--border-default)"}`,
              borderRadius: "var(--radius-md)",
              background: "var(--surface-raised)",
              fontSize: "var(--text-base)",
            }}
          />
          {error && (
            <p role="alert" style={{ fontSize: "var(--text-sm)", color: "var(--critical)" }}>
              {error}
            </p>
          )}
        </div>

        <div>
          <button
            type="button"
            disabled={pending || confirmation.trim().toLowerCase() !== "loeschen"}
            onClick={() =>
              startTransition(async () => {
                const r = await deleteAccount(confirmation);
                if (!r.ok) setError(r.message);
              })
            }
            style={{
              ...buttonStyle("danger"),
              opacity: confirmation.trim().toLowerCase() === "loeschen" ? 1 : 0.5,
              cursor: confirmation.trim().toLowerCase() === "loeschen" ? "pointer" : "not-allowed",
            }}
          >
            {pending ? "…" : title}
          </button>
        </div>
      </Stack>
    </Card>
  );
}
