"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAdminArea } from "@/lib/auth/admin-area";

/** Tell the server the admin confirmation should end. A beacon, so it's sent even as the page goes away. */
function leave() {
  navigator.sendBeacon("/api/session/admin-leave");
}

/**
 * For admins, in the learn layout (#119). Ends the admin confirmation when
 * the admin pages are left by a link (the server sees full page loads itself,
 * app/learn/layout.tsx) or hidden: the screen locks, another app comes
 * forward, the tab changes. When the page shows again it reloads, so an
 * admin page left open asks for the password instead of showing its data.
 * Best effort: the fixed 15 minutes is the backstop.
 */
export function AdminWatch() {
  const pathname = usePathname();
  const router = useRouter();
  const previous = useRef(pathname);

  useEffect(() => {
    if (isAdminArea(previous.current) && !isAdminArea(pathname)) leave();
    previous.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const onVisibility = () => {
      if (!isAdminArea(window.location.pathname)) return;
      if (document.visibilityState === "hidden") leave();
      else router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [router]);

  return null;
}
