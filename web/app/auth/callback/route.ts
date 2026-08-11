import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Landing point for supabase.auth.signInWithOAuth() (Google) — see
// RegisterForm's "Continue with Google" button. Exchanges the auth code for a
// session, then routes a brand-new signup into /onboarding/finish to collect
// what Google can't provide (company, products, phone, consent — see
// finish_oauth_signup, migration 0012); a returning user goes straight to
// their dashboard. provision_account (0002) has already auto-created a
// default buyer org for a new user by the time we get here.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const role = searchParams.get("role") === "supplier" ? "supplier" : "buyer";
  const oauthError = searchParams.get("error_description") || searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(`${origin}/register?error=${encodeURIComponent(oauthError)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/register?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/register?error=${encodeURIComponent(error?.message ?? "auth_failed")}`);
  }

  const createdAt = new Date(data.user.created_at).getTime();
  const lastSignInAt = data.user.last_sign_in_at ? new Date(data.user.last_sign_in_at).getTime() : createdAt;
  const isNewUser = Math.abs(lastSignInAt - createdAt) < 5000;

  if (isNewUser) {
    return NextResponse.redirect(`${origin}/onboarding/finish?role=${role}`);
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  return NextResponse.redirect(`${origin}${profile?.role === "supplier" ? "/supplier" : "/buyer"}`);
}
