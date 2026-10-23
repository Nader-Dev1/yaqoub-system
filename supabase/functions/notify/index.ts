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
    signal: AbortSignal.timeout(10000),
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

type Item = { key: string; cooldownH: number; title: string; body: string; url: string; urgency?: string; standalone?: boolean; allowQuiet?: boolean; ttl?: number };

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

  const parts: string[] = ['صباح الخير، ربنا يبارك يومك. حدّد أهم مهمة وابدأ بيها.'];
  if (mine.length) parts.push((mine.length === 1 ? 'عندك ميعاد واحد' : 'عندك ' + mine.length + ' مواعيد') + ' النهارده، ' + (mine.length === 1 ? 'الساعة ' : 'أولهم الساعة ') + timeStr(new Date(mine[0].at)));
  if (follow) parts.push(follow === 1 ? 'حاجة واحدة محتاجة متابعة' : follow + ' حاجات محتاجة متابعة');
  return { key: 'brief:' + today, cooldownH: 20, title: 'صباح الخير', body: parts.join('، '), url: '#/home', standalone: true };
}

/* =========================================================
   الخدمة
   ========================================================= */

const VERSES = [
  { text: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا', ref: 'الشرح: 5', source: 'https://quran.com/94/5' },
  { text: 'وَقُلْ رَبِّ زِدْنِي عِلْمًا', ref: 'من سورة طه: 114', source: 'https://quran.com/20/114' },
];
const HADITHS = [
  { text: 'احْرِصْ عَلَى مَا يَنْفَعُكَ وَاسْتَعِنْ بِاللَّهِ وَلَا تَعْجَزْ', ref: 'من حديث صحيح مسلم 2664', source: 'https://sunnah.com/muslim:2664' },
  { text: 'وَالْكَلِمَةُ الطَّيِّبَةُ صَدَقَةٌ', ref: 'من حديث صحيح البخاري 2989', source: 'https://sunnah.com/bukhari:2989' },
];
const TIPS = [
  'قبل تغيير إعدادات راوتر أو سنترال، خد نسخة احتياطية وسجّل التغيير وخطة الرجوع.',
  'في مشكلة كاميرا IP: راجع الطاقة والكابل وعنوان IP والوصول من نفس الشبكة قبل تغيير الإعدادات.',
  'في الصوت باتجاه واحد بالـ VoIP: افحص مسار RTP وNAT وقواعد الفايروول قبل تعديلها.',
  'قبل إضافة كاميرات PoE، راجع ميزانية الطاقة الكلية للسويتش واستهلاك كل جهاز.',
  'سمّي الكابلات والبورتات وحدّث رسم الشبكة؛ التوثيق بيوفر وقت التشخيص في الزيارة الجاية.',
  'في تعارض IP، راجع DHCP والـ reservations والعناوين الثابتة وسجّل سبب التعارض.',
  'بعد كل إصلاح اختبر الخدمة مع العميل وسجّل السبب والحل، مش مجرد إن الجهاز اشتغل.',
];
const MOTIVATION = [
  'ابدأ بمهمة واحدة واضحة؛ الإنجاز الصغير المنتظم بيفرق.',
  'رتّب أولوياتك: العطل المؤثر أولًا، وبعده المتابعات اللي مستنية قرار.',
  'اتعلم حاجة صغيرة وطبّقها النهارده. التقدم مش لازم يكون قفزة كبيرة.',
  'خد نفس وراجع الدليل قبل أي تعديل؛ الهدوء جزء من شطارتك.',
  'متنساش وقت للراحة والمية وسط الزيارات؛ صحتك تستاهل اهتمامك.',
  'متابعة عميل قديم ممكن تكون أهم من مكالمة جديدة. اختار متابعة وخلصها.',
  'دوّن اللي اتعلمته من عطل النهارده عشان يبقى خبرة متاحة بكرة.',
];
const localMinute = (d: Date) => {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  return Number(p.find(x => x.type === 'hour')!.value) * 60 + Number(p.find(x => x.type === 'minute')!.value);
};
export function buildDailyItems(now: Date): Item[] {
  const day = localDay(now);
  const index = Math.floor(Date.parse(day + 'T00:00:00Z') / 86400000);
  const minute = localMinute(now);
  const items: Item[] = [];
  const add = (at: number, key: string, title: string, body: string) => {
    if (minute >= at && minute < at + 10) items.push({ key: 'daily:' + key + ':' + day, cooldownH: YEAR_H, title, body, url: '#/home', standalone: true });
  };
  add(7 * 60, 'morning-dhikr', 'تذكير بأذكار الصباح', 'خد دقائق لأذكار الصباح وابدأ يومك بذكر الله.');
  add(11 * 60, 'motivation', 'خطوة لقدام', MOTIVATION[index % MOTIVATION.length]);
  add(14 * 60, 'technical', 'معلومة تقنية', TIPS[index % TIPS.length]);
  const verse = VERSES[index % VERSES.length];
  add(16 * 60, 'quran', 'آية وتذكير', '﴿' + verse.text + '﴾ — ' + verse.ref);
  add(18 * 60, 'evening-dhikr', 'تذكير بأذكار المساء', 'افتكر أذكار المساء، وخد لحظة هدوء وذكر وسط يومك.');
  const hadith = HADITHS[index % HADITHS.length];
  add(19 * 60, 'hadith', 'من هدي النبي ﷺ', '«' + hadith.text + '» — ' + hadith.ref);
  add(21 * 60, 'evening', 'مساء الخير', 'سجّل الزيارات اللي خلصتها، راجع مواعيد بكرة، وخد وقتك للراحة.');
  return items;
}

type PrayerDay = { day: string; timings: Record<string, string> };
let prayerCache: PrayerDay | null = null;
export async function fetchPrayerDay(now: Date): Promise<PrayerDay> {
  const day = localDay(now);
  if (prayerCache?.day === day) return prayerCache;
  const [year, month, date] = day.split('-');
  const response = await fetch('https://api.aladhan.com/v1/timingsByCity/' + date + '-' + month + '-' + year +
    '?city=Riyadh&country=Saudi%20Arabia&method=4&timezonestring=Asia%2FRiyadh', { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('prayer service HTTP ' + response.status);
  const result = await response.json();
  if (result.code !== 200 || result.data?.date?.gregorian?.date !== date + '-' + month + '-' + year ||
      result.data?.meta?.timezone !== 'Asia/Riyadh') throw new Error('invalid prayer date/timezone');
  const timings = result.data.timings;
  for (const key of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
    if (!/^([01]\d|2[0-3]):[0-5]\d(?:\s|$)/.test(timings?.[key] ?? '')) throw new Error('invalid prayer timing');
  }
  prayerCache = { day, timings };
  return prayerCache;
}
export function buildPrayerItems(now: Date, prayer: PrayerDay | null, city: string): Item[] {
  if (!prayer || prayer.day !== localDay(now) || !['الرياض', 'riyadh'].includes(city.trim().toLowerCase())) return [];
  const minute = localMinute(now);
  const names: Record<string, string> = { Fajr: 'الفجر', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' };
  const items: Item[] = [];
  for (const [key, name] of Object.entries(names)) {
    const value = prayer.timings[key].slice(0, 5);
    const [hour, min] = value.split(':').map(Number);
    const at = hour * 60 + min;
    // Short window prevents stale prayer alerts after an outage.
    if (minute >= at && minute < at + 3) items.push({
      key: 'prayer:' + prayer.day + ':' + key, cooldownH: YEAR_H,
      title: 'وقت صلاة ' + name + ' — الرياض',
      body: name + ' الساعة ' + value + ' بتوقيت الرياض. مواقيت محسوبة بطريقة أم القرى.',
      url: '#/home', urgency: 'high', standalone: true, allowQuiet: true, ttl: 120,
    });
  }
  return items;
}

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
  const summary = { owners: byOwner.size, sent: 0, removed: 0, skipped: 0, prayer_available: false };
  let prayers: PrayerDay | null = null;
  if (!test) {
    try { prayers = await fetchPrayerDay(now); summary.prayer_available = true; }
    catch (error) { console.error('prayer timings unavailable', String(error)); }
  }

  const deliver = async (list: any[], payload: any, urgency?: string, ttl?: number) => {
    let okCount = 0;
    for (const s of list) {
      let status = 0;
      try { status = await sendWebPush(s, payload, vapid, { urgency, ttl }); } catch (e) { console.error('push error', String(e)); }
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
      admin.from('settings').select('alert_quote_days,alert_followup_days,remind_before_min,default_city').eq('owner', owner).maybeSingle(),
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
    items.push(...buildDailyItems(now), ...buildPrayerItems(now, prayers, settings.data?.default_city || 'الرياض'));

    // مرة واحدة بس لكل تنبيه (أو بعد فترة التهدئة)
    const keys = items.map((i) => i.key);
    const logs = keys.length ? (await admin.from('push_log').select('key,sent_at').eq('owner', owner).in('key', keys)).data ?? [] : [];
    const last = new Map<string, number>(logs.map((l: any) => [l.key, new Date(l.sent_at).getTime()]));
    let fresh = items.filter((i) => !last.has(i.key) || now.getTime() - (last.get(i.key) as number) >= i.cooldownH * 36e5);
    if (quiet) {
      summary.skipped += fresh.filter(i => !i.allowQuiet).length;
      fresh = fresh.filter(i => i.allowQuiet);
    }
    if (!fresh.length) continue;

    const delivered: Item[] = [];
    const separate = fresh.filter(i => i.standalone);
    const work = fresh.filter(i => !i.standalone);
    for (const it of separate) {
      if (await deliver(list, { title: it.title, body: it.body, url: it.url, tag: it.key }, it.urgency, it.ttl) > 0) delivered.push(it);
    }
    if (work.length > 3) {
      const body = work.slice(0, 3).map(i => i.title + ': ' + i.body.split('،')[0]).join('\n');
      if (await deliver(list, { title: 'محتاج متابعة (' + work.length + ')', body, url: '#/home', tag: 'digest' }) > 0) delivered.push(...work);
    } else {
      for (const it of work) {
        if (await deliver(list, { title: it.title, body: it.body, url: it.url, tag: it.key }, it.urgency) > 0) delivered.push(it);
      }
    }
    if (delivered.length) {
      summary.sent += delivered.length;
      const saved = await admin.from('push_log').upsert(delivered.map(i => ({ owner, key: i.key, sent_at: now.toISOString() })), { onConflict: 'owner,key' });
      if (saved.error) throw saved.error;
    }
  }
  return json(summary);
});
