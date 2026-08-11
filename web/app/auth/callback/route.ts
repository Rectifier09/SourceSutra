import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Landing point for supabase.auth.signInWithOAuth() (Google) — see
// RegisterForm's "Continue with Google" button. Exchanges the auth code for a
// session, then routes into /onboarding/finish to collect what Google can't
// provide (company, products, phone, consent — see finish_oauth_signup,
// migration 0012) whenever profiles.oauth_pending is still true (migration
// 0014) — a returning user whose signup is already finished goes straight to
// their dashboard instead. provision_account (0002) has already auto-created
// a default buyer org for a new user by the time we get here.
//
// Previously this used a created_at/last_sign_in_at timestamp heuristic,
// which could misroute a user straight to their dashboard (skipping
// /onboarding/finish entirely) on any retry — profiles.oauth_pending is a
// single, unambiguous source of truth instead.
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

  const { data: profile } = await supabase.from("profiles").select("role, oauth_pending").eq("id", data.user.id).maybeSingle();

  if (!profile || profile.oauth_pending) {
    return NextResponse.redirect(`${origin}/onboarding/finish?role=${role}`);
  }

  return NextResponse.redirect(`${origin}${profile.role === "supplier" ? "/supplier" : "/buyer"}`);
}
