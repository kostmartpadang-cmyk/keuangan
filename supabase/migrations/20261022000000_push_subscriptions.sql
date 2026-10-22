-- Langganan notifikasi push (Web Push) per perangkat. Aman dijalankan berulang.
create table if not exists public.push_subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  endpoint           text not null unique,
  p256dh             text not null,
  auth               text not null,
  -- Kunci pengingat terakhir yang dikirim (mis. "2026-10-19:low") agar tidak mengirim berulang dalam satu minggu.
  last_notified_key  text,
  created_at         timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.push_subscriptions to authenticated;
revoke all on public.push_subscriptions from anon;
