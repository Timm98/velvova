"use client";

import { useActionState } from "react";
import { registerAction, type FormState } from "../actions";
import { buttonStyle, Card, Field, inputStyle, Stack } from "@/components/ui";

export function RegisterForm({
  labels,
}: {
  labels: Record<
    "email" | "password" | "passwordHint" | "submit" | "errorEmailTaken" | "errorPasswordShort" | "errorEmailInvalid",
    string
  >;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(registerAction, {});

  const errorFor = (field: "email" | "password"): string | undefined => {
    if (field === "email" && state.error === "email_taken") return labels.errorEmailTaken;
    if (field === "email" && state.error === "email_invalid") return labels.errorEmailInvalid;
    if (field === "password" && state.error === "password_short") return labels.errorPasswordShort;
    return undefined;
  };

  const summary = errorFor("email") ?? errorFor("password");

  return (
    <Card>
      <form action={action}>
        <Stack gap={4}>
          {summary && (
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
              {summary}
            </div>
          )}

          <Field label={labels.email} htmlFor="email" error={errorFor("email")}>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={state.values?.email ?? ""}
              aria-invalid={errorFor("email") ? true : undefined}
              style={inputStyle}
            />
          </Field>

          <Field
            label={labels.password}
            htmlFor="password"
            hint={labels.passwordHint}
            error={errorFor("password")}
          >
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              aria-describedby="password-hint"
              aria-invalid={errorFor("password") ? true : undefined}
              style={inputStyle}
            />
          </Field>

          <button type="submit" disabled={pending} style={buttonStyle("primary", true)}>
            {pending ? "…" : labels.submit}
          </button>
        </Stack>
      </form>
    </Card>
  );
}
