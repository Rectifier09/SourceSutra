import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";
import { CreateRfqWizard } from "@/app/buyer/_components/CreateRfqWizard";
import { RFQ_BANNER, rfqBannerClass } from "@/lib/rfqBackground";

export default async function NewRfq({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "buyer") redirect("/supplier");

  const { invite } = await searchParams;
  const supabase = await createClient();
  const { data: directory } = await supabase.from("v_supplier_directory").select("org_id, name, location, company_type").order("name");

  return (
    <>
      <Header me={me} />
      <main className={`mx-auto w-full max-w-[900px] flex-1 px-6 pb-20 pt-8 ${rfqBannerClass}`} style={{ backgroundImage: RFQ_BANNER }}>
        <Link href="/buyer" className="text-[14px] text-primary underline">
          ← My RFQs
        </Link>
        <h1 className="mt-3 font-display text-[28px] font-medium text-ink">Create sourcing request</h1>
        <p className="mb-6 mt-1 text-[14px] text-muted">Walk through the details, then publish to eligible suppliers.</p>
        <CreateRfqWizard supplierOptions={directory ?? []} initialInviteOrgId={invite} />
      </main>
    </>
  );
}
