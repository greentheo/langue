import Link from "next/link";
import { Panel } from "@/components/crt";
import { RegisterForm } from "@/components/auth-forms";

export const metadata = { title: "Create account — LANGUE" };

/**
 * Invite links arrive as /register?code=XXXX-XXXX-XXXX. Only the code's own
 * alphabet survives, so the query string cannot inject anything odd into the
 * field; the server still validates whatever is submitted.
 */
function codeFromQuery(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").toUpperCase().replace(/[^0-9A-Z-]/g, "").slice(0, 32);
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const initialCode = codeFromQuery((await searchParams).code);

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
        <RegisterForm initialCode={initialCode} />
      </Panel>
    </main>
  );
}
