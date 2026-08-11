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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2.5 text-[14px]">
      <div>
        <div className="font-semibold text-ink">{label}</div>
        <div className="text-[12px] text-muted">
          {verified ? `Verified${last4 ? ` · Aadhaar ••••${last4}` : ""}` : hint}
        </div>
      </div>

      {verified ? (
        <span className="rounded-full bg-sagebg px-2.5 py-0.5 text-[11.5px] font-semibold text-sage">✓ Verified</span>
      ) : !sent ? (
        <button
          type="button"
          onClick={() => {
            setSent(true);
            setSeconds(30);
          }}
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-[12px] font-medium text-primary hover:bg-panel"
        >
          Send code
        </button>
      ) : (
        <form action={verifyIdentityChannel} className="flex items-center gap-2">
          <input type="hidden" name="channel" value={channel} />
          {channel === "aadhaar" && <input type="hidden" name="last4" value={(aadhaar || "0000").slice(-4)} />}
          <span className="rounded bg-panel px-2 py-1 font-mono text-[12px] tabular-nums text-muted">code {code}</span>
          {channel === "aadhaar" && (
            <input
              value={aadhaar}
              onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))}
              placeholder="Aadhaar no."
              inputMode="numeric"
              className="w-28 rounded-lg border border-line bg-white px-2 py-1 text-[12px]"
            />
          )}
          <input
            defaultValue={code}
            className="w-20 rounded-lg border border-line bg-white px-2 py-1 font-mono text-[12px] tabular-nums"
          />
          <button className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-cream hover:opacity-90">
            Verify
          </button>
          {seconds > 0 && <span className="text-[12px] tabular-nums text-muted">{seconds}s</span>}
        </form>
      )}
    </div>
  );
}
