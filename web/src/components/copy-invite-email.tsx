"use client";

/**
 * "Copy invite email" button for one invite code.
 *
 * Builds the text in the browser so the link uses whatever origin the admin is
 * actually looking at — the Railway domain today, a custom domain later — with
 * no server-side config to keep in sync. If the clipboard is unavailable
 * (insecure context, denied permission), the text appears in a selected
 * textarea instead so it can still be copied by hand.
 */

import { useEffect, useRef, useState } from "react";
import { buildInviteEmail, type InviteEmailInput } from "@/lib/invite-email";

type Props = Omit<InviteEmailInput, "origin">;

export function CopyInviteEmail(props: Props) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state !== "copied") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (state === "manual") textareaRef.current?.select();
  }, [state]);

  async function copy() {
    const email = buildInviteEmail({ ...props, origin: window.location.origin });
    setText(email.text);

    try {
      await navigator.clipboard.writeText(email.text);
      setState("copied");
    } catch {
      setState("manual");
    }
  }

  return (
    <div className="w-full">
      <button type="button" onClick={() => void copy()} className="crt-button text-xs">
        {state === "copied" ? "Copied ✓" : "Copy invite email"}
      </button>

      {state === "manual" ? (
        <div className="mt-3">
          <p className="text-xs text-[var(--crt-fg-dim)]">
            Couldn&apos;t reach the clipboard. Copy this by hand (Ctrl/Cmd+C):
          </p>
          <textarea
            ref={textareaRef}
            readOnly
            value={text}
            rows={14}
            className="crt-input mt-2 text-xs"
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      ) : null}
    </div>
  );
}
