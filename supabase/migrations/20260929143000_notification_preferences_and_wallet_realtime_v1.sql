-- SHAKH Stage 7: notification preferences, per-recipient routing and wallet realtime notices.

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS wallet_notifications boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS notifications_user_unread_created_idx
  ON public.notifications(user_id, is_read, created_at desc);

CREATE OR REPLACE FUNCTION public.handle_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  status_title text;
  status_body text;
  store_owner uuid;
  admin_user record;
  customer_order_pref boolean := true;
  customer_delivery_pref boolean := true;
  captain_delivery_pref boolean := true;
  vendor_order_pref boolean := true;
BEGIN
  IF tg_op='INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR NEW.captain_id IS DISTINCT FROM OLD.captain_id THEN
    status_title := CASE NEW.status
      WHEN 'pending' THEN 'داواکارییەکەت تۆمار کرا'
      WHEN 'accepted' THEN 'داواکارییەکەت قبوڵ کرا'
      WHEN 'preparing' THEN 'داواکارییەکەت ئامادە دەکرێت'
      WHEN 'ready_for_pickup' THEN 'داواکارییەکە ئامادەی وەرگرتنە'
      WHEN 'assigned_to_captain' THEN 'کاپتن بۆ داواکارییەکەت دیاریکرا'
      WHEN 'picked_up' THEN 'کاپتن داواکارییەکەی وەرگرت'
      WHEN 'on_the_way' THEN 'داواکارییەکەت لە ڕێگایە'
      WHEN 'delivered' THEN 'داواکارییەکەت گەیەندرا'
      WHEN 'cancelled' THEN 'داواکارییەکەت هەڵوەشێنرایەوە'
      ELSE 'دۆخی داواکاری نوێ کرایەوە'
    END;

    status_body := CASE NEW.status
      WHEN 'pending' THEN 'داواکارییەکەت بە سەرکەوتوویی تۆمار کرا و لە چاوەڕوانییە.'
      WHEN 'accepted' THEN 'دوکان داواکارییەکەی قبوڵ کرد.'
      WHEN 'preparing' THEN 'دوکان دەستی بە ئامادەکردنی داواکارییەکە کردووە.'
      WHEN 'ready_for_pickup' THEN 'داواکارییەکە ئامادەی وەرگرتنە.'
      WHEN 'assigned_to_captain' THEN 'کاپتنێک بۆ گەیاندنی داواکارییەکەت دیاریکرا.'
      WHEN 'picked_up' THEN 'کاپتن داواکارییەکەی لە دوکان وەرگرت.'
      WHEN 'on_the_way' THEN 'کاپتن لە ڕێگای گەیاندنی داواکارییەکەتە.'
      WHEN 'delivered' THEN 'داواکارییەکەت بە سەرکەوتوویی گەیەندرا.'
      WHEN 'cancelled' THEN 'داواکارییەکەت هەڵوەشێنرایەوە.'
      ELSE 'دۆخی داواکارییەکەت نوێ کرایەوە.'
    END;

    SELECT COALESCE(
      (SELECT up.order_notifications FROM public.user_preferences up WHERE up.user_id = NEW.customer_id),
      true
    ) INTO customer_order_pref;

    SELECT COALESCE(
      (SELECT up.delivery_notifications FROM public.user_preferences up WHERE up.user_id = NEW.customer_id),
      true
    ) INTO customer_delivery_pref;

    IF NEW.captain_id IS NOT NULL THEN
      SELECT coalesce(delivery_notifications,true)
      INTO captain_delivery_pref
      FROM public.user_preferences
      WHERE user_id = NEW.captain_id;
    END IF;

    IF NEW.store_id IS NOT NULL THEN
      SELECT s.owner_id INTO store_owner
      FROM public.stores s
      WHERE s.id = NEW.store_id;

      IF store_owner IS NOT NULL THEN
        SELECT COALESCE(
          (SELECT up.order_notifications FROM public.user_preferences up WHERE up.user_id = store_owner),
          true
        ) INTO vendor_order_pref;
      END IF;
    END IF;

    IF tg_op='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.order_status_history(order_id,status,changed_by)
      VALUES(NEW.id,NEW.status,auth.uid());
    END IF;

    IF NEW.customer_id IS NOT NULL
       AND (tg_op='INSERT' OR NEW.status IS DISTINCT FROM OLD.status)
       AND customer_order_pref THEN
      INSERT INTO public.notifications(user_id,title,body,type,is_read,data)
      VALUES(
        NEW.customer_id,status_title,status_body,'order_status',false,
        jsonb_build_object('order_id',NEW.id,'status',NEW.status)
      );
    END IF;

    IF NEW.captain_id IS NOT NULL
       AND (tg_op='INSERT' OR NEW.captain_id IS DISTINCT FROM OLD.captain_id OR NEW.status IS DISTINCT FROM OLD.status)
       AND captain_delivery_pref
       AND NEW.captain_id IS DISTINCT FROM NEW.customer_id THEN
      INSERT INTO public.notifications(user_id,title,body,type,is_read,data)
      VALUES(
        NEW.captain_id,'نوێکردنەوەی گەیاندن',status_body,'delivery',false,
        jsonb_build_object('order_id',NEW.id,'status',NEW.status)
      );
    END IF;

    IF NEW.captain_id IS NOT NULL
       AND NEW.captain_id IS DISTINCT FROM OLD.captain_id
       AND NEW.status='assigned_to_captain'
       AND customer_delivery_pref
       AND NEW.customer_id IS NOT NULL THEN
      INSERT INTO public.notifications(user_id,title,body,type,is_read,data)
      VALUES(
        NEW.customer_id,
        'شوێنی گەیاندنەکەت بۆ کاپتن دەرکرا',
        'کاپتن بۆ ئەم ئۆردەرە دیاریکراوە و دەتوانێت شوێنی گەیاندنەکەت ببینێت بۆ ئەنجامدانی گەیاندن.',
        'location_privacy',
        false,
        jsonb_build_object('order_id',NEW.id,'captain_id',NEW.captain_id,'status',NEW.status)
      );
    END IF;

    IF store_owner IS NOT NULL
       AND (tg_op='INSERT' OR NEW.status IS DISTINCT FROM OLD.status)
       AND vendor_order_pref
       AND store_owner IS DISTINCT FROM NEW.customer_id
       AND store_owner IS DISTINCT FROM NEW.captain_id THEN
      INSERT INTO public.notifications(user_id,title,body,type,is_read,data)
      VALUES(
        store_owner,
        CASE WHEN NEW.status='pending' THEN 'ئۆردەری نوێ بۆ دوکان' ELSE 'نوێکردنەوەی ئۆردەر' END,
        CASE WHEN NEW.status='pending' THEN 'کڕیارێک ئۆردەرێکی نوێی بۆ دوکانەکەت داوا کردووە.' ELSE status_body END,
        'vendor_order',
        false,
        jsonb_build_object('order_id',NEW.id,'status',NEW.status,'store_id',NEW.store_id)
      );
    END IF;

    IF tg_op='INSERT' AND NEW.status='pending' THEN
      FOR admin_user IN
        SELECT id
        FROM public.profiles
        WHERE role IN ('super_admin','admin')
          AND id IS DISTINCT FROM NEW.customer_id
      LOOP
        INSERT INTO public.notifications(user_id,title,body,type,is_read,data)
        VALUES(
          admin_user.id,
          'ئۆردەری نوێی شاخ',
          'داواکارییەکی نوێ لە شاخ تۆمار کراوە.',
          'admin_order',
          false,
          jsonb_build_object(
            'order_id',NEW.id,'store_id',NEW.store_id,
            'customer_id',NEW.customer_id,'status',NEW.status
          )
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_wallet_transaction_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  recipient_id uuid;
  wallet_pref boolean := true;
  notification_title text;
  notification_body text;
  wallet_order_id uuid := NULL;
BEGIN
  IF COALESCE(NEW.amount_iqd,0) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT w.user_id INTO recipient_id
  FROM public.wallets w
  WHERE w.id = NEW.wallet_id;

  IF recipient_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(
    (SELECT up.wallet_notifications FROM public.user_preferences up WHERE up.user_id = recipient_id),
    true
  ) INTO wallet_pref;

  IF NOT wallet_pref THEN
    RETURN NEW;
  END IF;

  IF NEW.type IN ('debit','refund','earning','commission') THEN
    wallet_order_id := NEW.reference_id;
  END IF;

  CASE NEW.type
    WHEN 'debit' THEN
      notification_title := 'پارە لە جزدان کەم کرا';
      notification_body := 'بڕی ' || to_char(NEW.amount_iqd,'FM999G999G999G990') || ' د.ع لە جزدانت خەرج کرا.';
    WHEN 'refund' THEN
      notification_title := 'پارە بۆ جزدان گەڕێندرایەوە';
      notification_body := 'بڕی ' || to_char(NEW.amount_iqd,'FM999G999G999G990') || ' د.ع بۆ جزدانت گەڕێندرایەوە.';
    WHEN 'earning' THEN
      notification_title := 'داهات بۆ جزدان زیاد کرا';
      notification_body := 'بڕی ' || to_char(NEW.amount_iqd,'FM999G999G999G990') || ' د.ع وەک داهات زیاد کرا.';
    WHEN 'credit' THEN
      notification_title := 'باڵانسی جزدان زیاد کرا';
      notification_body := 'بڕی ' || to_char(NEW.amount_iqd,'FM999G999G999G990') || ' د.ع بۆ جزدانت زیاد کرا.';
    WHEN 'withdrawal' THEN
      notification_title := 'پارە لە جزدان دەرکرا';
      notification_body := 'بڕی ' || to_char(NEW.amount_iqd,'FM999G999G999G990') || ' د.ع لە جزدانت دەرکرا.';
    WHEN 'commission' THEN
      notification_title := 'کۆمسیۆن لە جزدان تۆمار کرا';
      notification_body := 'بڕی ' || to_char(NEW.amount_iqd,'FM999G999G999G990') || ' د.ع کۆمسیۆن تۆمار کرا.';
    ELSE
      notification_title := 'نوێکردنەوەی جزدان';
      notification_body := COALESCE(NEW.description,'مامەڵەیەکی نوێ لە جزدان تۆمار کرا.');
  END CASE;

  INSERT INTO public.notifications(user_id,title,body,type,is_read,data)
  VALUES(
    recipient_id,
    notification_title,
    notification_body,
    'wallet',
    false,
    jsonb_build_object(
      'wallet_id',NEW.wallet_id,
      'transaction_id',NEW.id,
      'reference_id',NEW.reference_id,
      'order_id',wallet_order_id,
      'transaction_type',NEW.type,
      'amount_iqd',NEW.amount_iqd
    )
  );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_order_status_change() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.handle_wallet_transaction_notification() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS trg_wallet_transaction_notifications ON public.wallet_transactions;
CREATE TRIGGER trg_wallet_transaction_notifications
AFTER INSERT ON public.wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_wallet_transaction_notification();
