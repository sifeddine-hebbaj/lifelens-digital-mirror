alter table public.user_preferences
  add column if not exists last_currency_rate_from text,
  add column if not exists last_currency_rate numeric(20,10),
  add column if not exists last_currency_rate_date timestamptz;

create or replace function public.budget_convert_currency(
  p_target_currency text,
  p_rate numeric,
  p_rate_date timestamptz
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_currency text;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;
  if p_target_currency is null or p_target_currency not in ('MAD', 'USD', 'CAD', 'EUR', 'GBP', 'AUD', 'JPY') then
    raise exception 'unsupported currency';
  end if;
  if p_rate is null or p_rate <= 0 or p_rate_date is null then
    raise exception 'invalid exchange rate';
  end if;

  select currency into current_currency
  from public.user_preferences
  where user_id = current_user_id
  for update;
  if not found then
    raise exception 'currency preference not found';
  end if;
  if current_currency = p_target_currency then
    return;
  end if;

  update public.budget_expenses
  set amount = round(amount * p_rate, 2)
  where user_id = current_user_id;
  update public.budget_income
  set amount = round(amount * p_rate, 2)
  where user_id = current_user_id;
  update public.budget_months
  set spend_budget = round(spend_budget * p_rate, 2),
      annual_budget = round(annual_budget * p_rate, 2),
      savings_goal = round(savings_goal * p_rate, 2)
  where user_id = current_user_id;
  update public.budget_savings_adjustments
  set delta = round(delta * p_rate, 2),
      target_balance = round(target_balance * p_rate, 2)
  where user_id = current_user_id;
  update public.budget_recurring
  set amount = round(amount * p_rate, 2)
  where user_id = current_user_id;

  update public.user_preferences
  set currency = p_target_currency,
      last_currency_rate_from = current_currency,
      last_currency_rate = p_rate,
      last_currency_rate_date = p_rate_date
  where user_id = current_user_id;
end;
$$;

revoke all on function public.budget_convert_currency(text, numeric, timestamptz) from public;
grant execute on function public.budget_convert_currency(text, numeric, timestamptz) to authenticated;