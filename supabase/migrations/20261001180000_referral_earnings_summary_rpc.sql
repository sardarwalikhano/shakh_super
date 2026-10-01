-- SHAKH Stage 8 reporting fix:
-- Aggregate referral earnings in PostgreSQL so dashboard totals are not limited
-- by the UI's recent-earnings page size. Month boundaries use Iraq time.
BEGIN;

CREATE OR REPLACE FUNCTION private.get_referral_earnings_summary()
RETURNS TABLE(
  balance_iqd numeric,
  total_earned_iqd numeric,
  monthly_earned_iqd numeric,
  pending_iqd numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_month_start timestamptz;
  v_next_month_start timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  v_month_start :=
    date_trunc(
      'month',
      now() AT TIME ZONE 'Asia/Baghdad'
    ) AT TIME ZONE 'Asia/Baghdad';

  v_next_month_start :=
    (date_trunc(
      'month',
      now() AT TIME ZONE 'Asia/Baghdad'
    ) + interval '1 month') AT TIME ZONE 'Asia/Baghdad';

  SELECT coalesce(rw.balance_iqd, 0)
  INTO balance_iqd
  FROM public.referral_wallets rw
  WHERE rw.user_id = v_user
  LIMIT 1;

  balance_iqd := coalesce(balance_iqd, 0);

  SELECT coalesce(sum(e.earning_iqd) FILTER (WHERE e.status = 'earned'), 0),
         coalesce(sum(e.earning_iqd) FILTER (
           WHERE e.status = 'earned'
             AND e.earned_at >= v_month_start
             AND e.earned_at < v_next_month_start
         ), 0),
         coalesce(sum(e.earning_iqd) FILTER (WHERE e.status = 'pending'), 0)
  INTO total_earned_iqd, monthly_earned_iqd, pending_iqd
  FROM public.order_referral_earnings e
  WHERE e.beneficiary_user_id = v_user;
END;
$$;

REVOKE ALL
  ON FUNCTION private.get_referral_earnings_summary()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION private.get_referral_earnings_summary()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_referral_earnings_summary()
RETURNS TABLE(
  balance_iqd numeric,
  total_earned_iqd numeric,
  monthly_earned_iqd numeric,
  pending_iqd numeric
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT *
  FROM private.get_referral_earnings_summary();
$$;

REVOKE ALL
  ON FUNCTION public.get_referral_earnings_summary()
  FROM PUBLIC, anon;

GRANT EXECUTE
  ON FUNCTION public.get_referral_earnings_summary()
  TO authenticated;

COMMIT;
