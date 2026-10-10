-- =====================================================================
-- جدولة الإشعارات: بتنادي دالة notify كل 10 دقايق
-- 1) فعّل الإضافتين: Database > Extensions > pg_cron و pg_net (Enable)
-- 2) غيّر <PROJECT_REF> و <NOTIFY_SECRET> تحت (نفس قيمة السر اللي حطيته في Secrets)
-- 3) شغّل الملف في SQL Editor
-- =====================================================================
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule(
  'yaqoub-notify',
  '*/10 * * * *',
  $$
  select net.http_post(
    url     := 'https://nsqidtxbmhhdvsrwovjt.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-Aa100200300', '<NOTIFY_SECRET>'),
    body    := '{}'::jsonb
  );
  $$
);

-- لإيقافها بعدين:   select cron.unschedule('yaqoub-notify');
-- لمشاهدة آخر تشغيلات:  select * from cron.job_run_details order by start_time desc limit 10;
