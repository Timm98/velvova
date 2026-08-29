"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, magicLinkAction, type FormState } from "../actions";
import { Button, Field, Input, Separator } from "@/components/ui";
import { ErrorState } from "@/components/ui/states";

export function LoginForm({
  labels,
}: {
  labels: Record<
    | "email"
    | "password"
    | "submit"
    | "magicLink"
    | "magicLinkSent"
    | "errorInvalid"
    | "errorEmailInvalid"
    | "forgot",
    string
  >;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  const [magicState, magicAction, magicPending] = useActionState<FormState, FormData>(
    magicLinkAction,
    {},
  );

  const errorText =
    state.error === "invalid"
      ? labels.errorInvalid
      : state.error === "email_invalid"
        ? labels.errorEmailInvalid
        : null;

  return (
    <div className="grid gap-6">
      {errorText && <ErrorState title="Anmeldung fehlgeschlagen" body={errorText} />}

      {magicState.notice === "sent" && (
        <div
          role="status"
          className="rounded-[--radius-md] border border-positive/30 bg-positive-soft px-4 py-3 text-sm text-ink-2"
        >
          {labels.magicLinkSent}
        </div>
      )}

      <form action={action} className="grid gap-4">
        <Field label={labels.email} htmlFor="email" error={errorText ?? undefined}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.values?.email ?? ""}
            aria-invalid={errorText ? true : undefined}
          />
        </Field>

        <Field label={labels.password} htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>

        <Button type="submit" variant="primary" size="lg" full disabled={pending}>
          {pending ? "…" : labels.submit}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-ink-3">
        <Separator className="flex-1" />
        oder
        <Separator className="flex-1" />
      </div>

      <form action={magicAction} className="grid gap-3">
        <Field label={labels.email} htmlFor="magic-email">
          <Input id="magic-email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Button type="submit" variant="secondary" full disabled={magicPending}>
          {magicPending ? "…" : labels.magicLink}
        </Button>
      </form>

      <p className="text-center text-sm">
        <Link href="/forgot-password" className="text-ink-2 underline underline-offset-[3px]">
          {labels.forgot}
        </Link>
      </p>
    </div>
  );
}
