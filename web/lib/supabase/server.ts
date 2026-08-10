import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server (Server Component / Server Action / Route Handler) Supabase client.
// Next 16: cookies() is async. Writing cookies from a Server Component render
// throws — the proxy (proxy.ts) refreshes the session there, so we swallow it.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore (proxy handles refresh).
          }
        },
      },
    },
  );
}
