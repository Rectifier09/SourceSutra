// SourceSutra — send-notification-emails (BP-2 · INT-3)
//
// Polls `notifications` for unsent channel='email' rows (see migration 0011),
// resolves each row's org to its members' addresses via get_org_member_emails(),
// and sends through Resend. Requires RESEND_API_KEY as a function secret:
//   supabase secrets set RESEND_API_KEY=<key>
// Deploy: supabase functions deploy send-notification-emails
// Schedule: Supabase Dashboard → Edge Functions → send-notification-emails → Cron.
//
// Until RESEND_API_KEY is set, this function responds 200 with sent: 0 and does
// not mark anything as sent — safe to deploy ahead of having the credential.

import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM_ADDRESS = Deno.env.get("NOTIFICATIONS_FROM_ADDRESS") ?? "SourceSutra <notifications@sourcesutra.app>";
const BATCH_SIZE = 50;

type NotificationRow = {
  id: number;
  org_id: string;
  type: string;
  title: string;
  body: string;
};

Deno.serve(async () => {
  if (!RESEND_API_KEY) {
    return Response.json({ sent: 0, skipped: "RESEND_API_KEY not set" });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: pending, error: fetchError } = await supabase
    .from("notifications")
    .select("id, org_id, type, title, body")
    .eq("channel", "email")
    .is("sent_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  const rows = (pending ?? []) as NotificationRow[];
  let sent = 0;
  const failures: { id: number; error: string }[] = [];

  for (const row of rows) {
    const { data: recipients, error: rpcError } = await supabase.rpc("get_org_member_emails", {
      p_org: row.org_id,
    });

    if (rpcError || !recipients || recipients.length === 0) {
      failures.push({ id: row.id, error: rpcError?.message ?? "no recipients" });
      continue;
    }

    const to = (recipients as { email: string }[]).map((r) => r.email);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to,
        subject: row.title,
        text: row.body,
      }),
    });

    if (!res.ok) {
      failures.push({ id: row.id, error: `resend ${res.status}: ${await res.text()}` });
      continue;
    }

    const { error: updateError } = await supabase
      .from("notifications")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", row.id);

    if (updateError) {
      failures.push({ id: row.id, error: updateError.message });
      continue;
    }

    sent += 1;
  }

  return Response.json({ sent, failed: failures.length, failures });
});
