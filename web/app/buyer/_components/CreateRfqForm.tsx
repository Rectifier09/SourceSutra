"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createRfq } from "@/app/buyer/actions";

const field =
  "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";
const label = "block text-xs font-medium text-black/60 dark:text-white/60";

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
    <form action={createRfq} className="space-y-4">
      <div>
        <label className={label}>Title</label>
        <input name="title" required placeholder="e.g. Single-jersey T-shirts, basics line" className={field} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Quantity</label>
          <input name="quantity" type="number" min="0" className={field} />
        </div>
        <div>
          <label className={label}>Unit</label>
          <input name="unit" placeholder="pcs" className={field} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Contract type</label>
          <input name="contract_type" placeholder="CMT / FOB …" className={field} />
        </div>
        <div>
          <label className={label}>Who can respond</label>
          <select name="who_can_respond" defaultValue="open" className={field}>
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
            className={field}
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
            className={field}
          />
        </div>
      </div>

      <div className="rounded-md bg-black/[0.03] px-3 py-2 text-sm dark:bg-white/[0.05]">
        Matching suppliers: <span className="font-semibold tabular-nums">{count ?? "…"}</span>
        <span className="ml-1 text-xs text-black/45 dark:text-white/45">
          (advisory — the real responder set can be larger)
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={label}>Bid start</label>
          <input name="bid_start" type="date" required className={field} />
        </div>
        <div>
          <label className={label}>Bid end</label>
          <input name="bid_end" type="date" required className={field} />
        </div>
        <div>
          <label className={label}>Delivery date</label>
          <input name="delivery_date" type="date" required className={field} />
        </div>
      </div>

      <button
        type="submit"
        className="w-full rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/85"
      >
        Create draft
      </button>
    </form>
  );
}
