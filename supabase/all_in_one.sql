-- =====================================================================
-- يعقوب — Supabase schema (المرحلة 1)
-- شغّل الملف ده كله مرة واحدة في: Supabase > SQL Editor > New query > Run
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- العملاء
-- ---------------------------------------------------------------------
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  phone       text,                       -- أرقام فقط بكود الدولة، مثال 966501234567
  city        text default 'الرياض',
  lat         double precision,
  lng         double precision,
  map_url     text,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists clients_owner_name_idx on public.clients (owner, name);

-- ---------------------------------------------------------------------
-- الزيارات والمواعيد (جدول واحد: الميعاد = زيارة حالتها scheduled)
-- ---------------------------------------------------------------------
create table if not exists public.visits (
  id                    uuid primary key default gen_random_uuid(),
  owner                 uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id             uuid not null references public.clients(id) on delete cascade,

  status                text not null default 'done'
                        check (status in ('scheduled','done','cancelled')),
  kind                  text not null
                        check (kind in ('fault','inspection','supply','install')),
  category              text,
  at                    timestamptz not null default now(),   -- وقت الميعاد أو وقت الزيارة
  arrived_at            timestamptz,
  finished_at           timestamptz,

  description           text,
  notes                 text,
  parent_visit_id       uuid references public.visits(id) on delete set null,
  photos                text[] not null default '{}',

  -- عطل
  device_name           text,
  device_password_enc   bytea,
  has_device_password   boolean not null default false,
  resolved              boolean,
  resolution            text,
  unresolved_reason     text check (unresolved_reason in ('client_refused','no_solution','engineer_failed','other')),
  unresolved_note       text,
  follow_up_date        date,

  -- معاينة
  insp_about            text,
  insp_needs            text,
  quote_sent            boolean not null default false,
  quote_sent_at         date,
  decision              text not null default 'pending'
                        check (decision in ('pending','approved','rejected')),
  reject_reason         text,

  -- توريد
  supply_items          text,
  supply_price          numeric(12,2),
  supply_mode           text check (supply_mode in ('supply_only','supply_maintenance')),

  created_at            timestamptz not null default now()
);
create index if not exists visits_owner_at_idx on public.visits (owner, at desc);
create index if not exists visits_client_idx   on public.visits (client_id);

-- ---------------------------------------------------------------------
-- الإعدادات (صف واحد لكل مستخدم)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  owner                uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  alert_quote_days     int  not null default 3,
  alert_followup_days  int  not null default 7,
  remind_before_min    int  not null default 60,
  default_city         text not null default 'الرياض'
);

-- ---------------------------------------------------------------------
-- حماية الصفوف (RLS): كل مستخدم يشوف بياناته بس
-- ---------------------------------------------------------------------
alter table public.clients  enable row level security;
alter table public.visits   enable row level security;
alter table public.settings enable row level security;

drop policy if exists clients_own  on public.clients;
drop policy if exists visits_own   on public.visits;
drop policy if exists settings_own on public.settings;

