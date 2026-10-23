create table public.client_branches (
 id uuid primary key default gen_random_uuid(),
 owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
 client_id uuid not null references public.clients(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 120),
 city text, address text, phone text, note text, map_url text,
 lat double precision check(lat between -90 and 90), lng double precision check(lng between -180 and 180),
 created_at timestamptz not null default now(),
 unique(id,client_id,owner)
);
create index client_branches_owner_client on public.client_branches(owner,client_id);
alter table public.client_branches enable row level security;
create policy branches_select on public.client_branches for select to authenticated using(owner=(select auth.uid()));
create policy branches_insert on public.client_branches for insert to authenticated with check(owner=(select auth.uid()) and exists(select 1 from public.clients c where c.id=client_id and c.owner=(select auth.uid())));
create policy branches_update on public.client_branches for update to authenticated using(owner=(select auth.uid())) with check(owner=(select auth.uid()) and exists(select 1 from public.clients c where c.id=client_id and c.owner=(select auth.uid())));
grant select,insert,update on public.client_branches to authenticated;
alter table public.visits add column branch_id uuid;
alter table public.visits add constraint visits_branch_owner_fk foreign key(branch_id,client_id,owner) references public.client_branches(id,client_id,owner);
create index visits_branch_id_idx on public.visits(branch_id);
alter table public.layla_memory add column client_id uuid references public.clients(id) on delete cascade;
create index layla_memory_client_idx on public.layla_memory(owner,client_id);
create table public.layla_chat (
 owner uuid primary key default auth.uid() references auth.users(id) on delete cascade,
 messages jsonb not null default '[]' check(jsonb_typeof(messages)='array' and jsonb_array_length(messages)<=40),
 updated_at timestamptz not null default now()
);
alter table public.layla_chat enable row level security;
create policy chat_select on public.layla_chat for select to authenticated using(owner=(select auth.uid()));
create policy chat_insert on public.layla_chat for insert to authenticated with check(owner=(select auth.uid()));
create policy chat_update on public.layla_chat for update to authenticated using(owner=(select auth.uid())) with check(owner=(select auth.uid()));
grant select,insert,update on public.layla_chat to authenticated;
alter policy layla_memory_own on public.layla_memory using(owner=(select auth.uid())) with check(owner=(select auth.uid()) and (client_id is null or exists(select 1 from public.clients c where c.id=client_id and c.owner=(select auth.uid()))));
