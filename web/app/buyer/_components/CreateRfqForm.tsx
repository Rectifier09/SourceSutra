"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createRfq } from "@/app/buyer/actions";

const input =
  "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-[14.5px] text-ink outline-none placeholder:text-muted/60 focus:border-primary";
const label = "block text-[13px] font-semibold text-muted";

export function CreateRfqForm() {
  const [location, setLocation] = useState("");
  const [minYears, setMinYears] = useState("");
  const [count, setCount] = useState<number | null>(null);

  // Live "matching suppliers" (§A.8.4) — advisory, recomputed as the buyer types.
  useEffect(() => {
    const supabase = createClient();
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("match_count", {
        p_preferred_location: location || null,
        p_min_years: minYears ? Number(minYears) : null,
      });
      setCount(typeof data === "number" ? data : null);
    }, 300);
    return () => clearTimeout(t);
  }, [location, minYears]);

  return (
    <form action={createRfq} className="rounded-[16px] border border-line bg-cream px-6 py-7 sm:px-8">
      <div className="space-y-4">
        <div>
          <label className={label}>Title</label>
          <input name="title" required placeholder="e.g. Single-jersey T-shirts, basics line" className={input} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Quantity</label>
            <input name="quantity" type="number" min="0" className={input} />
          </div>
          <div>
            <label className={label}>Unit</label>
            <input name="unit" placeholder="pcs" className={input} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Contract type</label>
            <input name="contract_type" placeholder="CMT / FOB …" className={input} />
          </div>
          <div>
            <label className={label}>Who can respond</label>
            <select name="who_can_respond" defaultValue="open" className={input}>
              <option value="open">Open (all verified)</option>
              <option value="verified_only">Verified only</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Preferred location (advisory)</label>
            <input
              name="preferred_location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Tiruppur"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Min years in business (advisory)</label>
            <input
              name="min_years_experience"
              value={minYears}
              onChange={(e) => setMinYears(e.target.value)}
              type="number"
              min="0"
              className={input}
            />
          </div>
        </div>

        <div className="rounded-lg border border-lav2 bg-lav1 px-3.5 py-2.5 text-[13.5px] text-ink">
          Matching suppliers: <span className="font-semibold tabular-nums text-primary">{count ?? "…"}</span>
          <span className="ml-1 text-[12px] text-muted">(advisory — the real responder set can be larger)</span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={label}>Bid start</label>
            <input name="bid_start" type="date" required className={input} />
          </div>
          <div>
            <label className={label}>Bid end</label>
            <input name="bid_end" type="date" required className={input} />
          </div>
          <div>
            <label className={label}>Delivery date</label>
            <input name="delivery_date" type="date" required className={input} />
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="mt-6 w-full rounded-lg bg-primary px-4 py-3 text-[14.5px] font-semibold text-cream hover:opacity-90"
      >
        Create draft
      </button>
    </form>
  );
}
