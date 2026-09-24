import Link from "next/link";
import { Panel } from "@/components/crt";
import { RegisterForm } from "@/components/auth-forms";

export const metadata = { title: "Create account — LANGUE" };

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <Link href="/" className="text-xs uppercase tracking-[0.2em] no-underline text-[var(--crt-fg-dim)]">
        &larr; Langue
      </Link>

      <h1 className="mt-4 text-2xl crt-glow">Create account</h1>
      <p className="mt-1 text-sm text-[var(--crt-fg-dim)]">
        Registration is invite-only.
      </p>

      <Panel className="mt-6">
        <RegisterForm />
      </Panel>
    </main>
  );
}
