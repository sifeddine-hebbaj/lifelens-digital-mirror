create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  entry_date date not null,
  mood smallint check (mood between 1 and 10),
  energy smallint check (energy between 1 and 10),
  sleep_hours numeric(4,2) check (sleep_hours between 0 and 24),
  sleep_quality smallint check (sleep_quality between 1 and 10),
  work_minutes integer check (work_minutes between 0 and 1440),
  exercise_minutes integer check (exercise_minutes between 0 and 1440),
  screen_minutes integer check (screen_minutes between 0 and 1440),
  social_minutes integer check (social_minutes between 0 and 1440),
  money_spent numeric(10,2) check (money_spent >= 0),
  tasks_done integer check (tasks_done >= 0),
  tasks_open integer check (tasks_open >= 0),
  events text,
  notes text check (char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  entry_date date not null,
  label text not null check (char_length(label) between 1 and 160),
  minutes integer check (minutes between 0 and 1440),
  created_at timestamptz not null default now()
);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null check (char_length(title) between 2 and 100),
  target text check (char_length(target) <= 160),
  due_date date,
  status text not null default 'active' check (status in ('active', 'completed', 'paused')),
  created_at timestamptz not null default now()
);

create table if not exists public.goal_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  goal_id uuid not null references public.goals on delete cascade,
  entry_date date not null,
  progress smallint not null check (progress between 0 and 100),
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  unique (goal_id, entry_date)
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  entry_date date not null,
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now()
);

create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('observed_fact', 'pattern', 'correlation', 'interpretation', 'suggestion')),
  title text not null check (char_length(title) between 1 and 120),
  explanation text,
  evidence text,
  confidence text check (confidence in ('low', 'medium', 'high', 'insufficient_data')),
  period_start date,
  period_end date,
  suggested_action text,
  created_at timestamptz not null default now()
);

create table if not exists public.detected_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  key text not null,
  stats jsonb not null,
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

create table if not exists public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  period text not null,
  period_start date,
  period_end date,
  content jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text check (char_length(title) <= 120),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  conversation_id uuid not null references public.ai_conversations on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 10000),
  created_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users on delete cascade,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  currency text not null default 'USD' check (char_length(currency) = 3)
);

create index if not exists daily_entries_user_date_idx on public.daily_entries (user_id, entry_date desc);
create index if not exists insights_user_created_idx on public.insights (user_id, created_at desc);
create index if not exists activities_user_date_idx on public.activities (user_id, entry_date);
create index if not exists goal_progress_user_goal_date_idx on public.goal_progress (user_id, goal_id, entry_date desc);
create unique index if not exists goal_progress_goal_date_unique_idx on public.goal_progress (goal_id, entry_date);
create index if not exists ai_messages_conversation_created_idx on public.ai_messages (conversation_id, created_at);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'daily_entries', 'activities', 'habits', 'goals', 'goal_progress',
    'journal_entries', 'insights', 'detected_patterns', 'ai_reports',
    'ai_conversations', 'ai_messages', 'user_preferences'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "own rows" on public.%I', table_name);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      table_name
    );
  end loop;

  alter table public.profiles enable row level security;
  drop policy if exists "own profile" on public.profiles;
  create policy "own profile" on public.profiles
    for all to authenticated
    using (id = (select auth.uid()))
    with check (id = (select auth.uid()));
end;
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

notify pgrst, 'reload schema';
