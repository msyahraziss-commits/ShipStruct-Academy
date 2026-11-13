-- ShipStruct Course Notes. Additive migration for the existing Classroom project.
-- Documents remain private. Only approved lecturers can upload and manage their own notes.
begin;

create table if not exists public.shipstruct_course_notes (
  id uuid primary key default gen_random_uuid(),
  lecturer_id uuid not null references public.shipstruct_profiles(id) on delete cascade,
  author_name text not null default '',
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null default '' check (char_length(description)<=1500),
  module_id integer check (module_id between 1 and 10),
  published boolean not null default false,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 240),
  file_extension text not null check (file_extension in ('pdf','pptx','docx')),
  mime_type text not null,
  file_size bigint not null check (file_size between 1 and 26214400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipstruct_notes_path_matches_owner check (storage_path=lecturer_id::text||'/'||id::text||'/note.'||file_extension),
  constraint shipstruct_notes_mime_matches_extension check (mime_type=case file_extension
    when 'pdf' then 'application/pdf'
    when 'pptx' then 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    when 'docx' then 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' end)
);
create index if not exists shipstruct_notes_module_idx on public.shipstruct_course_notes(module_id,created_at desc);
create index if not exists shipstruct_notes_lecturer_idx on public.shipstruct_course_notes(lecturer_id);
alter table public.shipstruct_course_notes enable row level security;
revoke all on public.shipstruct_course_notes from anon,authenticated;
grant select,insert,update,delete on public.shipstruct_course_notes to authenticated;

create or replace function public.shipstruct_notes_is_lecturer()
returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from public.shipstruct_profiles where id=(select auth.uid()) and role='lecturer');
$$;
revoke all on function public.shipstruct_notes_is_lecturer() from public,anon;
grant execute on function public.shipstruct_notes_is_lecturer() to authenticated;

create or replace function public.shipstruct_note_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_name text;
begin
  select full_name into v_name from public.shipstruct_profiles where id=auth.uid() and role='lecturer';
  if not found or new.lecturer_id is distinct from auth.uid() then raise exception 'Approved lecturer ownership is required'; end if;
  if tg_op='UPDATE' and (new.id,new.lecturer_id,new.storage_path,new.file_name,new.file_extension,new.mime_type,new.file_size,new.created_at)
    is distinct from (old.id,old.lecturer_id,old.storage_path,old.file_name,old.file_extension,old.mime_type,old.file_size,old.created_at) then
    raise exception 'Upload a new document to replace a file';
  end if;
  new.title=btrim(new.title);new.description=btrim(new.description);
  new.author_name=coalesce(nullif(v_name,''),'Lecturer');new.updated_at=now();
  if tg_op='INSERT' then new.created_at=now();end if;
  return new;
end;
$$;
revoke all on function public.shipstruct_note_guard() from public,anon,authenticated;
drop trigger if exists shipstruct_note_guard on public.shipstruct_course_notes;
create trigger shipstruct_note_guard before insert or update on public.shipstruct_course_notes
for each row execute function public.shipstruct_note_guard();

drop policy if exists shipstruct_notes_read on public.shipstruct_course_notes;
create policy shipstruct_notes_read on public.shipstruct_course_notes for select to authenticated using (
  (published and exists(select 1 from public.shipstruct_profiles where id=(select auth.uid())))
  or (lecturer_id=(select auth.uid()) and public.shipstruct_notes_is_lecturer())
);
drop policy if exists shipstruct_notes_insert on public.shipstruct_course_notes;
create policy shipstruct_notes_insert on public.shipstruct_course_notes for insert to authenticated
with check (lecturer_id=(select auth.uid()) and public.shipstruct_notes_is_lecturer());
drop policy if exists shipstruct_notes_update on public.shipstruct_course_notes;
create policy shipstruct_notes_update on public.shipstruct_course_notes for update to authenticated
using (lecturer_id=(select auth.uid()) and public.shipstruct_notes_is_lecturer())
with check (lecturer_id=(select auth.uid()) and public.shipstruct_notes_is_lecturer());
drop policy if exists shipstruct_notes_delete on public.shipstruct_course_notes;
create policy shipstruct_notes_delete on public.shipstruct_course_notes for delete to authenticated
using (lecturer_id=(select auth.uid()) and public.shipstruct_notes_is_lecturer());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('shipstruct-course-notes','shipstruct-course-notes',false,26214400,
  array['application/pdf','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists shipstruct_note_files_insert on storage.objects;
create policy shipstruct_note_files_insert on storage.objects for insert to authenticated with check (
  bucket_id='shipstruct-course-notes' and (storage.foldername(name))[1]=(select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/note[.](pdf|pptx|docx)$' and public.shipstruct_notes_is_lecturer()
);
drop policy if exists shipstruct_note_files_read on storage.objects;
create policy shipstruct_note_files_read on storage.objects for select to authenticated using (
  bucket_id='shipstruct-course-notes' and (
    ((storage.foldername(name))[1]=(select auth.uid())::text and public.shipstruct_notes_is_lecturer())
    or exists(select 1 from public.shipstruct_course_notes n where n.storage_path=storage.objects.name and n.published)
  )
);
drop policy if exists shipstruct_note_files_delete on storage.objects;
create policy shipstruct_note_files_delete on storage.objects for delete to authenticated using (
  bucket_id='shipstruct-course-notes' and (storage.foldername(name))[1]=(select auth.uid())::text and public.shipstruct_notes_is_lecturer()
);
notify pgrst,'reload schema';
commit;
