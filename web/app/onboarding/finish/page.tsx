import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { FinishOAuthForm } from "./_components/FinishOAuthForm";

export default async function FinishOAuthSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const me = await getMe();
  if (!me) redirect("/login");

  const { role: roleParam } = await searchParams;
  const role = roleParam === "supplier" ? "supplier" : "buyer";

  return (
    <main className="flex flex-1 items-center justify-center bg-cream px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="font-display text-[26px] font-semibold text-primary">SourceSutra</div>
          <div className="selvedge mx-auto mt-3 w-24 rounded-full" />
          <h1 className="mt-4 font-display text-[24px] font-medium text-ink">Just a few more details</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            Signed in as {me.full_name ?? "you"} — this finishes setting up your {role === "supplier" ? "supplier" : "customer"} account.
          </p>
        </div>
        <FinishOAuthForm role={role} />
      </div>
    </main>
  );
}
