"use client";

import { useActionState } from "react";
import { magicLinkAction, type FormState } from "../actions";
import { buttonStyle, Card, Field, inputStyle, Stack } from "@/components/ui";

export function ForgotForm({ labels }: { labels: Record<"email" | "submit" | "sent", string> }) {
  const [state, action, pending] = useActionState<FormState, FormData>(magicLinkAction, {});

  return (
    <Card>
      <form action={action}>
        <Stack gap={4}>
          {state.notice === "sent" && (
            <div
              role="status"
              style={{
                background: "var(--positive-subtle)",
                border: "1px solid var(--positive)",
                color: "var(--positive)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-3) var(--space-4)",
                fontSize: "var(--text-sm)",
              }}
            >
              {labels.sent}
            </div>
          )}
          <Field label={labels.email} htmlFor="email">
            <input id="email" name="email" type="email" autoComplete="email" required style={inputStyle} />
          </Field>
          <button type="submit" disabled={pending} style={buttonStyle("primary", true)}>
            {pending ? "…" : labels.submit}
          </button>
        </Stack>
      </form>
    </Card>
  );
}
