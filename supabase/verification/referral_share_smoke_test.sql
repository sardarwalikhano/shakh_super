-- SHAKH referral/share smoke test (READ ONLY)
-- Run in Supabase SQL Editor after applying the referral migrations.
-- No INSERT/UPDATE/DELETE/DDL is performed.

select
  to_regclass('public.post_referral_programs') as post_referral_programs,
  to_regclass('public.post_share_links') as post_share_links,
  to_regclass('public.cart_post_share_attributions') as cart_post_share_attributions,
  to_regclass('public.order_referral_earnings') as order_referral_earnings,
  to_regclass('public.referral_wallets') as referral_wallets,
  to_regclass('public.referral_wallet_transactions') as referral_wallet_transactions,
  to_regclass('public.referral_withdrawal_requests') as referral_withdrawal_requests;

select
  exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'create_post_share_link'
  ) as has_create_post_share_link,
  exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'attach_post_share_to_cart'
  ) as has_attach_post_share_to_cart,
  exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'get_referral_earnings_summary'
  ) as has_get_referral_earnings_summary,
  exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'request_referral_withdrawal'
  ) as has_request_referral_withdrawal,
  exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'process_referral_withdrawal'
  ) as has_process_referral_withdrawal;

select
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.posts'::regclass
      and tgname = 'trg_generate_post_referral_program'
      and not tgisinternal
  ) as post_reward_trigger_active,
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.order_items'::regclass
      and tgname = 'trg_attribute_order_item_to_share'
      and not tgisinternal
  ) as share_attribution_trigger_active,
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.orders'::regclass
      and tgname = 'trg_settle_post_referral_earnings'
      and not tgisinternal
  ) as settlement_trigger_active;

select
  has_table_privilege('authenticated', 'public.post_share_links', 'SELECT') as can_select_share_link_public_columns,
  has_table_privilege('authenticated', 'public.cart_post_share_attributions', 'SELECT,INSERT,DELETE') as can_manage_own_cart_attribution,
  has_table_privilege('authenticated', 'public.order_referral_earnings', 'SELECT') as can_read_own_earnings,
  has_table_privilege('authenticated', 'public.referral_wallets', 'SELECT') as can_read_own_referral_wallet,
  has_table_privilege('authenticated', 'public.referral_wallet_transactions', 'SELECT') as can_read_own_referral_transactions,
  has_table_privilege('authenticated', 'public.referral_withdrawal_requests', 'SELECT') as can_read_referral_withdrawals;

select
  c.table_name,
  c.column_name,
  c.data_type
from information_schema.columns c
where c.table_schema = 'public'
  and (
    (c.table_name = 'post_share_links' and c.column_name in ('post_id','sharer_id','code','is_active'))
    or (c.table_name = 'cart_post_share_attributions' and c.column_name in ('cart_id','product_id','share_link_id','share_code'))
    or (c.table_name = 'order_referral_earnings' and c.column_name in ('beneficiary_user_id','share_link_id','earning_iqd','status'))
  )
order by c.table_name, c.ordinal_position;

select
  p.oid::regprocedure as function_signature,
  p.prosecdef as security_definer,
  p.proconfig as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','private')
  and p.proname in (
    'create_post_share_link',
    'attach_post_share_to_cart',
    'get_referral_earnings_summary',
    'request_referral_withdrawal',
    'process_referral_withdrawal',
    'attribute_order_item_to_share',
    'generate_post_referral_program',
    'settle_post_referral_earnings'
  )
order by n.nspname, p.proname, p.oid::regprocedure::text;
