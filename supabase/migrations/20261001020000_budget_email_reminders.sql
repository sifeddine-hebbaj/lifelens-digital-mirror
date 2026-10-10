alter table public.budget_recurring
  add column if not exists email_reminder_enabled boolean not null default false,
  add column if not exists email_reminder_claimed_for date,
  add column if not exists email_reminder_claimed_at timestamptz,
  add column if not exists email_reminder_last_sent_for date;

alter table public.user_preferences
  add column if not exists last_budget_email_test_at timestamptz;

create or replace function public.budget_claim_email_test()
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_rows integer;
begin
  update public.user_preferences
  set last_budget_email_test_at = now()
  where user_id = (select auth.uid())
    and (last_budget_email_test_at is null or last_budget_email_test_at < now() - interval '1 minute');

  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

revoke all on function public.budget_claim_email_test() from public, anon;
grant execute on function public.budget_claim_email_test() to authenticated;

create index if not exists budget_recurring_email_due_idx
  on public.budget_recurring (due_date)
  where active and email_reminder_enabled;

create or replace function public.budget_claim_due_email_reminders(p_limit integer default 100)
returns table (
  recurring_id uuid,
  user_id uuid,
  name text,
  amount numeric,
  category text,
  due_date date,
  reminder_days_before smallint,
  currency text,
  days_until_due integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;

  return query
  with candidates as (
    select payment.id
    from public.budget_recurring as payment
    where payment.active
      and payment.email_reminder_enabled
      and payment.due_date >= current_date
      and payment.due_date <= current_date + payment.reminder_days_before
      and payment.email_reminder_last_sent_for is distinct from payment.due_date
      and (
        payment.email_reminder_claimed_for is distinct from payment.due_date
        or payment.email_reminder_claimed_at is null
        or payment.email_reminder_claimed_at < now() - interval '20 minutes'
      )
    order by payment.due_date, payment.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  ), claimed as (
    update public.budget_recurring as payment
    set email_reminder_claimed_for = payment.due_date,
        email_reminder_claimed_at = now()
    from candidates
    where payment.id = candidates.id
    returning payment.id, payment.user_id, payment.name, payment.amount, payment.category,
      payment.due_date, payment.reminder_days_before
  )
  select claimed.id, claimed.user_id, claimed.name, claimed.amount, claimed.category,
    claimed.due_date, claimed.reminder_days_before,
    coalesce(preferences.currency, 'USD'), claimed.due_date - current_date
  from claimed
  left join public.user_preferences as preferences on preferences.user_id = claimed.user_id;
end;
$$;

revoke all on function public.budget_claim_due_email_reminders(integer) from public, anon, authenticated;
grant execute on function public.budget_claim_due_email_reminders(integer) to service_role;