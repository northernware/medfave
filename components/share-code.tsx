"use client";

import { useState, useSyncExternalStore } from "react";
import { buttonClass } from "@/components/ui";

const noSubscription = () => () => {};

/**
 * Sends an activation code on through whatever the desk's device offers —
 * Viber, Messenger, SMS from the clinic's own phone — or copies it.
 *
 * The share sheet exists on phones and most tablets; a desktop browser without
 * it gets Copy only, which pastes into any chat just the same.
 */
export function ShareCode({ code, link, clinicName }: { code: string; link: string; clinicName: string }) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const message = `Your ${clinicName} activation code for Medfave is ${code}. Open this link to set up your account: ${link}`;
  // False on the server and on the first render, then the browser's answer —
  // so the markup the server sent and the first client render agree.
  const canShare = useSyncExternalStore(
    noSubscription,
    () => typeof navigator.share === "function",
    () => false,
  );

  async function copy(what: "link" | "code") {
    try {
      await navigator.clipboard.writeText(what === "link" ? message : code);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard blocked (an insecure origin, or a denied permission): the
      // code is on screen to read out instead.
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canShare ? (
        <button
          type="button"
          className={buttonClass("primary")}
          onClick={() => navigator.share({ title: "Medfave activation", text: message }).catch(() => {})}
        >
          Share…
        </button>
      ) : null}
      <button type="button" className={buttonClass(canShare ? "secondary" : "primary")} onClick={() => copy("link")}>
        {copied === "link" ? "Copied" : "Copy message"}
      </button>
      <button type="button" className={buttonClass("secondary")} onClick={() => copy("code")}>
        {copied === "code" ? "Copied" : "Copy code"}
      </button>
    </div>
  );
}
