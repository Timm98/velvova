"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { confirmProfile, confirmRoleCluster } from "@/lib/profile";
import { Badge, Button, Card, Separator } from "@/components/ui";

/** Bestätigung des Gesamtprofils. Schaltet personalisierte Jobs frei. */
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
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="positive">
          <Check className="size-3" strokeWidth={2.6} />
          bestätigt
        </Badge>
        <span className="text-sm text-ink-2">
          Deine Vorschläge sind freigeschaltet. Änderungen wirken sofort.
        </span>
      </div>
    );
  }

  return (
    <div>
      <Button
        type="button"
        variant="primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await confirmProfile();
            router.push("/app/jobs");
          })
        }
      >
        {pending ? "Wird bestätigt …" : label}
        {!pending && <ArrowRight className="size-4" strokeWidth={1.9} />}
      </Button>
    </div>
  );
}

const KIND_LABEL: Record<string, { text: string; tone: "neutral" | "assistant" | "accent" }> = {
  obvious: { text: "naheliegend", tone: "neutral" },
  adjacent: { text: "angrenzend", tone: "assistant" },
  niche: { text: "weniger naheliegend", tone: "accent" },
};

const REALISM_LABEL: Record<string, string> = {
  direct: "Einstieg direkt möglich",
  with_bridge: "Einstieg über einen Zwischenschritt",
  longer_path: "längerer Weg",
  unclear: "Einschätzung offen",
};

/**
 * Ein Rollencluster.
 *
 * Die Angaben stehen als Beschreibungsliste, nicht als Fließtext: was
 * fehlt und welche Bedingung kritisch ist, muss man beim Überfliegen
 * finden können — das ist der Teil, der eine Entscheidung trägt.
 */
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
    <Card as="li" className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-semibold">{cluster.title}</h3>
        <Badge tone={kind.tone}>{kind.text}</Badge>
        {cluster.userConfirmed && <Badge tone="positive">verfolgst du</Badge>}
      </div>

      <p className="max-w-[var(--measure)] leading-relaxed text-ink-2">{cluster.rationale}</p>

      <Separator soft />

      <dl className="grid gap-4 sm:grid-cols-2">
        <Fact label="Realismus">{REALISM_LABEL[cluster.entryRealism] ?? cluster.entryRealism}</Fact>

        <Fact label="Nächster Schritt zur Überprüfung">{cluster.nextValidationStep}</Fact>

        {cluster.gaps.length > 0 && (
          <Fact label="Was noch fehlt">
            <ul className="grid gap-1">
              {cluster.gaps.map((g) => (
                <li key={g} className="flex gap-2">
                  <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-ink-3" />
                  {g}
                </li>
              ))}
            </ul>
          </Fact>
        )}

        {cluster.criticalConstraints.length > 0 && (
          <Fact label="Kritische Bedingungen">{cluster.criticalConstraints.join(" · ")}</Fact>
        )}
      </dl>

      <div>
        <Button
          type="button"
          variant={cluster.userConfirmed ? "ghost" : "secondary"}
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await confirmRoleCluster(cluster.id, !cluster.userConfirmed);
              router.refresh();
            })
          }
        >
          {cluster.userConfirmed ? "Nicht mehr verfolgen" : "Diese Richtung verfolgen"}
        </Button>
      </div>
    </Card>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs font-medium uppercase tracking-wider text-ink-3">{label}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-ink-2">{children}</dd>
    </div>
  );
}
