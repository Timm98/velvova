"use client";

import { useActionState } from "react";
import { registerAction, type FormState } from "../actions";
import { Button, Field, Input } from "@/components/ui";
import { ErrorState } from "@/components/ui/states";

export function RegisterForm({
  labels,
}: {
  labels: Record<
    | "email"
    | "password"
    | "passwordHint"
    | "submit"
    | "errorEmailTaken"
    | "errorPasswordShort"
    | "errorEmailInvalid",
    string
  >;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(registerAction, {});

  const emailError =
    state.error === "email_taken"
      ? labels.errorEmailTaken
      : state.error === "email_invalid"
        ? labels.errorEmailInvalid
        : undefined;
  const passwordError = state.error === "password_short" ? labels.errorPasswordShort : undefined;
  const summary = emailError ?? passwordError;

  return (
    <form action={action} className="grid gap-4">
      {summary && <ErrorState title="Das hat nicht geklappt" body={summary} />}

      <Field label={labels.email} htmlFor="email" error={emailError}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email ?? ""}
          aria-invalid={emailError ? true : undefined}
        />
      </Field>

      <Field
        label={labels.password}
        htmlFor="password"
        hint={labels.passwordHint}
        error={passwordError}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          aria-describedby="password-hint"
          aria-invalid={passwordError ? true : undefined}
        />
      </Field>

      <Button type="submit" variant="primary" size="lg" full disabled={pending}>
        {pending ? "…" : labels.submit}
      </Button>
    </form>
  );
}
