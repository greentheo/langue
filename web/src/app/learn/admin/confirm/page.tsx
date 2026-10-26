import Link from "next/link";
import { redirect } from "next/navigation";
import { Panel } from "@/components/crt";
import { AdminConfirmForm } from "@/components/admin-confirm-form";
import { requireAdmin } from "@/lib/auth/admin";
import { adminConfirmationLive, safeReturnTo } from "@/lib/auth/admin-area";

export const metadata = { title: "Confirm your password — LANGUE" };

/**
 * Asked before any admin page without a confirmation in the last 15 minutes
 * (#119). On a shared device, being signed in as the admin isn't enough.
 */
export default async function ConfirmAdminPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const user = await requireAdmin({ confirmed: false });
  const next = safeReturnTo((await searchParams).next);
  if (adminConfirmationLive(user.adminConfirmedAt, new Date())) redirect(next);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl crt-glow">Confirm your password to continue</h1>
      <p className="mt-2 text-sm text-[var(--crt-fg-dim)]">
        Admin pages ask again, so someone else on this device can&apos;t open them. It lasts 15 minutes, or until you
        leave the admin pages.
      </p>
      <Panel className="mt-6">
        <AdminConfirmForm next={next} />
      </Panel>
      <p className="mt-4 text-xs">
        <Link href="/learn">&larr; Home</Link>
      </p>
    </div>
  );
}
