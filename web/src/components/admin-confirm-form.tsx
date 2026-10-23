"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { confirmAdmin, type ConfirmState } from "@/lib/auth/admin-actions";
import { ErrorBox } from "@/components/crt";

const EMPTY: ConfirmState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="crt-button crt-button-primary w-full" disabled={pending}>
      {pending ? "Working…" : "Continue"}
    </button>
  );
}

/** The admin's password, asked again before an admin page (#119). */
export function AdminConfirmForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(confirmAdmin, EMPTY);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {state.error ? <ErrorBox title="Denied" message={state.error} /> : null}
      <div>
        <label className="crt-label" htmlFor="password">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus className="crt-input" />
      </div>
      <SubmitButton />
    </form>
  );
}
