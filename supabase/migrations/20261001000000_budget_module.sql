-- LifeLens Budget module.
-- The base application schema (supabase/schema.sql) must be installed first.

create extension if not exists pgcrypto;

create table if not exists public.budget_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null default '' check (char_length(name) <= 120),
  amount numeric(12,2) not null check (amount > 0),
  category text not null default 'other' check (char_length(category) between 1 and 60),
  expense_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.budget_income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  source text not null default '' check (char_length(source) <= 120),
  note text not null default '' check (char_length(note) <= 255),
  income_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.budget_months (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  spend_budget numeric(12,2) not null default 0 check (spend_budget >= 0),
  annual_budget numeric(12,2) not null default 0 check (annual_budget >= 0),
  savings_goal numeric(12,2) not null default 0 check (savings_goal >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

create table if not exists public.budget_savings_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  delta numeric(12,2) not null,
  target_balance numeric(12,2) not null,
  note text not null default '' check (char_length(note) <= 255),
  created_at timestamptz not null default now()
);

create table if not exists public.budget_recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  amount numeric(12,2) not null check (amount > 0),
  category text not null default 'subscriptions' check (char_length(category) between 1 and 60),
  frequency text not null default 'monthly' check (frequency in ('monthly', 'yearly')),
  due_date date not null,
  reminder_days_before smallint not null default 3 check (reminder_days_before between 0 and 60),
  active boolean not null default true,
  notes text not null default '' check (char_length(notes) <= 255),
  created_at timestamptz not null default now()
);

create index if not exists budget_expenses_user_date_idx on public.budget_expenses (user_id, expense_date desc);
create index if not exists budget_income_user_date_idx on public.budget_income (user_id, income_date desc);
create index if not exists budget_months_user_month_idx on public.budget_months (user_id, month desc);
create index if not exists budget_adjustments_user_month_idx on public.budget_savings_adjustments (user_id, month);
create index if not exists budget_recurring_user_due_idx on public.budget_recurring (user_id, due_date);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'budget_expenses', 'budget_income', 'budget_months',
    'budget_savings_adjustments', 'budget_recurring'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "own rows" on public.%I', table_name);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      table_name
    );
  end loop;
end;
$$;

-- Drop in dependency order so PostgreSQL can accept corrected argument names.
drop function if exists public.budget_correct_savings(text, numeric, text);
drop function if exists public.budget_savings_balance(text);
drop function if exists public.budget_mark_recurring_paid(uuid);

create function public.budget_savings_balance(p_month text)
returns numeric
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  month_end date;
begin
  if p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'month must look like YYYY-MM';
  end if;
  month_end := (date_trunc('month', (p_month || '-01')::date) + interval '1 month - 1 day')::date;
  return round(
    coalesce((select sum(amount) from public.budget_income
              where user_id = (select auth.uid()) and income_date <= month_end), 0)
    + coalesce((select sum(delta) from public.budget_savings_adjustments
                where user_id = (select auth.uid()) and month <= p_month), 0),
    2);
end;
$$;

create function public.budget_correct_savings(p_month text, p_target numeric, p_note text default '')
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_balance numeric;
  new_delta numeric;
begin
  current_balance := public.budget_savings_balance(p_month);
  new_delta := round(p_target - current_balance, 2);
  insert into public.budget_savings_adjustments (user_id, month, delta, target_balance, note)
  values ((select auth.uid()), p_month, new_delta, p_target, left(coalesce(p_note, ''), 255));
  return public.budget_savings_balance(p_month);
end;
$$;

create function public.budget_mark_recurring_paid(p_id uuid)
returns date
language plpgsql
security invoker
set search_path = public
as $$
declare
  payment public.budget_recurring%rowtype;
  next_due date;
begin
  select * into payment from public.budget_recurring
  where id = p_id and user_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'recurring payment not found';
  end if;

  insert into public.budget_expenses (user_id, name, amount, category, expense_date)
  values (payment.user_id, payment.name, payment.amount, payment.category, payment.due_date);

  next_due := (payment.due_date + case when payment.frequency = 'yearly' then interval '12 months' else interval '1 month' end)::date;
  update public.budget_recurring set due_date = next_due where id = payment.id;
  return next_due;
end;
$$;

revoke all on function public.budget_savings_balance(text) from public;
revoke all on function public.budget_correct_savings(text, numeric, text) from public;
revoke all on function public.budget_mark_recurring_paid(uuid) from public;
grant execute on function public.budget_savings_balance(text) to authenticated;
grant execute on function public.budget_correct_savings(text, numeric, text) to authenticated;
grant execute on function public.budget_mark_recurring_paid(uuid) to authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.budget_expenses, public.budget_income, public.budget_months,
  public.budget_savings_adjustments, public.budget_recurring
to authenticated;

notify pgrst, 'reload schema';