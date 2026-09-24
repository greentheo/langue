import Link from "next/link";
import { Panel } from "@/components/crt";
import { LoginForm } from "@/components/auth-forms";

export const metadata = { title: "Sign in — LANGUE" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <Link href="/" className="text-xs uppercase tracking-[0.2em] no-underline text-[var(--crt-fg-dim)]">
        &larr; Langue
      </Link>

      <h1 className="mt-4 text-2xl crt-glow">Sign in</h1>

      <Panel className="mt-6">
        <LoginForm />
      </Panel>
    </main>
  );
}
