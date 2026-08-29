"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, magicLinkAction, type FormState } from "../actions";
import { buttonStyle, Card, Field, inputStyle, Stack } from "@/components/ui";

/**
 * Anmeldung. Zwei Wege im selben Formular: Passwort oder Link per E-Mail.
 * Fehler stehen am Feld UND als Zusammenfassung oben - beides verlangt
 * WCAG 2.2, und beides hilft.
 */
export function LoginForm({
  labels,
}: {
  labels: Record<
    "email" | "password" | "submit" | "magicLink" | "magicLinkSent" | "errorInvalid" | "errorEmailInvalid" | "forgot",
    string
  >;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  const [magicState, magicAction, magicPending] = useActionState<FormState, FormData>(magicLinkAction, {});

  const errorText =
    state.error === "invalid"
      ? labels.errorInvalid
      : state.error === "email_invalid"
        ? labels.errorEmailInvalid
        : null;

  return (
    <Card>
      <Stack gap={5}>
        {errorText && (
          <div
            role="alert"
            style={{
              background: "var(--critical-subtle)",
              border: "1px solid var(--critical)",
              color: "var(--critical)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-3) var(--space-4)",
              fontSize: "var(--text-sm)",
            }}
          >
            {errorText}
          </div>
        )}

        {magicState.notice === "sent" && (
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
            {labels.magicLinkSent}
          </div>
        )}

        <form action={action}>
          <Stack gap={4}>
            <Field label={labels.email} htmlFor="email" error={errorText ?? undefined}>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                defaultValue={state.values?.email ?? ""}
                aria-invalid={errorText ? true : undefined}
                style={inputStyle}
              />
            </Field>

            <Field label={labels.password} htmlFor="password">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                style={inputStyle}
              />
            </Field>

            <button type="submit" disabled={pending} style={buttonStyle("primary", true)}>
              {pending ? "…" : labels.submit}
            </button>
          </Stack>
        </form>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            color: "var(--text-muted)",
            fontSize: "var(--text-xs)",
          }}
        >
          <span style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
          oder
          <span style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
        </div>

        <form action={magicAction}>
          <Stack gap={3}>
            <Field label={labels.email} htmlFor="magic-email">
              <input id="magic-email" name="email" type="email" autoComplete="email" required style={inputStyle} />
            </Field>
            <button type="submit" disabled={magicPending} style={buttonStyle("secondary", true)}>
              {magicPending ? "…" : labels.magicLink}
            </button>
          </Stack>
        </form>

        <p style={{ textAlign: "center", fontSize: "var(--text-sm)" }}>
          <Link href="/forgot-password" style={{ color: "var(--text-secondary)" }}>
            {labels.forgot}
          </Link>
        </p>
      </Stack>
    </Card>
  );
}
