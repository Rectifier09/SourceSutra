-- ============================================================================
-- SourceSutra — migration 0010: real document storage (BP-2 · INT-1).
--
-- Replaces the BP-1 fake ("documents"/"certifications" rows with no real file,
-- supplier_profiles.logo_path/facility_photos/catalogue holding placeholder
-- filenames only) with a real private Storage bucket + object-level RLS.
--
-- Path convention: "{org_id}/{section_kind}/{label}-{timestamp}.{ext}" — the
-- first two path segments are read back by the RLS policies below via
-- storage.foldername(name), mirroring the existing documents_read/
-- documents_mutate table policies exactly (§A.10 / bizlogic.md §B.8):
--   * identity / financials  -> owner-only (is_member), never buyer-visible
--   * portfolio              -> owner-only to WRITE, any authenticated to READ
-- service_role (the reviewer path, review_section) bypasses Storage RLS the
-- same way it already bypasses table RLS — no separate reviewer policy needed
-- until D2 (reviewer identity model) is settled.
--
-- D3 (storage bucket layout & scanning) settled per buildplan.md recommendation:
-- v1 skips AV/format scanning — documents stay "uploaded", no scan step.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('onboarding-docs', 'onboarding-docs', false, 26214400)  -- 25 MiB
on conflict (id) do nothing;

-- Read: owner of the org segment, OR anyone authenticated for portfolio files
-- (buyer-facing catalogue/facility photos/logo — matches documents_read).
create policy onboarding_docs_read on storage.objects for select
  to authenticated
  using (
    bucket_id = 'onboarding-docs'
    and (
      is_member(nullif((storage.foldername(name))[1], '')::uuid)
      or (storage.foldername(name))[2] = 'portfolio'
    )
  );

-- Write (insert/update/delete): owner of the org segment only, any section.
create policy onboarding_docs_insert on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'onboarding-docs'
    and is_member(nullif((storage.foldername(name))[1], '')::uuid)
  );

create policy onboarding_docs_update on storage.objects for update
  to authenticated
  using (
    bucket_id = 'onboarding-docs'
    and is_member(nullif((storage.foldername(name))[1], '')::uuid)
  )
  with check (
    bucket_id = 'onboarding-docs'
    and is_member(nullif((storage.foldername(name))[1], '')::uuid)
  );

create policy onboarding_docs_delete on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'onboarding-docs'
    and is_member(nullif((storage.foldername(name))[1], '')::uuid)
  );
