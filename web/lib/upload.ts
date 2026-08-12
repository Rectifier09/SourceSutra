import { createClient } from "@/lib/supabase/client";

// BP-2 · INT-1: real document storage. Bucket + RLS in migration 0010 — path convention
// "{org_id}/{section}/{label}-{timestamp}.{ext}" is what the RLS policies key off of via
// storage.foldername(name); identity/financials stay owner-only, portfolio is buyer-visible.
export const ONBOARDING_BUCKET = "onboarding-docs";

export async function uploadOnboardingFile(
  orgId: string,
  section: "identity" | "financials" | "portfolio",
  label: string,
  file: File,
): Promise<string> {
  const supabase = createClient();
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const path = `${orgId}/${section}/${safeLabel}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(ONBOARDING_BUCKET).upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

// Best-effort cleanup when a doc is replaced/removed — never blocks the UI on failure.
export async function removeOnboardingFile(path: string | undefined | null) {
  if (!path) return;
  const supabase = createClient();
  await supabase.storage.from(ONBOARDING_BUCKET).remove([path]);
}

// The bucket is private (migration 0010), so uploaded images need a signed URL
// to actually render — a bare storage path is never fetchable directly.
export async function getOnboardingFileUrl(path: string | undefined | null): Promise<string | null> {
  if (!path) return null;
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(ONBOARDING_BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}
