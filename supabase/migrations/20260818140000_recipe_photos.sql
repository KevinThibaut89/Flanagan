-- A photo of the finished drink, attached from the recipe page after saving.
-- Stored as the object's public URL, matching `bottles.image_url` and
-- `products.image_url`; the storage path is recoverable from it for cleanup.

alter table public.recipes add column image_url text;

-- Public bucket: the URLs are unguessable (user id / recipe id / timestamp)
-- and a public read is what lets expo-image cache them like any other picture.
-- Writes are locked to the owner's folder below.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-photos',
  'recipe-photos',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- Objects live at `<user id>/<recipe id>/<stamp>.<ext>`; the first path
-- segment is what the policies check.
create policy "users read their own recipe photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'recipe-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users upload their own recipe photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'recipe-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users replace their own recipe photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'recipe-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'recipe-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users delete their own recipe photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'recipe-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
