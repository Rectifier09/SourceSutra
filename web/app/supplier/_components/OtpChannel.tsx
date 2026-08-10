"use client";

import { useEffect, useState } from "react";
import { verifyIdentityChannel } from "@/app/supplier/actions";

// BP-1 simulated OTP: "Send code" reveals a fake code + countdown; "Verify" posts the
// RESULT to set_identity_check (via the server action). No real provider — INT-2 at BP-2.
export function OtpChannel({
  channel,
  label,
  hint,
  verified,
  last4,
}: {
  channel: "email" | "phone" | "aadhaar";
  label: string;
  hint: string;
  verified: boolean;
  last4?: string | null;
}) {
  const [sent, setSent] = useState(false);
  const [code] = useState(() => String(Math.floor(100000 + Math.random() * 900000)));
  const [seconds, setSeconds] = useState(0);
  const [aadhaar, setAadhaar] = useState("");

  useEffect(() => {
    if (!sent || seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [sent, seconds]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/10 px-3 py-2.5 text-sm dark:border-white/10">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-xs text-black/50 dark:text-white/50">
          {verified ? `Verified${last4 ? ` · Aadhaar ••••${last4}` : ""}` : hint}
        </div>
      </div>

      {verified ? (
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          ✓ Verified
        </span>
      ) : !sent ? (
        <button
          type="button"
          onClick={() => {
            setSent(true);
            setSeconds(30);
          }}
          className="rounded-md border border-black/15 px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Send code
        </button>
      ) : (
        <form action={verifyIdentityChannel} className="flex items-center gap-2">
          <input type="hidden" name="channel" value={channel} />
          {channel === "aadhaar" && (
            <input type="hidden" name="last4" value={(aadhaar || "0000").slice(-4)} />
          )}
          <span className="rounded bg-black/5 px-2 py-1 font-mono text-xs tabular-nums dark:bg-white/10">
            code {code}
          </span>
          {channel === "aadhaar" && (
            <input
              value={aadhaar}
              onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))}
              placeholder="Aadhaar no."
              inputMode="numeric"
              className="w-28 rounded-md border border-black/15 px-2 py-1 text-xs dark:border-white/20 dark:bg-transparent"
            />
          )}
          <input
            defaultValue={code}
            className="w-20 rounded-md border border-black/15 px-2 py-1 font-mono text-xs tabular-nums dark:border-white/20 dark:bg-transparent"
          />
          <button className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/85">
            Verify
          </button>
          {seconds > 0 && (
            <span className="text-xs tabular-nums text-black/40 dark:text-white/40">{seconds}s</span>
          )}
        </form>
      )}
    </div>
  );
}
