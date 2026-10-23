-- Run after setting NOTIFY_SECRET in Edge Function Secrets.
-- Replace <PROJECT_REF> and <NOTIFY_SECRET> before executing.
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule(
  'yaqoub-notify',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', '<NOTIFY_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
