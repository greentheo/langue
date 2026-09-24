"use client";

/**
 * Login and registration forms.
 *
 * `useActionState` drives both: the server action is the single source of
 * validation, and the pending state comes from the form status rather than
 * hand-rolled loading flags.
 */

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { login, register, type AuthFormState } from "@/lib/auth/actions";
import { ErrorBox } from "@/components/crt";

const EMPTY: AuthFormState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="crt-button crt-button-primary w-full" disabled={pending}>
      {pending ? "Working…" : label}
    </button>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="crt-error mt-1">{errors[0]}</p>;
}

export function LoginForm() {
  const [state, formAction] = useActionState(login, EMPTY);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <ErrorBox title="Denied" message={state.error} /> : null}

      <div>
        <label className="crt-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email ?? ""}
          className="crt-input"
        />
        <FieldError errors={state.fieldErrors?.email} />
      </div>

      <div>
        <label className="crt-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="crt-input"
        />
        <FieldError errors={state.fieldErrors?.password} />
      </div>

      <SubmitButton label="Sign in" />

      <p className="text-xs text-[var(--crt-fg-dim)]">
        Have an invite code?{" "}
        <Link href="/register">Create an account</Link>.
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(register, EMPTY);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <ErrorBox title="Denied" message={state.error} /> : null}

      <div>
        <label className="crt-label" htmlFor="inviteCode">
          Invite code
        </label>
        <input
          id="inviteCode"
          name="inviteCode"
          required
          placeholder="XXXX-XXXX-XXXX"
          autoComplete="off"
          spellCheck={false}
          defaultValue={state.values?.inviteCode ?? ""}
          className="crt-input uppercase tracking-[0.2em]"
        />
        <FieldError errors={state.fieldErrors?.inviteCode} />
      </div>

      <div>
        <label className="crt-label" htmlFor="displayName">
          Name
        </label>
        <input
          id="displayName"
          name="displayName"
          required
          autoComplete="name"
          defaultValue={state.values?.displayName ?? ""}
          className="crt-input"
        />
        <FieldError errors={state.fieldErrors?.displayName} />
      </div>

      <div>
        <label className="crt-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={state.values?.email ?? ""}
          className="crt-input"
        />
        <FieldError errors={state.fieldErrors?.email} />
      </div>

      <div>
        <label className="crt-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={10}
          className="crt-input"
        />
        <p className="mt-1 text-xs text-[var(--crt-fg-dim)]">At least 10 characters.</p>
        <FieldError errors={state.fieldErrors?.password} />
      </div>

      <SubmitButton label="Create account" />

      <p className="text-xs text-[var(--crt-fg-dim)]">
        Already registered? <Link href="/login">Sign in</Link>.
      </p>
    </form>
  );
}
