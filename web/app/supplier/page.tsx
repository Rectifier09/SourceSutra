import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";

export default async function SupplierHome() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "supplier") redirect("/buyer");

  const supabase = await createClient();
  const { data: overall } = await supabase
    .from("v_supplier_overall")
    .select("overall_status, progress_pct")
    .eq("org_id", me.org_id)
    .maybeSingle();

  const status = overall?.overall_status ?? "To be Started";
  const progress = overall?.progress_pct ?? 0;

  return (
    <>
      <Header me={me} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h2 className="text-xl font-semibold tracking-tight">Supplier workspace</h2>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">Welcome, {me.full_name}.</p>

        <div className="mt-6 flex items-center gap-5 rounded-xl border border-black/10 p-5 dark:border-white/15">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-black/40 dark:text-white/40">
              Onboarding
            </div>
            <div className="mt-0.5 font-medium">{status}</div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="text-2xl font-semibold tabular-nums">{progress}%</div>
        </div>

        <div className="mt-8 rounded-xl border border-dashed border-black/15 p-8 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
          FE-2 / FE-3 land next: onboarding (with BP-1 fakes) → discovery → quotes → invitations.
        </div>
      </main>
    </>
  );
}
