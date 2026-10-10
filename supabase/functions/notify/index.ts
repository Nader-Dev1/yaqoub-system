// إشعارات يعقوب (Web Push) — Supabase Edge Function
// بتتنادى كل 10 دقايق من pg_cron، وبتحسب التنبيهات لكل مستخدم عنده جهاز مسجّل وتبعتها.
// ملاحظة: النشر لازم يكون بإيقاف "Verify JWT" لأن النداء من الجدولة مفيهوش JWT (الحماية بـ NOTIFY_SECRET).
import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (k: string) => Deno.env.get(k) ?? '';
const TZ = env('APP_TIMEZONE') || 'Asia/Riyadh';
const BRIEF_HOUR = Number(env('BRIEF_HOUR') || '8');        // ساعة ملخص الصبح
const QUIET_FROM = Number(env('QUIET_FROM') || '23');       // من الساعة دي
const QUIET_TO = Number(env('QUIET_TO') || '7');            // لحد الساعة دي (من غير إشعارات)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-notify-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

/* =========================================================
   Web Push: التشفير (RFC 8291) + VAPID (RFC 8292) بـ WebCrypto بس
   ========================================================= */
const te = new TextEncoder();
const b64u = (buf: ArrayBuffer | Uint8Array): string => {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64u = (str: string): Uint8Array => {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const concat = (...arrs: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let p = 0;
  for (const a of arrs) { out.set(a, p); p += a.length; }
  return out;
};

async function importVapid(pub: string, priv: string): Promise<CryptoKey> {
  const p = unb64u(pub); // 65 بايت: 0x04 || x || y
  return await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x: b64u(p.slice(1, 33)), y: b64u(p.slice(33, 65)), d: priv, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
  );
}

async function vapidHeader(endpoint: string, key: CryptoKey, pub: string, subject: string): Promise<string> {
  const header = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64u(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(header + '.' + payload));
  return 'vapid t=' + header + '.' + payload + '.' + b64u(sig) + ', k=' + pub;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bits: number): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, bits));
}

export async function encryptPayload(sub: { p256dh: string; auth: string }, data: Uint8Array): Promise<Uint8Array> {
  const ua = unb64u(sub.p256dh), auth = unb64u(sub.auth);
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(auth, secret, concat(te.encode('WebPush: info\0'), ua, asPub), 256);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 128);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 96);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(data, new Uint8Array([2]))));
  return concat(salt, new Uint8Array([0, 0, 0x10, 0]), new Uint8Array([asPub.length]), asPub, ct);
}

export async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string }, payload: unknown, vapid: { key: CryptoKey; pub: string; subject: string },
  opts: { ttl?: number; urgency?: string } = {},
): Promise<number> {
  let text = JSON.stringify(payload);
  if (te.encode(text).length > 3000) text = JSON.stringify({ ...(payload as any), body: String((payload as any).body ?? '').slice(0, 200) });
  const body = await encryptPayload(sub, te.encode(text));
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
      TTL: String(opts.ttl ?? 3600), Urgency: opts.urgency ?? 'normal',
      Authorization: await vapidHeader(sub.endpoint, vapid.key, vapid.pub, vapid.subject),
    },
    body,
  });
  try { await r.arrayBuffer(); } catch { /* تجاهل */ }
  return r.status;
}

/* =========================================================
   حساب التنبيهات (نفس قواعد التطبيق)
   ========================================================= */
const localHour = (d: Date) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(d));
const localDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d); // YYYY-MM-DD
const timeStr = (d: Date) => new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(d);
const daysSince = (d: Date, now: Date) => Math.floor((now.getTime() - d.getTime()) / 864e5);
const REASONS: Record<string, string> = { client_refused: 'رفض العميل', no_solution: 'مالوش حل', engineer_failed: 'المهندس لم يتوصل لحل', other: 'سبب آخر' };
const YEAR_H = 24 * 365;

type Item = { key: string; cooldownH: number; title: string; body: string; url: string; urgency?: string };

