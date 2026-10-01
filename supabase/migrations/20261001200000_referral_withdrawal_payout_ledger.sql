-- SHAKH Stage 8 withdrawal audit ledger:
-- Record the external payout approval separately from the wallet reservation.
-- The payout row does not change wallet balance because the balance was already
-- reserved when the withdrawal request was created.
BEGIN;

ALTER TABLE public.referral_wallet_transactions
  DROP CONSTRAINT IF EXISTS referral_wallet_transactions_type_chk;

ALTER TABLE public.referral_wallet_transactions
  ADD CONSTRAINT referral_wallet_transactions_type_chk
  CHECK (
    type IN (
      'earning',
      'purchase',
      'withdrawal_reserve',
      'withdrawal_refund',
      'withdrawal_payout'
    )
  );

CREATE OR REPLACE FUNCTION private.process_referral_withdrawal(
  p_request_id uuid,
  p_approve boolean,
  p_admin_note text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.referral_withdrawal_requests%rowtype;
  v_wallet_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required';
  END IF;

  SELECT *
  INTO v_request
  FROM public.referral_withdrawal_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'withdrawal_request_not_found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RETURN true;
  END IF;

  INSERT INTO public.referral_wallets(user_id)
  VALUES(v_request.user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT id
  INTO v_wallet_id
  FROM public.referral_wallets
  WHERE user_id = v_request.user_id
  FOR UPDATE;

  IF p_approve THEN
    INSERT INTO public.referral_wallet_transactions(
      wallet_id,
      type,
      amount_iqd,
      reference_id,
      description
    )
    VALUES(
      v_wallet_id,
      'withdrawal_payout',
      round(v_request.amount_iqd, 2),
      v_request.id,
      'پارەی دەرکراو بۆ داواکاری قازانج'
    )
    ON CONFLICT (wallet_id, type, reference_id) DO NOTHING;

    UPDATE public.referral_withdrawal_requests
    SET status = 'approved',
        admin_note = nullif(btrim(p_admin_note), ''),
        processed_at = now(),
        processed_by = auth.uid()
    WHERE id = v_request.id
      AND status = 'pending';
  ELSE
    INSERT INTO public.referral_wallet_transactions(
      wallet_id, type, amount_iqd, reference_id, description
    )
    VALUES(
      v_wallet_id,
      'withdrawal_refund',
      round(v_request.amount_iqd, 2),
      v_request.id,
      'گەڕانەوەی قازانجی دەرنەکراو'
    )
    ON CONFLICT (wallet_id, type, reference_id) DO NOTHING;

    UPDATE public.referral_wallets
    SET balance_iqd = balance_iqd + round(v_request.amount_iqd, 2),
        updated_at = now()
    WHERE id = v_wallet_id;

    UPDATE public.referral_withdrawal_requests
    SET status = 'rejected',
        admin_note = nullif(btrim(p_admin_note), ''),
        processed_at = now(),
        processed_by = auth.uid()
    WHERE id = v_request.id
      AND status = 'pending';
  END IF;

  INSERT INTO public.notifications(
    user_id, title, body, type, is_read, data
  )
  VALUES(
    v_request.user_id,
    CASE WHEN p_approve
      THEN 'داواکاری قازانج پەسەند کرا'
      ELSE 'داواکاری قازانج ڕەتکرایەوە'
    END,
    CASE WHEN p_approve
      THEN 'داواکاری دەرکردنی قازانجەکەت پەسەند کرا و پارەدانەکە تۆمار کرا.'
      ELSE 'داواکاری دەرکردنی قازانجەکەت ڕەتکرایەوە و بڕەکە گەڕێندرایەوە ناو جزدان.'
    END,
    'referral_withdrawal',
    false,
    jsonb_build_object(
      'request_id', v_request.id,
      'status', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      'amount_iqd', v_request.amount_iqd
    )
  );

  RETURN true;
END;
$$;

REVOKE ALL
  ON FUNCTION private.process_referral_withdrawal(uuid,boolean,text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION private.process_referral_withdrawal(uuid,boolean,text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.process_referral_withdrawal(
  p_request_id uuid,
  p_approve boolean,
  p_admin_note text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.process_referral_withdrawal(
    p_request_id,
    p_approve,
    p_admin_note
  );
$$;

REVOKE ALL
  ON FUNCTION public.process_referral_withdrawal(uuid,boolean,text)
  FROM PUBLIC, anon;

GRANT EXECUTE
  ON FUNCTION public.process_referral_withdrawal(uuid,boolean,text)
  TO authenticated;

COMMIT;
