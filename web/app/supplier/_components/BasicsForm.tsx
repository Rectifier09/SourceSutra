import Link from "next/link";
import { updateSupplierProfile } from "../actions";
import { APP_BG_CLASS, DEFAULT_BG } from "@/lib/appBackground";

const labelText = "text-[13px] font-semibold text-muted";
const input = "rounded-lg border border-line bg-white px-3 py-2.5 text-[14.5px] text-ink placeholder:text-muted/60";

// The "Company basics" section merged into the vendor profile view — public-facing
// mission/location/years-in-business, previously a separate /supplier/profile page.
export function BasicsForm({
  initial,
}: {
  initial: { mission: string; location: string; yearsInBusiness: string };
}) {
  return (
    <main className={`mx-auto w-full max-w-[900px] flex-1 px-6 pb-20 pt-8 ${APP_BG_CLASS}`} style={{ backgroundImage: DEFAULT_BG }}>
      <Link href="/supplier" className="text-[14px] text-primary underline">
        ← Back to profile
      </Link>
      <h1 className="mt-3 font-display text-[24px] font-medium text-ink">Company basics</h1>
      <p className="mb-6 mt-1 text-[13.5px] text-muted">Public profile — what buyers see when they discover you.</p>

      <form action={updateSupplierProfile} className="rounded-[16px] border border-line bg-cream px-6 py-7 sm:px-8">
        <div className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className={labelText}>Mission / about</span>
            <textarea
              name="mission"
              rows={3}
              defaultValue={initial.mission}
              placeholder="What your factory does best."
              className={input}
            />
          </label>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={labelText}>City / region</span>
              <input name="location" defaultValue={initial.location} placeholder="e.g. Tiruppur, Tamil Nadu" className={input} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelText}>Years in business</span>
              <input name="years_in_business" type="number" min="0" defaultValue={initial.yearsInBusiness} className={input} />
            </label>
          </div>
        </div>

        <div className="mt-6">
          <button className="rounded-lg bg-primary px-5 py-3 text-[14.5px] font-semibold text-cream hover:opacity-90">
            Save changes
          </button>
        </div>
      </form>
    </main>
  );
}
