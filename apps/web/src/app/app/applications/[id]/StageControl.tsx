"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateApplicationStage } from "@/lib/jobActions";

/** Der Stand der Bewerbung. Der Mensch pflegt ihn selbst. */
export function StageControl({
  applicationId,
  current,
  labels,
}: {
  applicationId: string;
  current: string;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
      <label htmlFor="stage" style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
        Stand
      </label>
      <select
        id="stage"
        value={current}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            await updateApplicationStage(applicationId, next as never);
            router.refresh();
          });
        }}
        style={{
          minHeight: 40,
          padding: "var(--space-2) var(--space-3)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)",
          background: "var(--surface-raised)",
          fontSize: "var(--text-sm)",
        }}
      >
        {Object.entries(labels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </span>
  );
}