export function buildItems(visits: any[], names: Map<string, string>, st: any, now: Date): Item[] {
  const items: Item[] = [];
  const today = localDay(now);
  for (const v of visits) {
    const name = names.get(v.client_id) ?? 'عميل';
    const at = new Date(v.at);
    const url = '#/visit/' + v.id;
    if (v.status === 'scheduled') {
      if (at < now) {
        if (now.getTime() - at.getTime() < 2 * 864e5) {
          items.push({ key: 'late:' + v.id, cooldownH: YEAR_H, title: 'ميعاد فايت', body: name + '، كان الساعة ' + timeStr(at), url, urgency: 'high' });
        }
      } else {
        const mins = Math.round((at.getTime() - now.getTime()) / 60000);
        if (mins <= st.remind) {
          items.push({ key: 'soon:' + v.id, cooldownH: YEAR_H, title: 'ميعاد قرب', body: name + ' بعد ' + mins + ' دقيقة (' + timeStr(at) + ')', url, urgency: 'high' });
        }
      }
    } else if (v.status === 'done') {
      if (v.kind === 'inspection') {
        if (!v.quote_sent && daysSince(at, now) >= st.quote) {
          items.push({ key: 'noquote:' + v.id, cooldownH: 48, title: 'معاينة من غير كوتيشن', body: name + '، عدّى ' + daysSince(at, now) + ' يوم', url });
        } else if (v.quote_sent && v.decision === 'pending') {
          const sent = v.quote_sent_at ? new Date(v.quote_sent_at + 'T12:00:00Z') : at;
          if (daysSince(sent, now) >= st.follow) {
            items.push({ key: 'quotewait:' + v.id, cooldownH: 72, title: 'كوتيشن من غير رد', body: name + '، اتبعت من ' + daysSince(sent, now) + ' يوم. كلّم العميل', url });
          }
        }
      }
      if (v.kind === 'fault' && v.resolved === false) {
        const due = !!v.follow_up_date && v.follow_up_date <= today;
        items.push({
          key: (due ? 'fupdue:' : 'openfault:') + v.id, cooldownH: due ? 24 : 72,
          title: due ? 'متابعة عطل مستحقة' : 'عطل لسه مفتوح',
          body: name + (REASONS[v.unresolved_reason] ? '، ' + REASONS[v.unresolved_reason] : ''), url, urgency: due ? 'high' : 'normal',
        });
      }
    }
  }
  return items;
}

export function buildBrief(visits: any[], items: Item[], now: Date): Item | null {
  if (localHour(now) !== BRIEF_HOUR) return null;
  const today = localDay(now);
  const mine = visits.filter((v) => v.status === 'scheduled' && localDay(new Date(v.at)) === today)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const follow = items.filter((i) => !i.key.startsWith('late:') && !i.key.startsWith('soon:')).length;
  if (!mine.length && !follow) return null;
  const parts: string[] = [];
  if (mine.length) parts.push((mine.length === 1 ? 'عندك ميعاد واحد' : 'عندك ' + mine.length + ' مواعيد') + ' النهارده، ' + (mine.length === 1 ? 'الساعة ' : 'أولهم الساعة ') + timeStr(new Date(mine[0].at)));
  if (follow) parts.push(follow === 1 ? 'حاجة واحدة محتاجة متابعة' : follow + ' حاجات محتاجة متابعة');
  return { key: 'brief:' + today, cooldownH: 20, title: 'صباح الخير', body: parts.join('، '), url: '#/home' };
}

/* =========================================================
   الخدمة
   ========================================================= */