create policy clients_own  on public.clients  for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy visits_own   on public.visits   for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy settings_own on public.settings for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- ---------------------------------------------------------------------
-- تشفير باسوردات الأجهزة
-- المفتاح بيتولّد تلقائي وبيتخزن في جدول مقفول (مفيش حد يقراه من التطبيق)
-- ---------------------------------------------------------------------
create table if not exists public.app_secrets (
  key   text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;      -- من غير policies = مقفول
revoke all on public.app_secrets from anon, authenticated;

insert into public.app_secrets (key, value)
values ('pw_key', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

create or replace function public.set_device_password(p_visit uuid, p_pw text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare k text;
begin
  select value into k from public.app_secrets where key = 'pw_key';
  if k is null then raise exception 'encryption key missing'; end if;
  update public.visits
     set device_password_enc = case when coalesce(p_pw, '') = '' then null
                                    else pgp_sym_encrypt(p_pw, k) end,
         has_device_password = coalesce(p_pw, '') <> ''
   where id = p_visit and owner = auth.uid();
end;
$$;

create or replace function public.get_device_password(p_visit uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare k text; enc bytea;
begin
  select value into k from public.app_secrets where key = 'pw_key';
  select device_password_enc into enc
    from public.visits where id = p_visit and owner = auth.uid();
  if enc is null or k is null then return null; end if;
  return pgp_sym_decrypt(enc, k);
end;
$$;

revoke all on function public.set_device_password(uuid, text) from public, anon;
revoke all on function public.get_device_password(uuid)       from public, anon;
grant execute on function public.set_device_password(uuid, text) to authenticated;
grant execute on function public.get_device_password(uuid)       to authenticated;

-- ---------------------------------------------------------------------
-- تخزين الصور (خاص: كل مستخدم في فولدر باسمه)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('visit-photos', 'visit-photos', false)
on conflict (id) do nothing;

drop policy if exists "yaqoub photos" on storage.objects;
create policy "yaqoub photos" on storage.objects for all to authenticated
  using      (bucket_id = 'visit-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'visit-photos' and (storage.foldername(name))[1] = auth.uid()::text);


-- =====================================================================
-- يعقوب — المرحلة 2 (شغّله بعد schema.sql، مرة واحدة)
-- Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- أرقام تواصل متعددة لكل عميل (كل رقم باسم)
-- ---------------------------------------------------------------------
create table if not exists public.client_contacts (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  name        text not null,
  role        text,                       -- مثال: مدير، محاسب، فني
  phone       text not null,              -- أرقام فقط بكود الدولة
  created_at  timestamptz not null default now()
);
create index if not exists client_contacts_client_idx on public.client_contacts (client_id);
create index if not exists client_contacts_owner_idx  on public.client_contacts (owner);

alter table public.client_contacts enable row level security;
drop policy if exists client_contacts_own on public.client_contacts;
create policy client_contacts_own on public.client_contacts for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- ---------------------------------------------------------------------
-- "عني": نص بتقراه ليلة عشان تعرف شغلك
-- ---------------------------------------------------------------------
alter table public.settings add column if not exists about_me text;

-- ---------------------------------------------------------------------
-- ذاكرة ليلة: معلومات بتحفظها لما تقولها "افتكر..."
-- ---------------------------------------------------------------------
create table if not exists public.layla_memory (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fact        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists layla_memory_owner_idx on public.layla_memory (owner, created_at desc);

alter table public.layla_memory enable row level security;
drop policy if exists layla_memory_own on public.layla_memory;
create policy layla_memory_own on public.layla_memory for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- ---------------------------------------------------------------------
-- عداد استخدام ليلة اليومي (عشان تكلفة الـ API تفضل تحت السيطرة)
-- ---------------------------------------------------------------------
create table if not exists public.layla_usage (
  owner  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day    date not null default current_date,
  n      int  not null default 0,
  primary key (owner, day)
);

alter table public.layla_usage enable row level security;
drop policy if exists layla_usage_own on public.layla_usage;
create policy layla_usage_own on public.layla_usage for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());


-- =====================================================================
-- يعقوب — المرحلة 3: تفاصيل أكتر للعميل والزيارة (شغّله بعد schema_v2.sql)
-- Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- العميل: نوعه، الشخص الأساسي، العنوان، وتفاصيل الدخول
-- (أرقام التواصل الإضافية في جدول client_contacts)
-- ---------------------------------------------------------------------
alter table public.clients
  add column if not exists client_type   text,     -- شركة، مدرسة، مستشفى...
  add column if not exists contact_name  text,     -- اسم صاحب الرقم الأساسي
  add column if not exists contact_role  text,     -- مسماه
  add column if not exists address       text,     -- الحي أو العنوان
  add column if not exists email         text,
  add column if not exists work_hours    text,
  add column if not exists access_notes  text,     -- تعليمات الدخول للموقع
  add column if not exists tax_no        text,
  add column if not exists source        text;     -- مصدر العميل

-- ---------------------------------------------------------------------
-- الزيارة: الأولوية، اللي قابلناه، المشكلة، السبب، وتفاصيل كل نوع
-- ---------------------------------------------------------------------
alter table public.visits
  add column if not exists priority  text  not null default 'normal',
  add column if not exists met_with  text,
  add column if not exists problem   text,
  add column if not exists cause     text,
  add column if not exists details   jsonb not null default '{}'::jsonb;

alter table public.visits drop constraint if exists visits_priority_check;
alter table public.visits add  constraint visits_priority_check
  check (priority in ('normal', 'urgent', 'emergency'));

-- إضافة نوع "صيانة دورية"
alter table public.visits drop constraint if exists visits_kind_check;
alter table public.visits add  constraint visits_kind_check
  check (kind in ('fault', 'inspection', 'supply', 'install', 'maintenance'));

create index if not exists visits_problem_idx on public.visits (owner, problem);


-- =====================================================================
-- يعقوب — المرحلة 5: إشعارات الموبايل (Web Push) — شغّله بعد schema_v3.sql
-- =====================================================================

-- أجهزة المستخدم المسجّلة للإشعارات
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_owner_idx on public.push_subscriptions (owner);

alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- سجل اللي اتبعت (عشان نفس التنبيه ما يتكررش). السيرفر بس هو اللي بيكتب فيه
create table if not exists public.push_log (
  owner    uuid not null references auth.users(id) on delete cascade,
  key      text not null,
  sent_at  timestamptz not null default now(),
  primary key (owner, key)
);
alter table public.push_log enable row level security;   -- من غير policies = مقفول على التطبيق
revoke all on public.push_log from anon, authenticated;
