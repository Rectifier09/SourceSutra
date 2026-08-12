import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { FinishOAuthForm } from "./_components/FinishOAuthForm";
import { APP_BG_CLASS, DEFAULT_BG } from "@/lib/appBackground";

// Google's OIDC claims land in user_metadata — given_name/family_name are usually
// present, but fall back to splitting full_name/name for providers that only send
// a single combined name.
function splitName(meta: Record<string, unknown>): { firstName: string; lastName: string } {
  const given = typeof meta.given_name === "string" ? meta.given_name : "";
  const family = typeof meta.family_name === "string" ? meta.family_name : "";
  if (given || family) return { firstName: given, lastName: family };

  const full = (typeof meta.full_name === "string" && meta.full_name) || (typeof meta.name === "string" && meta.name) || "";
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

export default async function FinishOAuthSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const me = await getMe();
  if (!me) redirect("/login");

  const { role: roleParam } = await searchParams;
  const initialRole = roleParam === "supplier" ? "supplier" : "buyer";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const { firstName, lastName } = splitName(meta);

  return (
    <main className={`flex flex-1 items-center justify-center px-6 py-16 ${APP_BG_CLASS}`} style={{ backgroundImage: DEFAULT_BG }}>
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="font-display text-[26px] font-semibold text-primary">SourceSutra</div>
          <div className="selvedge mx-auto mt-3 w-24 rounded-full" />
          <h1 className="mt-4 font-display text-[24px] font-medium text-ink">Just a few more details</h1>
          <p className="mt-1.5 text-[13px] text-muted">Signed in with Google — this finishes setting up your account.</p>
        </div>
        <FinishOAuthForm initialRole={initialRole} email={user?.email ?? ""} initialFirstName={firstName} initialLastName={lastName} />
      </div>
    </main>
  );
}