function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const pub = env('VAPID_PUBLIC_KEY'), priv = env('VAPID_PRIVATE_KEY');
  if (!pub || !priv) return json({ error: 'VAPID_PUBLIC_KEY و VAPID_PRIVATE_KEY مش متضبطين في Secrets' }, 500);
  const url = env('SUPABASE_URL');
  const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'));

  // 1) مين بيناديني؟ الجدولة (بالسر) أو مستخدم مسجّل (للتجربة بس)
  const secret = req.headers.get('x-notify-secret') ?? '';
  let ownerFilter: string | null = null;
  let test = false;
  let body: any = {};
  try { body = await req.json(); } catch { /* فاضي */ }
  if (secret && env('NOTIFY_SECRET') && safeEq(secret, env('NOTIFY_SECRET'))) {
    test = !!body.test_all;
  } else {
    const sbUser = createClient(url, env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: u } = await sbUser.auth.getUser();
    if (!u?.user) return json({ error: 'غير مصرح' }, 401);
    if (!body.test) return json({ error: 'غير مصرح' }, 403);
    ownerFilter = u.user.id;
    test = true;
  }

  let vk: CryptoKey;
  try { vk = await importVapid(pub, priv); } catch (e) { return json({ error: 'مفاتيح VAPID مش صالحة: ' + String((e as Error).message || e).slice(0, 120) }, 500); }
  const vapid = { key: vk, pub, subject: env('VAPID_SUBJECT') || 'mailto:admin@example.com' };

  // 2) الأجهزة المسجّلة
  let q = admin.from('push_subscriptions').select('id,owner,endpoint,p256dh,auth');
  if (ownerFilter) q = q.eq('owner', ownerFilter);
  const { data: subs, error } = await q;
  if (error) return json({ error: error.message }, 500);
  const byOwner = new Map<string, any[]>();
  for (const s of subs ?? []) { if (!byOwner.has(s.owner)) byOwner.set(s.owner, []); byOwner.get(s.owner)!.push(s); }

  const now = new Date();
  const hour = localHour(now);
  const quiet = QUIET_FROM > QUIET_TO ? (hour >= QUIET_FROM || hour < QUIET_TO) : (hour >= QUIET_FROM && hour < QUIET_TO);
  const summary = { owners: byOwner.size, sent: 0, removed: 0, skipped: 0 };

  const deliver = async (list: any[], payload: any, urgency?: string) => {
    let okCount = 0;
    for (const s of list) {
      let status = 0;
      try { status = await sendWebPush(s, payload, vapid, { urgency }); } catch (e) { console.error('push error', String(e)); }
      if (status >= 200 && status < 300) okCount++;
      else if (status === 404 || status === 410) { await admin.from('push_subscriptions').delete().eq('id', s.id); summary.removed++; }
    }
    return okCount;
  };

  for (const [owner, list] of byOwner) {
    if (test) {
      summary.sent += await deliver(list, { title: 'يعقوب', body: 'الإشعارات شغالة على جهازك ✓', url: '#/home', tag: 'test' });
      continue;
    }
    const [settings, vis, cli] = await Promise.all([
      admin.from('settings').select('alert_quote_days,alert_followup_days,remind_before_min').eq('owner', owner).maybeSingle(),
      admin.from('visits').select('id,client_id,status,kind,at,quote_sent,quote_sent_at,decision,resolved,follow_up_date,unresolved_reason')
        .eq('owner', owner).or('status.eq.scheduled,and(status.eq.done,kind.in.(inspection,fault))').limit(3000),
      admin.from('clients').select('id,name').eq('owner', owner),
    ]);
    const st = {
      quote: settings.data?.alert_quote_days ?? 3, follow: settings.data?.alert_followup_days ?? 7, remind: settings.data?.remind_before_min ?? 60,
    };
    const names = new Map<string, string>((cli.data ?? []).map((c: any) => [c.id, c.name]));
    const items = buildItems(vis.data ?? [], names, st, now);
    const brief = buildBrief(vis.data ?? [], items, now);
    if (brief) items.push(brief);

    // مرة واحدة بس لكل تنبيه (أو بعد فترة التهدئة)
    const keys = items.map((i) => i.key);
    const logs = keys.length ? (await admin.from('push_log').select('key,sent_at').eq('owner', owner).in('key', keys)).data ?? [] : [];
    const last = new Map<string, number>(logs.map((l: any) => [l.key, new Date(l.sent_at).getTime()]));
    let fresh = items.filter((i) => !last.has(i.key) || now.getTime() - (last.get(i.key) as number) >= i.cooldownH * 36e5);
    if (quiet) { summary.skipped += fresh.length; continue; }
    if (!fresh.length) continue;

    let okCount = 0;
    if (fresh.length > 3) {
      const first = fresh.filter((i) => !i.key.startsWith('brief:')).slice(0, 3).map((i) => i.title + ': ' + i.body.split('،')[0]);
      okCount = await deliver(list, { title: 'محتاج متابعة (' + fresh.length + ')', body: first.join('\n'), url: '#/home', tag: 'digest' });
    } else {
      for (const it of fresh) {
        const n = await deliver(list, { title: it.title, body: it.body, url: it.url, tag: it.key }, it.urgency);
        okCount = Math.max(okCount, n);
      }
    }
    if (okCount > 0) {
      summary.sent += fresh.length;
      await admin.from('push_log').upsert(fresh.map((i) => ({ owner, key: i.key, sent_at: now.toISOString() })), { onConflict: 'owner,key' });
    }
  }
  return json(summary);
});
