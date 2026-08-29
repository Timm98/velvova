"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmProfile, confirmRoleCluster } from "@/lib/profile";
import { Badge, buttonStyle, Card, Stack } from "@/components/ui";

/** Bestaetigung des Gesamtprofils. Schaltet personalisierte Jobs frei. */
export function ConfirmProfileButton({
  alreadyConfirmed,
  label,
}: {
  alreadyConfirmed: boolean;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (alreadyConfirmed) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <Badge tone="positive">bestaetigt</Badge>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          Deine Vorschlaege sind freigeschaltet. Aenderungen wirken sofort.
        </span>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          startTransition(async () => {
            await confirmProfile();
            router.push("/app/jobs");
          })
        }
        disabled={pending}
        style={buttonStyle("primary")}
      >
        {pending ? "…" : label}
      </button>
    </div>
  );
}

const KIND_LABEL: Record<string, { text: string; tone: "neutral" | "assistant" | "accent" }> = {
  obvious: { text: "naheliegend", tone: "neutral" },
  adjacent: { text: "angrenzend", tone: "assistant" },
  niche: { text: "weniger naheliegend", tone: "accent" },
};

const REALISM_LABEL: Record<string, string> = {
  direct: "Einstieg direkt moeglich",
  with_bridge: "Einstieg ueber einen Zwischenschritt",
  longer_path: "laengerer Weg",
  unclear: "Einschaetzung offen",
};

export function RoleClusterCard({
  cluster,
}: {
  cluster: {
    id: string;
    title: string;
    rationale: string;
    kind: string;
    gaps: string[];
    criticalConstraints: string[];
    entryRealism: string;
    nextValidationStep: string;
    userConfirmed: boolean;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const kind = KIND_LABEL[cluster.kind] ?? KIND_LABEL.obvious!;

  return (
    <Card as="li">
      <Stack gap={4}>
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
          <h3 style={{ fontSize: "var(--text-lg)" }}>{cluster.title}</h3>
          <Badge tone={kind.tone}>{kind.text}</Badge>
          {cluster.userConfirmed && <Badge tone="positive">verfolgst du</Badge>}
        </div>

        <p style={{ color: "var(--text-secondary)", maxWidth: "var(--measure)" }}>{cluster.rationale}</p>

        <dl style={{ display: "grid", gap: "var(--space-3)", fontSize: "var(--text-sm)", margin: 0 }}>
          <div>
            <dt style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)", textTransform: "uppercase" }}>
              Realismus
            </dt>
            <dd style={{ margin: 0 }}>{REALISM_LABEL[cluster.entryRealism] ?? cluster.entryRealism}</dd>
          </div>

          {cluster.gaps.length > 0 && (
            <div>
              <dt style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)", textTransform: "uppercase" }}>
                Was noch fehlt
              </dt>
              <dd style={{ margin: 0 }}>
                <ul style={{ listStyle: "none", display: "grid", gap: 4 }}>
                  {cluster.gaps.map((g) => (
                    <li key={g}>· {g}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}

          {cluster.criticalConstraints.length > 0 && (
            <div>
              <dt style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)", textTransform: "uppercase" }}>
                Kritische Bedingungen
              </dt>
              <dd style={{ margin: 0 }}>{cluster.criticalConstraints.join(" · ")}</dd>
            </div>
          )}

          <div>
            <dt style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)", textTransform: "uppercase" }}>
              Naechster Schritt zur Ueberpruefung
            </dt>
            <dd style={{ margin: 0 }}>{cluster.nextValidationStep}</dd>
          </div>
        </dl>

        <div>
          <button
            type="button"
            className="compact"
            onClick={() =>
              startTransition(async () => {
                await confirmRoleCluster(cluster.id, !cluster.userConfirmed);
                router.refresh();
              })
            }
            disabled={pending}
            style={{ ...buttonStyle(cluster.userConfirmed ? "quiet" : "secondary"), padding: "var(--space-2) var(--space-4)" }}
          >
            {cluster.userConfirmed ? "Nicht mehr verfolgen" : "Diese Richtung verfolgen"}
          </button>
        </div>
      </Stack>
    </Card>
  );
}
