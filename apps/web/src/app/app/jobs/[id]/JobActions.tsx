"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startApplication, toggleSaveJob } from "@/lib/jobActions";
import { buttonStyle } from "@/components/ui";

/**
 * Die Handlungen an einer Stelle. Eine primäre - Bewerbung vorbereiten -
 * und daneben die leiseren.
 *
 * "Vorbereiten" legt eine Bewerbung im Zustand "In Vorbereitung" an.
 * Versendet wird dabei nichts; das geschieht ausschließlich nach einer
 * ausdrücklichen Bestätigung im Studio.
 */
export function JobActions({
  jobId,
  blocked,
  labels,
}: {
  jobId: string;
  blocked: boolean;
  labels: Record<"prepare" | "save" | "saved" | "discuss", string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
      <button
        type="button"
        onClick={() =>
          startTransition(async () => {
            const id = await startApplication(jobId);
            router.push(`/app/applications/${id}`);
          })
        }
        disabled={pending}
        style={buttonStyle("primary")}
      >
        {pending ? "…" : labels.prepare}
      </button>

      <button
        type="button"
        aria-pressed={saved}
        onClick={() =>
          startTransition(async () => {
            const r = await toggleSaveJob(jobId);
            setSaved(r.saved);
          })
        }
        disabled={pending}
        style={buttonStyle("secondary")}
      >
        {saved ? `✓ ${labels.saved}` : labels.save}
      </button>

      <a href="/app/nina" style={buttonStyle("quiet")}>
        {labels.discuss}
      </a>

      {blocked && (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", width: "100%" }}>
          Diese Stelle widerspricht einer deiner harten Bedingungen. Du kannst dich trotzdem
          bewerben — die Entscheidung liegt bei dir, nicht bei uns.
        </p>
      )}
    </div>
  );
}
