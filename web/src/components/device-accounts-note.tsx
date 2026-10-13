import Link from "next/link";
import type { DeviceAccount } from "@/lib/auth/session";

/**
 * Shown on the sign-in and sign-up screens when someone is already signed in
 * on this device: the new learner is added alongside them, not instead of them.
 */
export function DeviceAccountsNote({ accounts }: { accounts: DeviceAccount[] }) {
  if (accounts.length === 0) return null;

  const names = accounts.map((account) => account.displayName);
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

  return (
    <p className="mt-3 border-l-2 border-[var(--crt-accent)] pl-3 text-sm">
      {list} {names.length === 1 ? "is" : "are"} signed in on this device and will stay signed in.
      You&apos;ll be added as another learner — switch between learners by tapping the name at the
      top of the screen. <Link href="/accounts">Back to learners</Link>
    </p>
  );
}
