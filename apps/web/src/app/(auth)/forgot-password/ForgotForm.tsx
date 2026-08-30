"use client";

import { useActionState } from "react";
import { magicLinkAction, type FormState } from "../actions";
import { Button, Field, Input } from "@/components/ui";

export function ForgotForm({ labels }: { labels: Record<"email" | "submit" | "sent", string> }) {
  const [state, action, pending] = useActionState<FormState, FormData>(magicLinkAction, {});

  return (
    <form action={action} className="grid gap-4">
      {state.notice === "sent" && (
        <div
          role="status"
          className="rounded-(--radius-md) border border-positive/30 bg-positive-soft px-4 py-3 text-sm text-ink-2"
        >
          {labels.sent}
        </div>
      )}
      <Field label={labels.email} htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" variant="primary" size="lg" full disabled={pending}>
        {pending ? "…" : labels.submit}
      </Button>
    </form>
  );
}
