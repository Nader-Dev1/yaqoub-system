/* يعقوب — التطبيق (المرحلة 1)
   عملاء + زيارات + مواعيد + تنبيهات + إحصائيات
   JavaScript عادي من غير framework عشان يفضل خفيف على الموبايل. */
(function () {
  'use strict';

  const api = window.api;
  const appEl = document.getElementById('app');
  const sheetEl = document.getElementById('sheet');
  const toastEl = document.getElementById('toast');

  /* =====================================================
     أدوات عامة
     ===================================================== */
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');

  const IC = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.5c2.2.7 3.5 2.6 3.5 5.5"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
    phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 005 5L15 12l5 2v4a2 2 0 01-2 2A16 16 0 013 5a2 2 0 012-2z"/>',
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.5"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    camera: '<path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13" r="3.5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    chev: '<path d="M15 5l-7 7 7 7"/>',
    back: '<path d="M9 5l7 7-7 7"/>',
    wa: '<path d="M3 21l1.6-5A9 9 0 1112 21a9 9 0 01-4.4-1.2L3 21z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 01-1.8-1.8l.8-1-1-2L9 9.5z"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
    logout: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
    wrench: '<path d="M14.5 6.5a4 4 0 005 5L21 13l-8 8-4-4 8-8z"/><path d="M4 20l3-3"/>',
    spark: '<path d="M12 3l2.2 6.3L20.5 12l-6.3 2.7L12 21l-2.2-6.3L3.5 12l6.3-2.7L12 3z"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
    send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>'
  };
  const icon = (n, cls) => '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + IC[n] + '</svg>';

  const YQ = window.YQ;
  const KINDS = { fault: 'عطل', inspection: 'معاينة', supply: 'توريد', install: 'تركيب', maintenance: 'صيانة دورية' };
  const REASONS = { client_refused: 'رفض العميل', no_solution: 'مالوش حل', engineer_failed: 'المهندس لم يتوصل لحل', other: 'سبب آخر' };
  const DECISIONS = { pending: 'في الانتظار', approved: 'تم التعميد', rejected: 'رفض' };
  const SUPPLY_MODES = { supply_only: 'توريد فقط', supply_maintenance: 'توريد وصيانة' };
  const CITIES = ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'الظهران', 'الأحساء', 'الجبيل', 'القطيف',
    'الطائف', 'بريدة', 'عنيزة', 'تبوك', 'حائل', 'أبها', 'خميس مشيط', 'نجران', 'جازان', 'ينبع', 'الباحة', 'عرعر', 'سكاكا',
    'الخرج', 'المجمعة', 'الدوادمي', 'وادي الدواسر', 'القريات', 'الرس', 'حفر الباطن', 'الدوحة', 'المنامة', 'مسقط', 'دبي', 'أبوظبي', 'الكويت'];
  const COUNTRIES = [['966', '🇸🇦 +966'], ['20', '🇪🇬 +20'], ['971', '🇦🇪 +971'], ['965', '🇰🇼 +965'],
    ['973', '🇧🇭 +973'], ['968', '🇴🇲 +968'], ['974', '🇶🇦 +974'], ['962', '🇯🇴 +962']];
  const DEFAULT_ABOUT = 'اسمي نادر، مهندس شبكات وبنية تحتية و IT. شغلنا: كاميرات، كنترول أكسس، مشاريع، بنية تحتية، تيرمنيشن، كونفجريشن، لو كارنت سيستم، سوفتوير، شبكات، سنترال، وخدمات كول سنتر. بنزور مواقع وعملاء كتير (غالبًا في السعودية، والرياض هي الافتراضي)، ونعمل ترابل شوت وحل مشاكل سيرفرات وتوريد.';
  const DEFAULTS = { alert_quote_days: 3, alert_followup_days: 7, remind_before_min: 60, default_city: 'الرياض', about_me: DEFAULT_ABOUT };
  const CONTACTS_OK = !!(navigator.contacts && navigator.contacts.select);

  /* ---------- التواريخ (ميلادي بأرقام إنجليزي) ---------- */
  const LOC = 'ar-SA-u-ca-gregory-nu-latn';
  const dfDay = new Intl.DateTimeFormat(LOC, { weekday: 'long', day: 'numeric', month: 'long' });
  const dfTime = new Intl.DateTimeFormat(LOC, { hour: 'numeric', minute: '2-digit' });
  const dfDate = new Intl.DateTimeFormat(LOC, { day: 'numeric', month: 'short', year: 'numeric' });
  const dfShort = new Intl.DateTimeFormat(LOC, { day: 'numeric', month: 'short' });
  const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const endOfDay = d => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
  const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();
  const dayDiff = d => Math.round((startOfDay(d) - startOfDay(new Date())) / 864e5);
  const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const toInput = d => dayKey(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  const timeOf = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
  const daysSince = d => Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
  const parseDay = s => { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const weekStart = d => { const x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 1) % 7)); return x; }; // السبت أول الأسبوع
  function relDay(d) {
    const n = dayDiff(d);
    return n === 0 ? 'النهارده' : n === 1 ? 'بكرة' : n === -1 ? 'إمبارح' : dfDay.format(d);
  }
  function nextHour() {
    const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d;
  }

  /* ---------- تليفون وموقع ---------- */
  function normPhone(raw, cc) {
    const plus = /^\s*\+/.test(String(raw || ''));
    let d = String(raw || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.indexOf('00') === 0) { d = d.slice(2); return d; }
    if (plus) return d;
    if (d.indexOf(cc) === 0 && d.length >= cc.length + 8) return d;
    return cc + d.replace(/^0+/, '');
  }
  const waLink = p => p ? 'https://wa.me/' + p : '';
  function mapLink(c) {
    if (!c) return '';
    if (c.lat != null && c.lng != null) return 'https://www.google.com/maps?q=' + c.lat + ',' + c.lng;
    if (c.map_url && /^https?:/i.test(c.map_url)) return c.map_url;
    return '';
  }
  function parseLoc(text) {
    const t = String(text || '').trim();
    if (!t) return null;
    const urlm = t.match(/https?:\/\/\S+/);
    let m = t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
      t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
      t.match(/[?&](?:q|ll|query|destination)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/i);
    if (!m && !urlm) m = t.match(/(-?\d{1,3}\.\d+)\s*[,،\s]\s*(-?\d{1,3}\.\d+)/);
    let lat = null, lng = null;
    if (m) {
      lat = parseFloat(m[1]); lng = parseFloat(m[2]);
      if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) { lat = null; lng = null; }
    }
    if (lat == null && !urlm) return null;
    return { lat, lng, url: urlm ? urlm[0] : '' };
  }
  function getPos() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) return rej(new Error('الموبايل ده مش بيدعم تحديد الموقع'));
      navigator.geolocation.getCurrentPosition(p => res(p.coords),
        () => rej(new Error('مقدرتش أحدد موقعك. اتأكد إن الموقع (GPS) شغال وإنك سمحت للمتصفح')),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
    });
  }

  /* =====================================================
     الحالة
     ===================================================== */
  const S = {
    user: null, clients: [], visits: [], contacts: [], branches: [], location: null, settings: Object.assign({}, DEFAULTS),
    cmap: new Map(), vmap: new Map(), ctmap: new Map(),
    apptTab: 'up', cq: '', range: null, loadedAt: 0,
    chat: [], chatBusy: false, asked: new Set()
  };
  let F = null; // حالة الفورم الحالي

  function reindex() {
    S.visits.sort((a, b) => new Date(b.at) - new Date(a.at));
    S.cmap = new Map(S.clients.map(c => [c.id, c]));
    S.vmap = new Map(S.visits.map(v => [v.id, v]));
    S.ctmap = new Map();
    S.contacts.forEach(k => { if (!S.ctmap.has(k.client_id)) S.ctmap.set(k.client_id, []); S.ctmap.get(k.client_id).push(k); });
  }
  const visitsOf = id => S.visits.filter(v => v.client_id === id);
  function upsertVisit(v) {
    const i = S.visits.findIndex(x => x.id === v.id);
    if (i >= 0) S.visits[i] = v; else S.visits.push(v);
    reindex();
  }
  function upsertClient(c) {
    const i = S.clients.findIndex(x => x.id === c.id);
    if (i >= 0) S.clients[i] = c; else S.clients.push(c);
    S.clients.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    reindex();
  }
  async function loadData() {
    const d = await api.loadAll();
    S.clients = d.clients; S.visits = d.visits; S.contacts = d.contacts || []; S.branches = d.branches || [];
    S.settings = Object.assign({}, DEFAULTS, d.settings || {});
    if (!S.settings.about_me) S.settings.about_me = DEFAULT_ABOUT;
    S.loadedAt = Date.now();
    reindex();
  }

  /* =====================================================
     رسائل وأخطاء
     ===================================================== */
  let toastT;
  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = 'show ' + (kind || '');
    clearTimeout(toastT);
    toastT = setTimeout(() => { toastEl.className = ''; }, 2800);
  }
  function fail(e) {
    console.error(e);
    let m = (e && e.message) || 'حصلت مشكلة';
    if (/Failed to fetch|Failed to send a request|NetworkError|network/i.test(m)) m = 'مفيش اتصال بالنت. الحاجة دي محتاجة نت';
    toast(m, 'err');
  }

  /* =====================================================
     التنبيهات
     ===================================================== */
  function computeAlerts() {
    const now = new Date(), st = S.settings, out = [];
    const rank = { late: 0, soon: 1, warn: 2 };
    S.visits.forEach(v => {
      const c = S.cmap.get(v.client_id), name = c ? c.name : 'عميل';
      const at = new Date(v.at);
      if (v.status === 'scheduled') {
        if (at < now) {
          out.push({ level: 'late', icon: 'clock', v, at, title: 'ميعاد فايت: ' + name, sub: relDay(at) + '، ' + dfTime.format(at) + ' (' + KINDS[v.kind] + ')' });
        } else {
          const mins = Math.round((at - now) / 60000);
          if (mins <= st.remind_before_min) {
            out.push({ level: 'soon', icon: 'clock', v, at, title: 'ميعاد قرب: ' + name, sub: 'بعد ' + mins + ' دقيقة، الساعة ' + dfTime.format(at) });
          }
        }
      } else if (v.status === 'done') {
        if (v.kind === 'inspection') {
          if (!v.quote_sent && daysSince(at) >= st.alert_quote_days) {
            out.push({ level: 'warn', icon: 'alert', v, at, title: 'معاينة من غير كوتيشن: ' + name, sub: 'عدّى ' + daysSince(at) + ' يوم من المعاينة' });
          } else if (v.quote_sent && v.decision === 'pending') {
            const sent = v.quote_sent_at ? parseDay(v.quote_sent_at) : at;
            if (daysSince(sent) >= st.alert_followup_days) {
              out.push({ level: 'warn', icon: 'alert', v, at, title: 'كوتيشن من غير رد: ' + name, sub: 'اتبعت من ' + daysSince(sent) + ' يوم، كلّم العميل' });
            }
          }
        }
        if (v.kind === 'fault' && v.resolved === false) {
          const due = v.follow_up_date && parseDay(v.follow_up_date) <= startOfDay(now);
          out.push({
            level: due ? 'late' : 'warn', icon: 'wrench', v, at,
            title: 'عطل مفتوح: ' + name,
            sub: (REASONS[v.unresolved_reason] || 'متحلش') + (v.follow_up_date ? '، المتابعة ' + dfShort.format(parseDay(v.follow_up_date)) : '')
          });
        }
      }
    });
    out.sort((a, b) => rank[a.level] - rank[b.level] || a.at - b.at);
    return out;
  }

  /* =====================================================
     مكونات صغيرة
     ===================================================== */
  const chip = k => '<span class="chip ' + k + '">' + (KINDS[k] || k) + '</span>';

  function statusTag(v) {
    const pr = v.priority === 'emergency' ? '<em class="tag emergency">طارئ</em>' : v.priority === 'urgent' ? '<em class="tag urgent">عاجل</em>' : '';
    return pr + statusTag0(v);
  }
  function statusTag0(v) {
    if (v.status === 'cancelled') return '<em class="tag off">ملغي</em>';
    if (v.status === 'scheduled') return new Date(v.at) < new Date() ? '<em class="tag late">فايت</em>' : '';
    if (v.kind === 'fault') return v.resolved ? '<em class="tag ok">اتحل</em>' : '<em class="tag late">مفتوح</em>';
    if (v.kind === 'inspection') {
      if (v.decision === 'approved') return '<em class="tag ok">تم التعميد</em>';
      if (v.decision === 'rejected') return '<em class="tag late">رفض</em>';
      return v.quote_sent ? '<em class="tag wait">مستني رد</em>' : '<em class="tag warn">من غير كوتيشن</em>';
    }
    return '';
  }

  function contactBtns(c, dark) {
    if (!c) return '';
    const cls = dark ? ' dark' : '';
    let h = '';
    if (c.phone) h += '<a class="ib' + cls + '" href="tel:+' + esc(c.phone) + '" aria-label="اتصال">' + icon('phone') + '</a>';
    if (c.phone) h += '<a class="ib wa" href="' + esc(waLink(c.phone)) + '" target="_blank" rel="noopener" aria-label="واتساب">' + icon('wa') + '</a>';
    const m = mapLink(c);
    if (m) h += '<a class="ib' + cls + '" href="' + esc(m) + '" target="_blank" rel="noopener" aria-label="الموقع">' + icon('pin') + '</a>';
    return h;
  }

  function vrow(v, o) {
    o = o || {};
    const c = S.cmap.get(v.client_id), at = new Date(v.at);
    const sub = [v.category, c && c.city].filter(Boolean).join('، ');
    const snip = v.status === 'done'
      ? (v.kind === 'inspection' ? v.insp_about : v.kind === 'supply' ? v.supply_items : v.description) : v.notes;
    const cls = v.status === 'scheduled' && at < new Date() ? ' late' : '';
    return '<a class="row' + cls + '" href="#/visit/' + v.id + '">' +
      '<div class="when"><b>' + dfTime.format(at) + '</b><small>' + (o.day ? esc(relDay(at)) : '') + '</small></div>' +
      '<div class="main"><div class="t">' + esc(c ? c.name : '—') + '</div>' +
      '<div class="s">' + chip(v.kind) + (sub ? '<span>' + esc(sub) + '</span>' : '') + statusTag(v) + '</div>' +
      (snip ? '<div class="snip">' + esc(snip) + '</div>' : '') + '</div>' + icon('chev', 'chev') + '</a>';
  }

  function alertRow(a) {
    return '<a class="row ' + a.level + '" href="#/visit/' + a.v.id + '"><span class="ico">' + icon(a.icon) + '</span>' +
      '<div class="main"><div class="t">' + esc(a.title) + '</div><div class="s">' + esc(a.sub) + '</div></div>' + icon('chev', 'chev') + '</a>';
  }

  const emptyState = (title, text, btn) =>
    '<div class="empty-state"><b>' + esc(title) + '</b>' + esc(text || '') + (btn || '') + '</div>';

  /* ---------- رسوم SVG خفيفة ---------- */
  const KCOL = { fault: '#0B4DB9', inspection: '#FF6600', supply: '#0E9AA7', install: '#7A4BD0', maintenance: '#B26B00' };
  function ringSvg(p, o) {
    o = o || {};
    const r = 42, C = 2 * Math.PI * r, v = p == null ? 0 : Math.max(0, Math.min(100, p));
    return '<svg class="' + (o.cls || '') + '" viewBox="0 0 100 100" role="img" aria-label="' + (p == null ? 'لا يوجد' : p + '%') + '">' +
      '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="' + (o.track || '#E3ECFB') + '" stroke-width="12"/>' +
      '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="' + (o.color || '#12906A') + '" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + (v / 100 * C).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 50 50)"/>' +
      '<text x="50" y="58" text-anchor="middle" font-size="22" font-weight="700" fill="' + (o.text || '#1E2A44') + '">' + (p == null ? '—' : p + '%') + '</text></svg>';
  }
  function donutSvg(items, total, label) {
    const r = 52, C = 2 * Math.PI * r;
    let off = 0;
    const segs = items.map(it => {
      const len = total ? it.n / total * C : 0;
      const c = '<circle cx="75" cy="75" r="' + r + '" fill="none" stroke="' + it.color + '" stroke-width="20" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 75 75)"/>';
      off += len; return c;
    }).join('');
    return '<svg class="donut" viewBox="0 0 150 150" role="img" aria-label="' + esc(label) + ' ' + total + '"><circle cx="75" cy="75" r="52" fill="none" stroke="#E7EAF6" stroke-width="20"/>' + segs +
      '<text x="75" y="76" text-anchor="middle" font-size="30" font-weight="700" fill="#1E2A44">' + total + '</text>' +
      '<text x="75" y="96" text-anchor="middle" font-size="11" fill="#66708C">' + esc(label) + '</text></svg>';
  }
  function sparkSvg(vals) {
    if (vals.length < 2) return '<p class="muted small">محتاج فترة أطول عشان يترسم الاتجاه</p>';
    const w = 300, h = 70, p = 6, max = Math.max.apply(null, vals.concat([1])), step = (w - 2 * p) / (vals.length - 1);
    const pts = vals.map((v, i) => [(p + i * step).toFixed(1), (h - p - (v / max) * (h - 2 * p)).toFixed(1)]);
    const line = pts.map(q => q[0] + ',' + q[1]).join(' ');
    const area = 'M' + pts[0][0] + ',' + (h - p) + ' L' + line.replace(/ /g, ' L') + ' L' + pts[pts.length - 1][0] + ',' + (h - p) + ' Z';
    return '<svg class="spark" viewBox="0 0 300 70" preserveAspectRatio="none" aria-hidden="true"><path d="' + area + '" fill="rgba(11,77,185,.12)"/>' +
      '<polyline points="' + line + '" fill="none" stroke="#0B4DB9" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }
  function trendValues(list, R) {
    const days = Math.round((startOfDay(R.to) - startOfDay(R.from)) / 864e5) + 1, grp = days > 45 ? 7 : 1, n = Math.ceil(days / grp);
    const arr = new Array(Math.max(n, 1)).fill(0);
    list.forEach(v => { const i = Math.floor((startOfDay(new Date(v.at)) - startOfDay(R.from)) / 864e5 / grp); if (i >= 0 && i < arr.length) arr[i]++; });
    return arr;
  }

  /* ---------- Sheet: نافذة سفلية بحقول بسيطة ---------- */
  function fieldHtml(f) {
    const id = 'sf_' + f.name;
    const req = f.required ? ' required' : '';
    let input;
    if (f.type === 'textarea') input = '<textarea id="' + id + '" name="' + f.name + '"' + req + ' placeholder="' + esc(f.placeholder || '') + '">' + esc(f.value || '') + '</textarea>';
    else if (f.type === 'select') input = '<select id="' + id + '" name="' + f.name + '"' + req + '>' +
      f.options.map(o => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(f.value) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
    else input = '<input id="' + id + '" name="' + f.name + '" type="' + (f.type || 'text') + '" value="' + esc(f.value == null ? '' : f.value) + '"' + req +
      ' placeholder="' + esc(f.placeholder || '') + '"' + (f.list ? ' list="' + f.list + '"' : '') + (f.ltr ? ' class="ltr"' : '') + '>';
    return '<div class="field"><label for="' + id + '">' + esc(f.label) + '</label>' + input + (f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '') + '</div>';
  }
  function closeSheet() { sheetEl.classList.remove('open'); sheetEl.innerHTML = ''; }
  function askSheet(o) {
    return new Promise(resolve => {
      const datalist = o.cities ? '<datalist id="cities">' + CITIES.map(c => '<option value="' + c + '">').join('') + '</datalist>' : '';
      sheetEl.innerHTML = '<div class="backdrop" data-sheet-close></div>' +
        '<form class="sheet" autocomplete="off"><div class="grab"></div><h3>' + esc(o.title) + '</h3>' +
        o.fields.map(fieldHtml).join('') + datalist +
        '<div class="btnrow">' + (o.danger ? '<button class="btn danger" type="button" data-sheet-danger>' + esc(o.danger) + '</button>' : '') +
        '<button class="btn ghost" type="button" data-sheet-close>إلغاء</button>' +
        '<button class="btn" type="submit">' + esc(o.submit || 'حفظ') + '</button></div></form>';
      sheetEl.classList.add('open');
      const form = $('form', sheetEl);
      const done = v => { closeSheet(); resolve(v); };
      form.addEventListener('submit', e => {
        e.preventDefault();
        const out = {};
        o.fields.forEach(f => { out[f.name] = form.elements[f.name].value.trim(); });
        done(out);
      });
      $$('[data-sheet-close]', sheetEl).forEach(b => b.addEventListener('click', () => done(null)));
      $$('[data-sheet-danger]', sheetEl).forEach(b => b.addEventListener('click', () => done({ __delete: true })));
      const first = form.elements[o.fields[0].name];
      if (first && o.focus !== false) setTimeout(() => first.focus(), 60);
    });
  }

  /* =====================================================
     الشاشات
     ===================================================== */
  const V = {};

  function notFound() {
    return { title: 'مش موجود', back: true, html: emptyState('الصفحة دي مش موجودة', 'يمكن اتحذفت.', '<br><a class="btn" href="#/home">الرئيسية</a>') };
  }

  /* ---------- الرئيسية ---------- */
  V.home = () => {
    const now = new Date();
    const sched = S.visits.filter(v => v.status === 'scheduled');
    const upcoming = sched.filter(v => new Date(v.at) >= now).sort((a, b) => new Date(a.at) - new Date(b.at));
    const next = upcoming[0];
    const alerts = computeAlerts();
    const done = S.visits.filter(v => v.status === 'done');
    const wk = weekStart(now), ms = new Date(now.getFullYear(), now.getMonth(), 1);
    const nWeek = done.filter(v => new Date(v.at) >= wk).length;
    const nMonth = done.filter(v => new Date(v.at) >= ms).length;
    const leftToday = upcoming.filter(v => sameDay(new Date(v.at), now)).length;

    let heroBody;
    if (next) {
      const c = S.cmap.get(next.client_id) || {}, at = new Date(next.at);
      heroBody = '<p class="hint">الميعاد الجاي</p>' +
        '<a href="#/visit/' + next.id + '"><h2>' + esc(c.name || '') + '</h2></a>' +
        '<p class="time"><b>' + dfTime.format(at) + '</b>' + esc(relDay(at)) + '</p>' +
        '<div class="meta">' + chip(next.kind) + '<span>' + esc([next.category, c.city].filter(Boolean).join('، ')) + '</span></div>' +
        '<div class="acts">' + contactBtns(c) + '</div>';
    } else {
      heroBody = '<div class="empty"><p class="hint">مفيش مواعيد جاية</p><h2>جدولك فاضي</h2>' +
        '<a class="btn" href="#/form/appt">' + icon('plus') + ' ضيف ميعاد</a></div>';
    }

    const todayList = sched.filter(v => sameDay(new Date(v.at), now)).sort((a, b) => new Date(a.at) - new Date(b.at));
    const openFaults = S.visits.filter(v => v.status === 'done' && v.kind === 'fault' && v.resolved === false).length;
    const insp90 = done.filter(v => v.kind === 'inspection' && daysSince(v.at) <= 90);
    const apprRate = insp90.length ? Math.round(insp90.filter(v => v.decision === 'approved').length / insp90.length * 100) : null;
    const tilesHtml = '<div class="tiles">' +
      '<a class="tile orange" href="#/appts">' + icon('calendar') + '<b>' + todayList.length + '</b><span>مواعيد النهارده' + (leftToday !== todayList.length ? ' (باقي ' + leftToday + ')' : '') + '</span></a>' +
      '<a class="tile blue" href="#/stats">' + icon('chart') + '<b>' + nMonth + '</b><span>زيارات الشهر، ' + nWeek + ' الأسبوع ده</span></a>' +
      '<a class="tile red" href="#/appts">' + icon('alert') + '<b>' + openFaults + '</b><span>مشاكل مفتوحة</span></a>' +
      '<a class="tile teal ringtile" href="#/stats"><span>نسبة التعميد<br><small style="opacity:.8">آخر 90 يوم</small></span>' +
      ringSvg(apprRate, { cls: 'ringbox', track: 'rgba(255,255,255,.3)', color: '#FFFFFF', text: '#FFFFFF' }) + '</a></div>';

    const html =
      '<section class="hero"><img class="art" src="icons/logo.svg" alt="">' + heroBody +
      '</section>' + tilesHtml + '<div id="pushcard"></div>' +
      (function () {
        const n = missingList().length;
        return '<a class="layla-card" href="#/layla' + (n ? '?ask=1' : '') + '"><span class="av"><img src="icons/layla.svg" alt=""></span><div class="main"><b>ليلة</b>' +
          '<span>' + (n ? n + ' زيارة ناقصها تفاصيل. تعالى أسجّلها معاك' : 'اسألني عن أي عميل أو زيارة، أو قولي أضيف ميعاد') + '</span></div>' + icon('chev', 'chev') + '</a>';
      })() +
      '<section class="block"><h3>محتاج متابعة <span class="count ' + (alerts.length ? '' : 'zero') + '">' + alerts.length + '</span></h3>' +
      (alerts.length ? '<div class="list">' + alerts.map(alertRow).join('') + '</div>'
        : emptyState('مفيش حاجة متأخرة', 'كله تمام دلوقتي.')) + '</section>' +
      (todayList.length ? '<section class="block"><h3>مواعيد النهارده</h3><div class="list">' + todayList.map(v => vrow(v)).join('') + '</div></section>' : '');
    return {
      cls: 'home', html,
      after() {
        let dismissed = false;
        try { dismissed = !!localStorage.getItem('yq_push_dismiss'); } catch (e) { /* تجاهل */ }
        if (dismissed) return;
        pushState().then(st => {
          const el = $('#pushcard'); if (!el || (st !== 'off' && st !== 'ios-install')) return;
          el.innerHTML = '<div class="layla-card" style="border-inline-start-color:var(--blue-700)"><span class="av" style="background:var(--blue-100);color:var(--blue-700);border-radius:50%;display:grid;place-items:center">' + icon('alert') + '</span>' +
            '<div class="main"><b>فعّل الإشعارات</b><span>' + (st === 'ios-install' ? 'ثبّت التطبيق على الشاشة الرئيسية الأول (أيفون)' : 'تنبيهات المواعيد والمتابعات توصلك على الموبايل') + '</span></div>' +
            (st === 'off' ? '<button class="btn sm" data-act="pushon">فعّل</button>' : '<a class="btn sm ghost" href="#/settings">إزاي؟</a>') +
            '<button class="ib" data-act="pushdismiss" aria-label="إخفاء">' + icon('x') + '</button></div>';
        });
      }
    };
  };

  /* ---------- المواعيد ---------- */
  V.appts = () => {
    const now = new Date();
    const sched = S.visits.filter(v => v.status === 'scheduled');
    const up = sched.filter(v => new Date(v.at) >= now).sort((a, b) => new Date(a.at) - new Date(b.at));
    const late = sched.filter(v => new Date(v.at) < now).sort((a, b) => new Date(a.at) - new Date(b.at));
    const done = S.visits.filter(v => v.status === 'done').slice(0, 80);
    const tab = S.apptTab;

    let body = '';
    if (tab === 'up') {
      if (!up.length) body = emptyState('مفيش مواعيد جاية', 'ضيف ميعاد وهيظهر في يومه.', '<br><a class="btn" href="#/form/appt">' + icon('plus') + ' ميعاد جديد</a>');
      else {
        const groups = [];
        up.forEach(v => {
          const k = dayKey(new Date(v.at));
          let g = groups[groups.length - 1];
          if (!g || g.k !== k) { g = { k, d: new Date(v.at), items: [] }; groups.push(g); }
          g.items.push(v);
        });
        body = groups.map(g => '<div class="dayhead">' + esc(relDay(g.d)) +
          (dayDiff(g.d) > 1 || dayDiff(g.d) < 0 ? '' : '<small>' + esc(dfDay.format(g.d)) + '</small>') +
          '<small>' + g.items.length + (g.items.length > 1 ? ' زيارات' : ' زيارة') + '</small></div>' +
          '<div class="list">' + g.items.map(v => vrow(v)).join('') + '</div>').join('');
      }
    } else if (tab === 'late') {
      body = late.length
        ? '<div class="list">' + late.map(v => '<div class="lateitem">' + vrow(v, { day: true }) +
          '<div class="quick"><button class="btn sm" data-act="complete" data-id="' + v.id + '">تمت</button>' +
          '<button class="btn sm ghost" data-act="postpone" data-id="' + v.id + '">أجّل</button>' +
          '<button class="btn sm danger" data-act="cancelv" data-id="' + v.id + '">إلغاء</button></div></div>').join('') + '</div>'
        : emptyState('مفيش مواعيد فايتة', 'كل مواعيدك متسجلة.');
    } else {
      body = done.length ? '<div class="list">' + done.map(v => vrow(v, { day: true })).join('') + '</div>'
        : emptyState('لسه مفيش زيارات متسجلة', 'سجّل أول زيارة من زرار +');
    }

    const html = '<div class="seg" role="tablist">' +
      '<button data-act="apptTab" data-t="up" class="' + (tab === 'up' ? 'on' : '') + '">قادمة</button>' +
      '<button data-act="apptTab" data-t="late" class="' + (tab === 'late' ? 'on' : '') + '">فايتة' + (late.length ? '<span class="n">' + late.length + '</span>' : '') + '</button>' +
      '<button data-act="apptTab" data-t="done" class="' + (tab === 'done' ? 'on' : '') + '">تمت</button></div>' + body;
    return { title: 'المواعيد', html };
  };

  /* ---------- إضافة ---------- */
  V.add = (p, q) => {
    const cq = q.get('client') ? '?client=' + encodeURIComponent(q.get('client')) : '';
    return {
      title: 'إضافة', back: true, nav: false,
      html: '<p class="muted" style="margin:6px 2px 16px">إيه اللي هتضيفه؟</p>' +
        '<a class="bigchoice a" href="#/form/done' + cq + '"><span class="ico">' + icon('check') + '</span><div><b>زيارة تمت</b><span>سجّل شغل خلصته (عطل، معاينة، توريد)</span></div></a>' +
        '<a class="bigchoice b" href="#/form/appt' + cq + '"><span class="ico">' + icon('calendar') + '</span><div><b>ميعاد زيارة جاية</b><span>يتحط في يومه وهفكّرك بيه</span></div></a>'
    };
  };

  /* ---------- العملاء ---------- */
  function clientListHtml() {
    const q = S.cq.trim().toLowerCase();
    const qd = q.replace(/\D/g, '');
    const list = S.clients.filter(c => !q ||
      c.name.toLowerCase().includes(q) || (c.city || '').toLowerCase().includes(q) ||
      (qd && (c.phone || '').includes(qd)) ||
      (S.ctmap.get(c.id) || []).some(k => k.name.toLowerCase().includes(q) || (qd && k.phone.includes(qd))));
    if (!list.length) return emptyState(q ? 'مفيش نتيجة' : 'لسه مفيش عملاء', q ? 'جرب كلمة تانية.' : 'هيتضافوا لما تسجل أول زيارة.');
    return '<div class="list">' + list.map(c => {
      const n = visitsOf(c.id).filter(v => v.status === 'done').length;
      return '<div class="row" data-go="/client/' + c.id + '"><div class="main"><div class="t">' + esc(c.name) + '</div>' +
        '<div class="s">' + (c.client_type ? '<span class="tag wait">' + esc(c.client_type) + '</span>' : '') + '<span>' + esc(c.city || '') + '</span>' + (c.phone ? '<span class="ltr">+' + esc(c.phone) + '</span>' : '') + '</div></div>' +
        '<span class="tag off">' + n + ' زيارة</span>' +
        (c.phone ? '<a class="ib wa" href="' + esc(waLink(c.phone)) + '" target="_blank" rel="noopener" aria-label="واتساب">' + icon('wa') + '</a>' : '') + '</div>';
    }).join('') + '</div>';
  }
  V.clients = () => ({
    title: 'العملاء',
    html: '<div class="field"><input id="cq" type="search" placeholder="ابحث بالاسم أو الرقم أو المدينة" value="' + esc(S.cq) + '"></div>' +
      '<div class="btnrow" style="margin-bottom:14px"><button class="btn sm ghost" data-act="newclient">' + icon('plus') + ' عميل جديد</button>' +
      '<button class="btn sm ghost" data-act="exportclients">' + icon('download') + ' Excel</button>' +
      '<button class="btn sm ghost" data-act="exportcsv">' + icon('download') + ' CSV</button></div>' +
      '<div id="clist">' + clientListHtml() + '</div>',
    after() {
      $('#cq').addEventListener('input', e => { S.cq = e.target.value; $('#clist').innerHTML = clientListHtml(); });
    }
  });

  /* ---------- أرقام التواصل ---------- */
  function contactRow(k, editable) {
    return '<div class="crow"><div class="main"><div class="t">' + esc(k.name) + (k.role ? ' <span class="muted small">(' + esc(k.role) + ')</span>' : '') + '</div>' +
      '<div class="s ltr">+' + esc(k.phone) + '</div></div>' +
      '<a class="ib dark" href="tel:+' + esc(k.phone) + '" aria-label="اتصال">' + icon('phone') + '</a>' +
      '<a class="ib wa" href="' + esc(waLink(k.phone)) + '" target="_blank" rel="noopener" aria-label="واتساب">' + icon('wa') + '</a>' +
      (editable ? '<button class="ib line" data-act="editcontact" data-id="' + k.id + '" aria-label="تعديل">' + icon('edit') + '</button>' : '') + '</div>';
  }
  function contactsBlock(c) {
    const list = S.ctmap.get(c.id) || [];
    return '<section class="block"><h3>أرقام التواصل <span class="count zero" style="background:var(--navy-900)">' + list.length + '</span></h3>' +
      (list.length ? '<div class="list">' + list.map(k => contactRow(k, true)).join('') + '</div>'
        : '<p class="muted small" style="margin-bottom:8px">ضيف رقم لكل شخص بتتعامل معاه عند العميل (مدير، محاسب، فني...).</p>') +
      '<div class="btnrow" style="margin-top:10px"><button class="btn sm ghost" data-act="addcontact" data-id="' + c.id + '">' + icon('plus') + ' إضافة رقم</button>' +
      (CONTACTS_OK ? '<button class="btn sm ghost" data-act="importcontacts" data-id="' + c.id + '">' + icon('users') + ' من جهات الاتصال</button>' : '') + '</div></section>';
  }

  /* ---------- صفحة عميل ---------- */
  V.client = p => {
    const c = S.cmap.get(p[0]);
    if (!c) return notFound();
    const vs = visitsOf(c.id);
    const html =
      '<div class="card-head">' + (c.client_type ? '<div class="line" style="margin:0 0 8px"><span class="chip inspection" style="background:var(--blue-100);color:var(--blue-700)">' + esc(c.client_type) + '</span></div>' : '') +
      '<h2>' + esc(c.name) + '</h2>' +
      '<div class="line">' + (c.city || c.address ? '<span>' + icon('pin') + '</span><span>' + esc([c.city, c.address].filter(Boolean).join('، ')) + '</span>' : '') +
      (c.phone ? '<span class="ltr">+' + esc(c.phone) + '</span>' : '') +
      (c.contact_name ? '<span>' + esc(c.contact_name) + (c.contact_role ? ' (' + esc(c.contact_role) + ')' : '') + '</span>' : '') + '</div>' +
      '<div class="contact">' + contactBtns(c, true) + '<button class="ib line" data-act="editclient" data-id="' + c.id + '" aria-label="تعديل">' + icon('edit') + '</button></div></div>' +
      (function () {
        const rows = [['البريد', c.email ? '<span class="ltr">' + esc(c.email) + '</span>' : ''], ['ساعات الدوام', esc(c.work_hours)], ['تعليمات الدخول', esc(c.access_notes)],
          ['الرقم الضريبي', c.tax_no ? '<span class="ltr">' + esc(c.tax_no) + '</span>' : ''], ['المصدر', esc(c.source)]].filter(r => r[1]);
        return rows.length ? '<div class="panel"><dl class="kv">' + rows.map(r => '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>').join('') + '</dl></div>' : '';
      })() +
      (c.note ? '<div class="note">' + esc(c.note) + '</div>' : '') +
      '<div class="btnrow" style="margin-bottom:20px"><a class="btn" href="#/form/done?client=' + c.id + '">' + icon('plus') + ' زيارة تمت</a>' +
      '<a class="btn navy" href="#/form/appt?client=' + c.id + '">' + icon('calendar') + ' ميعاد جديد</a></div>' +
      '<div class="btnrow" style="margin:-8px 0 20px"><button class="btn sm ghost" data-act="geoclient" data-id="' + c.id + '">' + icon('pin') + ' حدّث موقعي الحالي للعميل</button>' +
      '<button class="btn sm danger" data-act="delclient" data-id="' + c.id + '">حذف العميل</button></div>' +
      branchesBlock(c) + contactsBlock(c) +
      '<section class="block"><h3>الزيارات <span class="count zero" style="background:var(--navy-900)">' + vs.length + '</span></h3>' +
      (vs.length ? '<div class="list">' + vs.map(v => vrow(v, { day: true })).join('') + '</div>' : emptyState('مفيش زيارات للعميل ده', 'ضيف أول زيارة من فوق.')) + '</section>';
    return { title: 'العميل', back: true, html };
  };


  V.branch = p => {
    const b=S.branches.find(x=>x.id===p[0]);if(!b)return notFound();
    const client=S.cmap.get(b.client_id);if(!client)return notFound();
    const vs=S.visits.filter(v=>v.branch_id===b.id);
    const maps=b.lat!=null&&b.lng!=null?'https://www.google.com/maps?q='+b.lat+','+b.lng:b.map_url;
    return {title:b.name,back:true,html:
      '<section class="panel"><a href="#/client/'+client.id+'">'+esc(client.name)+'</a><h2>'+esc(b.name)+'</h2><p>'+esc([b.city,b.address].filter(Boolean).join('، '))+'</p>'+
      (b.note?'<p>'+esc(b.note)+'</p>':'')+'<div class="btnrow"><a class="btn" href="#/form/done?client='+client.id+'&branch='+b.id+'">سجل زيارة للفرع</a>'+
      (maps?'<a class="btn ghost" href="'+esc(maps)+'" target="_blank" rel="noopener">الموقع</a>':'')+
      '<button class="btn ghost" data-act="editbranch" data-id="'+b.id+'">تعديل الفرع</button></div></section>'+
      '<section class="block"><h3>سجل الفرع — '+vs.length+' زيارة</h3>'+(vs.length?'<div class="list">'+vs.map(v=>vrow(v,{day:true})).join('')+'</div>':emptyState('مفيش زيارات للفرع لسه','سجل أول زيارة من فوق.'))+'</section>'};
  };

  /* ---------- صفحة زيارة ---------- */
  function kvRows(v) {
    const rows = [];
    const add = (k, val) => { if (val !== null && val !== undefined && val !== '') rows.push('<div><dt>' + k + '</dt><dd>' + val + '</dd></div>'); };
    const at = new Date(v.at);
    add(v.status === 'scheduled' ? 'الميعاد' : 'الوقت', esc(relDay(at) + '، ' + dfTime.format(at)));
    add('الفرع', esc((S.branches.find(b => b.id === v.branch_id) || {}).name));
    add('التصنيف', esc(v.category));
    if (v.priority && v.priority !== 'normal') add('الأولوية', '<em class="tag ' + v.priority + '">' + YQ.PRIORITIES[v.priority] + '</em>');
    add(v.status === 'scheduled' ? 'هقابل' : 'قابلت', esc(v.met_with));
    add('المشكلة', esc(v.problem));
    if (v.status === 'scheduled') {
      // تفاصيل مبدئية للميعاد
      add('وصف', esc(v.description)); add('المعاينة عن', esc(v.insp_about)); add('المطلوب', esc(v.insp_needs)); add('البنود', esc(v.supply_items));
    }
    if (v.status !== 'scheduled') {
      if (v.arrived_at || v.finished_at) {
        add('الوصول والانتهاء', esc((v.arrived_at ? dfTime.format(new Date(v.arrived_at)) : '—') + ' إلى ' + (v.finished_at ? dfTime.format(new Date(v.finished_at)) : '—')));
      }
      if (v.kind === 'fault') {
        add('وصف العطل', esc(v.description));
        add('الجهاز', esc(v.device_name));
        add('السبب (جذر المشكلة)', esc(v.cause));
        if (v.has_device_password) add('باسورد الجهاز', '<button class="linkbtn" data-act="showpw" data-id="' + v.id + '">إظهار</button>');
        add('الحالة', v.resolved === true ? '<em class="tag ok">اتحل</em>' : v.resolved === false ? '<em class="tag late">متحلش</em>' : '');
        add('اللي اتعمل', esc(v.resolution));
        if (v.resolved === false) {
          add('سبب عدم الحل', esc((REASONS[v.unresolved_reason] || '') + (v.unresolved_note ? ': ' + v.unresolved_note : '')));
          add('المتابعة', v.follow_up_date ? esc(dfDate.format(parseDay(v.follow_up_date))) : '');
        }
      } else if (v.kind === 'inspection') {
        add('المعاينة كانت عن', esc(v.insp_about));
        add('المطلوب', esc(v.insp_needs));
        add('الكوتيشن', v.quote_sent ? 'اتبعت' + (v.quote_sent_at ? ' ' + esc(dfDate.format(parseDay(v.quote_sent_at))) : '') : '<em class="tag warn">لسه ما اتبعتش</em>');
        add('قرار العميل', '<em class="tag ' + (v.decision === 'approved' ? 'ok' : v.decision === 'rejected' ? 'late' : 'wait') + '">' + DECISIONS[v.decision] + '</em>');
        add('سبب الرفض', esc(v.reject_reason));
      } else if (v.kind === 'supply') {
        add('البنود', esc(v.supply_items));
        add('السعر', v.supply_price != null ? esc(Number(v.supply_price).toLocaleString('en-US') + ' ر.س') : '');
        add('النوع', esc(SUPPLY_MODES[v.supply_mode]));
      } else {
        add(v.kind === 'maintenance' ? 'ملاحظات الفحص' : 'الوصف', esc(v.description));
      }
    }
    // تفاصيل كل نوع (من الكتالوج)
    (YQ.DET[v.kind] || []).forEach(f => {
      const val = (v.details || {})[f.k];
      if (val == null || val === '' || (Array.isArray(val) && !val.length)) return;
      let t = Array.isArray(val) ? val.join('، ') : String(val);
      if (f.type === 'number') t = Number(val).toLocaleString('en-US') + ' ر.س';
      if (f.type === 'date') { const d = parseDay(val); if (!isNaN(d)) t = dfDate.format(d); }
      add(f.label, esc(t));
    });
    add('ملاحظات', esc(v.notes));
    if (v.parent_visit_id && S.vmap.get(v.parent_visit_id)) {
      add('مرتبطة بـ', '<a class="linkbtn" href="#/visit/' + v.parent_visit_id + '">المعاينة الأصلية</a>');
    }
    return rows.join('');
  }

  function visitActions(v) {
    const b = (act, label, cls) => '<button class="btn ' + (cls || '') + '" data-act="' + act + '" data-id="' + v.id + '">' + label + '</button>';
    const a = [];
    if (v.status === 'scheduled') {
      a.push(b('complete', icon('check') + ' تمت: كمّل البيانات'));
      a.push('<button class="btn ghost" data-act="wamsg" data-k="confirm" data-id="' + v.id + '">' + icon('wa') + ' أكّد الميعاد للعميل</button>');
      a.push(b('postpone', 'أجّل', 'ghost'));
      a.push(b('cancelv', 'إلغاء الميعاد', 'ghost'));
    } else if (v.status === 'done') {
      if (v.kind === 'inspection') {
        if (!v.quote_sent) a.push(b('quote', 'سجّل إرسال الكوتيشن'));
        else {
          a.push(b('decide', 'قرار العميل'));
          if (v.decision === 'pending') a.push('<button class="btn ghost" data-act="wamsg" data-k="quote" data-id="' + v.id + '">' + icon('wa') + ' متابعة الكوتيشن</button>');
        }
        if (v.decision === 'approved') a.push(b('install', 'ضيف ميعاد تركيب', 'navy'));
      }
      if (v.kind === 'fault' && v.resolved === false) a.push(b('closefault', icon('check') + ' العطل اتحل'));
    } else {
      a.push(b('reopen', 'رجّع الميعاد'));
    }
    a.push(b('edit', icon('edit') + ' تعديل', 'ghost'));
    a.push(b('delv', 'حذف', 'danger'));
    return '<div class="btnrow">' + a.join('') + '</div>';
  }

  V.visit = p => {
    const v = S.vmap.get(p[0]);
    if (!v) return notFound();
    const c = S.cmap.get(v.client_id);
    const html =
      '<div class="card-head"><div class="line" style="margin:0 0 8px">' + chip(v.kind) + statusTag(v) + '</div>' +
      '<a href="#/client/' + v.client_id + '"><h2>' + esc(c ? c.name : '—') + '</h2></a>' +
      '<div class="line">' + (c && c.city ? esc(c.city) : '') + (c && c.phone ? '<span class="ltr">+' + esc(c.phone) + '</span>' : '') + '</div>' +
      '<div class="contact">' + contactBtns(c, true) + '</div></div>' +
      ((c && (S.ctmap.get(c.id) || []).length) ? '<div class="panel" style="padding:4px 14px"><h3 style="margin:12px 0 2px">أرقام التواصل</h3>' + S.ctmap.get(c.id).map(k => contactRow(k, false)).join('') + '</div>' : '') +
      '<div class="panel"><dl class="kv">' + kvRows(v) + '</dl></div>' +
      ((v.photos && v.photos.length) ? '<div class="panel"><h3>الصور</h3><div class="pgrid" id="vphotos"></div></div>' : '') +
      visitActions(v);
    return {
      title: v.status === 'scheduled' ? 'ميعاد' : 'زيارة', back: true, html,
      after() {
        if (!(v.photos && v.photos.length)) return;
        api.photoUrls(v.photos).then(map => {
          const box = $('#vphotos'); if (!box) return;
          box.innerHTML = v.photos.filter(x => map[x]).map(x =>
            '<a class="ph" href="' + esc(map[x]) + '" target="_blank" rel="noopener"><img src="' + esc(map[x]) + '" alt="صورة" loading="lazy"></a>').join('');
        }).catch(() => { const box = $('#vphotos'); if (box) box.innerHTML = '<p class="muted small">مقدرتش أحمّل الصور</p>'; });
      }
    };
  };

  /* ---------- الإحصائيات ---------- */
  function rangeFor(p) {
    const now = new Date();
    const from = p === 'today' ? startOfDay(now) : p === 'week' ? weekStart(now) : new Date(now.getFullYear(), now.getMonth(), 1);
    return { preset: p, from, to: endOfDay(now) };
  }
  function bars(items, cls) {
    if (!items.length) return '<p class="muted small">مفيش بيانات في الفترة دي</p>';
    const max = Math.max.apply(null, items.map(i => i.n).concat([1]));
    return items.map(i => '<div class="bar-row ' + (cls || '') + '"><span>' + esc(i.label) + '</span><div class="track"><i style="width:' + Math.round(i.n / max * 100) + '%"></i></div><b>' + i.n + '</b></div>').join('');
  }
  function countBy(arr, fn, labels) {
    const m = {};
    arr.forEach(x => { const k = fn(x); if (k) m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).map(k => ({ label: labels ? (labels[k] || k) : k, n: m[k] })).sort((a, b) => b.n - a.n);
  }
  V.stats = () => {
    if (!S.range) S.range = rangeFor('month');
    const R = S.range;
    const inR = S.visits.filter(v => v.status === 'done' && new Date(v.at) >= R.from && new Date(v.at) <= R.to);
    const faults = inR.filter(v => v.kind === 'fault');
    const insp = inR.filter(v => v.kind === 'inspection');
    const resolved = faults.filter(v => v.resolved === true).length;
    const approved = insp.filter(v => v.decision === 'approved').length;
    const rejected = insp.filter(v => v.decision === 'rejected').length;
    const sent = insp.filter(v => v.quote_sent).length;
    const rate = insp.length ? Math.round(approved / insp.length * 100) : 0;
    const topClients = countBy(inR, v => v.client_id).slice(0, 5).map(x => ({ label: (S.cmap.get(x.label) || {}).name || '—', n: x.n }));
    const pre = (k, l) => '<button data-act="preset" data-p="' + k + '" class="' + (R.preset === k ? 'on' : '') + '">' + l + '</button>';

    const kindItems = Object.keys(KINDS).map(k => ({ label: KINDS[k], n: inR.filter(v => v.kind === k).length, color: KCOL[k] })).filter(x => x.n > 0);
    const legend = kindItems.map(it => '<div><i style="background:' + it.color + '"></i>' + it.label + '<b>' + it.n + '</b><small>' + Math.round(it.n / inR.length * 100) + '%</small></div>').join('');
    const resRate = faults.length ? Math.round(resolved / faults.length * 100) : null;
    const trend = trendValues(inR, R);
    const supplyTotal = inR.filter(v => v.kind === 'supply').reduce((a, v) => a + (Number(v.supply_price) || 0), 0);

    const html =
      '<div class="seg">' + pre('today', 'النهارده') + pre('week', 'الأسبوع') + pre('month', 'الشهر') + pre('custom', 'مخصص') + '</div>' +
      '<div class="range-in" style="margin:-4px 0 14px"><div class="field" style="margin:0"><label for="r_from">من</label><input id="r_from" type="date" value="' + dayKey(R.from) + '"></div>' +
      '<div class="field" style="margin:0"><label for="r_to">إلى</label><input id="r_to" type="date" value="' + dayKey(R.to) + '"></div></div>' +
      '<button class="btn block-btn" data-act="exportxlsx" style="margin-bottom:16px">' + icon('download') + ' تصدير تقرير Excel كامل للفترة دي</button>' +
      '<div class="tiles">' +
      '<div class="tile blue">' + icon('check') + '<b>' + inR.length + '</b><span>زيارة تمت</span></div>' +
      '<div class="tile red">' + icon('alert') + '<b>' + (faults.length - resolved) + '</b><span>أعطال لسه مفتوحة</span></div>' +
      '<div class="tile orange">' + icon('clock') + '<b>' + insp.length + '</b><span>معاينة</span></div>' +
      '<div class="tile teal">' + icon('wrench') + '<b>' + supplyTotal.toLocaleString('en-US') + '</b><span>قيمة التوريد (ر.س)</span></div></div>' +
      '<div class="grid2">' +
      '<div class="panel"><h3>أنواع الزيارات</h3>' + (inR.length ? '<div class="chartpanel">' + donutSvg(kindItems, inR.length, 'إجمالي الزيارات') + '<div class="legend">' + legend + '</div></div>' : '<p class="muted small">مفيش زيارات في الفترة دي</p>') + '</div>' +
      '<div class="panel"><h3>نسبة حل الأعطال</h3><div class="ringwrap">' + ringSvg(resRate, { cls: 'bigring' }) +
      '<div style="flex:1;min-width:0"><p class="muted small" style="margin-bottom:6px">اتحل ' + resolved + ' من ' + faults.length + ' عطل</p>' + sparkSvg(trend) + '<p class="muted small" style="margin-top:2px">عدد الزيارات ' + (trend.length > 45 ? 'بالأسبوع' : 'باليوم') + '</p></div></div></div>' +
      '<div class="panel"><h3>أسباب عدم الحل</h3>' + bars(countBy(faults.filter(v => v.resolved === false), v => v.unresolved_reason || 'other', REASONS)) + '</div>' +
      '<div class="panel"><h3>المعاينات والتعميد</h3><div class="ringwrap">' + ringSvg(rate, { cls: 'bigring', color: '#FF6600' }) +
      '<div style="flex:1;min-width:0"><p class="muted small">تم التعميد ' + approved + ' من ' + insp.length + '</p></div></div>' +
      bars([{ label: 'اتبعت كوتيشن', n: sent }, { label: 'تم التعميد', n: approved }, { label: 'رفض', n: rejected }, { label: 'في الانتظار', n: insp.filter(v => v.decision === 'pending').length }]) + '</div>' +
      '<div class="panel"><h3>أكتر المشاكل تكرارًا</h3>' + bars(countBy(faults, v => v.problem).slice(0, 8)) + '</div>' +
      '<div class="panel"><h3>أكتر الأسباب (جذر المشكلة)</h3>' + bars(countBy(faults, v => v.cause).slice(0, 8), 'blue') + '</div>' +
      '<div class="panel"><h3>حسب التصنيف</h3>' + bars(countBy(inR, v => v.category), 'blue') + '</div>' +
      '<div class="panel"><h3>أكتر العملاء زيارات</h3>' + bars(topClients, 'blue') + '</div></div>';
    return {
      title: 'الإحصائيات', html,
      after() {
        const upd = () => {
          const f = $('#r_from').value, t = $('#r_to').value;
          if (!f || !t) return;
          S.range = { preset: 'custom', from: startOfDay(parseDay(f)), to: endOfDay(parseDay(t)) };
          render();
        };
        $('#r_from').addEventListener('change', upd);
        $('#r_to').addEventListener('change', upd);
      }
    };
  };

  /* =====================================================
     ليلة
     ===================================================== */

  const branchesOf = id => S.branches.filter(b => b.client_id === id);
  function branchSelectHtml(clientId, selected) {
    const rows = branchesOf(clientId);
    if (!rows.length) return '';
    return '<div class="field branch-picker"><label for="f_branch">فرع الزيارة</label><select id="f_branch"><option value="">العميل / الموقع الرئيسي</option>' +
      rows.map(b => '<option value="' + b.id + '"' + (selected === b.id ? ' selected' : '') + '>' + esc(b.name) + '</option>').join('') + '</select></div>';
  }
  document.addEventListener('change', e => { if (e.target.id === 'f_branch' && F) F.branchId = e.target.value; });
  function branchesBlock(client) {
    const rows = branchesOf(client.id);
    return '<section class="block branches-block"><h3>الفروع <span class="count">' + rows.length + '</span></h3>' +
      '<p class="muted small">كل فرع له عنوان وموقع وسجل زيارات مستقل تحت نفس العميل.</p>' +
      rows.map(b => '<article class="branch-card"><div><a class="branch-title" href="#/branch/' + b.id + '"><b>' + esc(b.name) + '</b></a><p>' + esc([b.city,b.address].filter(Boolean).join('، ')) + '</p><small>' +
      S.visits.filter(v => v.branch_id === b.id).length + ' زيارة</small></div><div class="btnrow"><a class="btn sm" href="#/form/done?client=' + client.id + '&branch=' + b.id + '">سجل زيارة</a>' +
      '<button class="btn sm ghost" data-act="editbranch" data-id="' + b.id + '">تعديل</button></div></article>').join('') +
      '<button class="btn sm ghost" data-act="addbranch" data-id="' + client.id + '">+ إضافة فرع</button></section>';
  }
  async function editBranch(clientId, branch) {
    const b = branch || {};
    const r = await askSheet({ title: branch ? 'تعديل الفرع' : 'فرع جديد', fields: [
      {name:'name',label:'اسم الفرع',required:true,value:b.name||''},
      {name:'city',label:'المدينة',value:b.city||S.settings.default_city||'الرياض'},
      {name:'address',label:'العنوان',value:b.address||''},
      {name:'map',label:'رابط خرائط كامل أو إحداثيات',value:b.map_url || (b.lat != null && b.lng != null ? b.lat + ',' + b.lng : ''),hint:'الرابط المختصر وحده لا يكفي لحساب المسافة؛ استخدم الإحداثيات.'},
      {name:'phone',label:'رقم الفرع (اختياري)',type:'tel',value:b.phone||''},
      {name:'note',label:'ملاحظات الفرع',type:'textarea',value:b.note||''}
    ]});
    if (!r) return;
    const loc = parseLoc(r.map||'');
    const saved = await api.saveBranch({id:b.id,client_id:clientId,name:r.name,city:r.city||null,address:r.address||null,
      phone:r.phone||null,note:r.note||null,lat:loc?.lat??null,lng:loc?.lng??null,map_url:loc?.url||null});
    const i=S.branches.findIndex(x=>x.id===saved.id); if(i<0)S.branches.push(saved);else S.branches[i]=saved;
    toast('اتحفظ الفرع');render();
  }
  function nearbySites() {
    if (!S.location) return [];
    const rad = n => n * Math.PI / 180;
    const distance = (a,b) => {
      const x=Math.sin(rad(a-S.location.lat)/2)**2 + Math.cos(rad(S.location.lat))*Math.cos(rad(a))*Math.sin(rad(b-S.location.lng)/2)**2;
      return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));
    };
    const sites=[];
    for(const c of S.clients) {
      const rows=[{...c,label:c.name,client_id:c.id,branch_id:null},...branchesOf(c.id).map(b=>({...b,label:c.name+' — '+b.name,client_id:c.id,branch_id:b.id}))];
      for(const row of rows)if(Number.isFinite(row.lat)&&Number.isFinite(row.lng))sites.push({...row,km:distance(row.lat,row.lng)});
    }
    return sites.sort((a,b)=>a.km-b.km).slice(0,30);
  }
  let voiceEnabled=false, wakeEnabled=false, recognition=null, waitForCommand=false, restartVoiceTimer=null;
  function voiceStatus(text) { const el=$('#layla-status');if(el)el.textContent=text; }
  function stopVoice() {
    wakeEnabled=false;waitForCommand=false;clearTimeout(restartVoiceTimer);
    if(recognition){recognition.onend=null;recognition.abort();recognition=null;}
    if(window.speechSynthesis)window.speechSynthesis.cancel();
  }
  function speakReply(text) {
    if(!window.speechSynthesis||!text)return;
    if(recognition){recognition.onend=null;recognition.abort();recognition=null;}
    speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(text.replace(/[*#]/g,'').slice(0,3000));
    const voices=speechSynthesis.getVoices();
    utterance.voice=voices.find(v=>v.lang.toLowerCase()==='ar-eg')||voices.find(v=>v.lang.startsWith('ar'))||null;
    utterance.lang='ar-EG';utterance.rate=0.96;
    utterance.onend=()=>{if(wakeEnabled)startVoiceInput(true);};
    utterance.onerror=utterance.onend;
    speechSynthesis.speak(utterance);
  }
  function startVoiceInput(wake) {
    if(!SR){toast('التعرف الصوتي غير مدعوم هنا. استخدم ميكروفون الكيبورد.','err');return;}
    if(recognition){recognition.onend=null;recognition.abort();}
    const r=new SR();recognition=r;r.lang='ar-EG';r.interimResults=false;r.continuous=false;
    voiceStatus(wake?'النداء مفعّل: قول «يا ليلة» والتطبيق مفتوح':'سامعاك… اتكلم وبعدها راجع النص واضغط إرسال');
    r.onresult=e=>{
      const text=Array.from(e.results).map(x=>x[0].transcript).join(' ').trim();
      if(wake){
        const match=text.match(/(?:يا\s*)?(?:ليلة|ليلى|ليلا)(?:[،,:\s]+|$)(.*)/);
        if(match||waitForCommand){
          const command=match?(match[1]||'').trim():text;waitForCommand=!command;
          if(command){waitForCommand=false;sendChat(command);}else voiceStatus('سامعاك، قول طلبك');
        }
      }else{const t=$('#cin');if(t){t.value=(t.value?t.value+' ':'')+text;t.dispatchEvent(new Event('input'));t.focus();}}
    };
    r.onerror=e=>{if(['not-allowed','service-not-allowed','audio-capture'].includes(e.error)){wakeEnabled=false;voiceStatus('تعذّر الوصول للميكروفون. راجع إذن المتصفح.');}else voiceStatus('مسمعتش بوضوح، جرّب تاني');};
    r.onend=()=>{recognition=null;if(wakeEnabled&&!document.hidden&&route().parts[0]==='layla'&&!S.chatBusy&&!(window.speechSynthesis&&window.speechSynthesis.speaking))restartVoiceTimer=setTimeout(()=>startVoiceInput(true),600);};
    try{r.start();}catch(e){wakeEnabled=false;voiceStatus('الميكروفون مش جاهز، جرّب تاني');}
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopVoice();voiceStatus('الصوت متوقف لأن التطبيق في الخلفية');}});

  const CHAT_KEY = 'yaqoub_layla_chat';
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function loadChat() { try { return JSON.parse(localStorage.getItem(CHAT_KEY + ':' + S.user.id) || '[]'); } catch (e) { return []; } }
  let chatSaveQueue = Promise.resolve();
  function saveChat() {
    const owner = S.user.id;
    const messages = JSON.parse(JSON.stringify(S.chat.slice(-40)));
    try { localStorage.setItem(CHAT_KEY + ':' + S.user.id, JSON.stringify(messages)); } catch (e) {}
    chatSaveQueue = chatSaveQueue.catch(() => {}).then(() => api.saveChat(messages, owner)).catch(() => {
      const status = $('#layla-status'); if (status) status.textContent = 'المحادثة محفوظة على الجهاز؛ المزامنة تحتاج إنترنت';
    });
  }

  // زيارات تمت وناقص فيها وصف اللي اتعمل
  function missingDetails(v) {
    if (v.status !== 'done' || daysSince(v.at) > 21) return null;
    if (v.kind === 'fault') {
      if (!v.description && !v.problem) return 'وصف العطل';
      if (v.resolved && !v.resolution) return 'اللي اتعمل لحل العطل';
    }
    if (v.kind === 'inspection' && !v.insp_about) return 'موضوع المعاينة';
    if (v.kind === 'supply' && !v.supply_items) return 'بنود التوريد';
    if (v.kind === 'install' && !v.description) return 'وصف التركيب';
    return null;
  }
  const missingList = () => S.visits.map(v => ({ v, what: missingDetails(v) })).filter(x => x.what);

  function laylaDigest() {
    const now = new Date(), L = [];
    L.push('الوقت الآن (توقيت المستخدم): ' + toInput(now).replace('T', ' ') + '، ' + dfDay.format(now));
    L.push('عدد العملاء: ' + S.clients.length + '، زيارات تمت: ' + S.visits.filter(v => v.status === 'done').length +
      '، مواعيد قادمة: ' + S.visits.filter(v => v.status === 'scheduled' && new Date(v.at) >= now).length);
    const alerts = computeAlerts();
    L.push('التنبيهات الحالية (' + alerts.length + '):');
    alerts.slice(0, 12).forEach(a => L.push('- ' + a.title + ' | ' + a.sub + ' | visit_id=' + a.v.id));
    const limit = new Date(now.getTime() + 4 * 864e5);
    const up = S.visits.filter(v => v.status === 'scheduled' && new Date(v.at) >= now && new Date(v.at) <= limit)
      .sort((a, b) => new Date(a.at) - new Date(b.at)).slice(0, 12);
    if (up.length) {
      L.push('مواعيد الأيام الجاية:');
      up.forEach(v => L.push('- ' + toInput(new Date(v.at)).replace('T', ' ') + ' ' + ((S.cmap.get(v.client_id) || {}).name || '') + ' (' + KINDS[v.kind] + (v.category ? '، ' + v.category : '') + ') visit_id=' + v.id));
    }
    const miss = missingList().slice(0, 6);
    if (miss.length) {
      L.push('زيارات تمت وناقص فيها تفاصيل:');
      miss.forEach(m => L.push('- visit_id=' + m.v.id + ' | ' + ((S.cmap.get(m.v.client_id) || {}).name || '') + ' | ' + KINDS[m.v.kind] + ' ' + dfShort.format(new Date(m.v.at)) + ' | ناقص: ' + m.what));
    }
    L.push('فروع العملاء: ' + S.branches.map(b => b.name + ' لدى ' + ((S.cmap.get(b.client_id)||{}).name||'') + ' branch_id=' + b.id).slice(0,30).join(' | '));
    if (S.location && Date.now() - S.location.at < 300000) {
      L.push('مسافات محسوبة محليًا بخط مستقيم، ليست مسافة طريق أو زمن قيادة، قياس منذ ' + Math.round((Date.now()-S.location.at)/1000) + ' ثانية:');
      L.push(...nearbySites().map(b => b.label + ': ' + b.km.toFixed(1) + ' كم client_id=' + b.client_id + (b.branch_id ? ' branch_id=' + b.branch_id : '')));
    } else L.push('الموقع الحالي غير مشارك أو قديم. إذا سأل عن المسافة اطلب منه ضغط زر «موقعي»؛ لا تخمّن.');
    return L.join('\n');
  }

  function seedChat() {
    const miss = missingList().filter(m => !S.asked.has(m.v.id));
    const alerts = computeAlerts();
    let text, meta = null;
    if (miss.length) {
      const m = miss[0], c = S.cmap.get(m.v.client_id) || {};
      S.asked.add(m.v.id);
      text = 'عملنا إيه عند «' + (c.name || 'العميل') + '» في ' + KINDS[m.v.kind] + ' يوم ' + dfShort.format(new Date(m.v.at)) + '؟ ناقص عندي ' + m.what + '. احكيلي باختصار وأنا أسجّله.';
      meta = { visit_id: m.v.id };
    } else if (alerts.length) {
      text = 'أهلًا! عندك ' + alerts.length + ' حاجة محتاجة متابعة، وأولها: ' + alerts[0].title + '. تحب أساعدك فيها؟';
    } else {
      text = 'أهلًا! كله تمام دلوقتي. اسألني عن أي عميل أو زيارة، أو قولي أضيفلك عميل أو ميعاد.';
    }
    S.chat.push({ role: 'assistant', content: text, meta });
    saveChat();
  }

  function apiMessages() {
    const arr = S.chat.filter(m => m.content && !m.error).slice(-24)
      .map(m => ({ role: m.role, content: m.content + (m.meta && m.meta.visit_id ? '\n[visit_id=' + m.meta.visit_id + ']' : '') }));
    if (arr.length && arr[0].role !== 'user') arr.unshift({ role: 'user', content: '(بداية المحادثة)' });
    return arr;
  }

  const fmtMsg = t => esc(String(t || '').replace(/(?:visit_id|client_id|branch_id)\s*=\s*[0-9a-f-]{36}/gi, '').trim()).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

  function draftCard(m, mi, d, di) {
    const x = d.data || {};
    const cname = id => (S.cmap.get(id) || {}).name;
    let title = '', lines = [];
    if (d.type === 'visit') { title='تسجيل مشكلة / زيارة تمت'; lines=[cname(x.client_id), (S.branches.find(b=>b.id===x.branch_id)||{}).name,x.problem,x.description,x.cause,x.resolution,x.resolved===true?'تم الحل':'المشكلة لسه مفتوحة'];
    } else if (d.type === 'branch') { title = 'فرع جديد'; lines = [cname(x.client_id),x.name,x.city,x.address];
    } else if (d.type === 'client') {
      title = 'عميل جديد';
      lines = [x.name, '+' + normPhone(x.phone, '966'), x.city || S.settings.default_city];
    } else if (d.type === 'appointment') {
      title = 'ميعاد زيارة';
      const at = new Date(x.at);
      lines = [cname(x.client_id) || x.client_name || '(العميل مش محدد)', isNaN(at) ? x.at : relDay(at) + '، ' + dfTime.format(at), (KINDS[x.kind] || x.kind) + (x.category ? '، ' + x.category : '')];
      if (x.notes) lines.push(x.notes);
    } else if (d.type === 'visit_update') {
      const v = S.vmap.get(x.visit_id);
      title = 'تحديث زيارة';
      lines = [v ? (cname(v.client_id) || '') + '، ' + KINDS[v.kind] + ' ' + dfShort.format(new Date(v.at)) : 'زيارة مش موجودة'];
      if (x.resolved === true) lines.push('العطل اتحل');
      ['problem','cause','device_name','description', 'resolution', 'notes', 'insp_about', 'insp_needs', 'supply_items'].forEach(k => { if (x[k]) lines.push(x[k]); });
    } else if (d.type === 'contact') {
      title = 'رقم تواصل';
      lines = [cname(x.client_id) || '(العميل مش موجود)', x.name + (x.role ? ' (' + x.role + ')' : ''), '+' + normPhone(x.phone, '966')];
    }
    const foot = d.state === 'done' ? '<em class="tag ok">اتأكدت</em>' : d.state === 'no' ? '<em class="tag off">اتلغت</em>'
      : '<div class="btnrow"><button class="btn sm" data-act="draftok" data-m="' + mi + '" data-d="' + di + '">تأكيد</button>' +
      '<button class="btn sm ghost" data-act="draftno" data-m="' + mi + '" data-d="' + di + '">إلغاء</button></div>';
    return '<div class="draft"><b>' + title + '</b>' + lines.filter(Boolean).map(l => '<div>' + esc(l) + '</div>').join('') + foot + '</div>';
  }

  function chatHtml() {
    return S.chat.map((m, mi) => '<div class="msg ' + (m.role === 'user' ? 'u' : 'a') + (m.error ? ' err' : '') + '">' + (m.role === 'user' ? '' : '<img class="mav" src="icons/layla.svg" alt="">') + '<div class="bub">' + fmtMsg(m.content) + '</div>' +
      (m.drafts || []).map((d, di) => draftCard(m, mi, d, di)).join('') + '</div>').join('') +
      (S.chatBusy ? '<div class="msg a"><img class="mav" src="icons/layla.svg" alt=""><div class="bub typing"><i></i><i></i><i></i></div></div>' : '');
  }
  function renderChat() {
    const el = $('#chat'); if (!el) return;
    el.innerHTML = chatHtml();
    window.scrollTo(0, document.body.scrollHeight);
  }

  async function sendChat(text) {
    text = (text || '').trim();
    if (!text || S.chatBusy) return;
    S.chat.push({ role: 'user', content: text });
    S.chatBusy = true; saveChat(); renderChat();
    try {
      const r = await api.layla(apiMessages(), laylaDigest());
      if (voiceEnabled) speakReply(r.reply || '');
      S.chat.push({ role: 'assistant', content: r.reply || '...', drafts: (r.drafts || []).map(d => Object.assign({ state: 'new' }, d)) });
    } catch (e) {
      console.error(e);
      S.chat.push({ role: 'assistant', content: 'مقدرتش أرد دلوقتي: ' + (e.message || 'مشكلة'), error: true });
    }
    S.chatBusy = false; saveChat(); renderChat();
    if(wakeEnabled&&!recognition&&!(window.speechSynthesis&&window.speechSynthesis.speaking))startVoiceInput(true);
  }

  async function applyDraft(d) {
    const x = d.data || {};
    if (d.type === 'visit') {
      if(!S.cmap.has(x.client_id))throw new Error('العميل غير موجود');
      if(x.branch_id&&!S.branches.some(b=>b.id===x.branch_id&&b.client_id===x.client_id))throw new Error('الفرع غير صحيح');
      const at=x.at?new Date(x.at):new Date();if(isNaN(at))throw new Error('وقت الزيارة غير صحيح');
      const saved=await api.saveVisit({client_id:x.client_id,branch_id:x.branch_id||null,status:'done',kind:'fault',
        category:x.category||null,at:at.toISOString(),problem:x.problem||null,description:x.description||null,
        cause:x.cause||null,device_name:x.device_name||null,resolution:x.resolution||null,resolved:x.resolved===true,
        notes:x.notes||null});
      upsertVisit(saved);return 'اتسجلت المشكلة وحالتها في سجل العميل. هقدر أرجع للحل في المرات الجاية.';
    }
    if (d.type === 'branch') {
      if (!S.cmap.has(x.client_id)) throw new Error('حدد العميل الأول');
      const saved = await api.saveBranch(x); S.branches.push(saved); return 'اتحفظ الفرع «' + saved.name + '».';
    }
    if (d.type === 'client') {
      const phone = normPhone(x.phone, '966');
      if (phone.length < 9) throw new Error('الرقم مش مظبوط');
      const dup = S.clients.find(c => c.phone === phone);
      if (dup) return 'الرقم ده مسجل بالفعل باسم «' + dup.name + '».';
      const c = await api.saveClient({ name: x.name, phone, city: x.city || S.settings.default_city, note: x.note || null });
      upsertClient(c);
      return 'تمام، اتضاف العميل «' + c.name + '».';
    }
    if (d.type === 'appointment') {
      let c = S.cmap.get(x.client_id);
      if (!c && x.client_name) c = S.clients.find(k => k.name.includes(x.client_name) || x.client_name.includes(k.name));
      if (!c) throw new Error('العميل مش موجود. ضيفه الأول');
      const at = new Date(x.at);
      if (isNaN(at)) throw new Error('الوقت مش واضح');
      const v = await api.saveVisit({ client_id: c.id, status: 'scheduled', kind: KINDS[x.kind] ? x.kind : 'fault', category: x.category || null, at: at.toISOString(), notes: x.notes || null });
      upsertVisit(v);
      return 'اتضاف الميعاد: ' + c.name + '، ' + relDay(at) + ' ' + dfTime.format(at) + '.';
    }
    if (d.type === 'visit_update') {
      const v = S.vmap.get(x.visit_id);
      if (!v) throw new Error('الزيارة مش موجودة');
      const patch = { id: v.id };
      ['description','problem','cause','device_name','resolution','insp_about','insp_needs','supply_items'].forEach(k=>{if(typeof x[k]==='string'&&x[k].trim())patch[k]=x[k].trim();});
      if(x.branch_id){
        const branch=S.branches.find(b=>b.id===x.branch_id&&b.client_id===v.client_id);
        if(!branch)throw new Error('الفرع مش تابع للعميل ده');
        patch.branch_id=branch.id;
      }
      if (x.notes) patch.notes = v.notes && v.notes !== x.notes ? v.notes + '\n' + x.notes : x.notes;
      if (x.resolved === true) Object.assign(patch, { resolved: true, unresolved_reason: null, unresolved_note: null, follow_up_date: null });
      const saved = await api.saveVisit(patch);
      saved.has_device_password = v.has_device_password;
      upsertVisit(saved);
      return 'اتسجل التحديث على زيارة «' + ((S.cmap.get(v.client_id) || {}).name || '') + '».';
    }
    if (d.type === 'contact') {
      const c = S.cmap.get(x.client_id);
      if (!c) throw new Error('العميل مش موجود');
      const phone = normPhone(x.phone, '966');
      if (phone.length < 9) throw new Error('الرقم مش مظبوط');
      const k = await api.saveContact({ client_id: c.id, name: x.name, role: x.role || null, phone });
      S.contacts.push(k); reindex();
      return 'اتضاف الرقم ' + k.name + ' للعميل «' + c.name + '».';
    }
    throw new Error('نوع المسودة مش معروف');
  }

  V.layla = (p, q) => {
    if (!S.chat.length) seedChat();
    const chips=['سجلي تفاصيل مشكلة اشتغلنا فيها','إيه الأعطال المفتوحة؟','دوري على مشكلة شبه دي','إيه الزيارات الناقصها تفاصيل؟'];
    return {
      title:'ليلة — مساعدة شغلك',back:true,nav:false,cls:'chatpage layla-plus',
      topRight:'<button class="ib" data-act="clearchat" aria-label="محادثة جديدة">'+icon('plus')+'</button>',
      html:'<section class="layla-hero"><img src="icons/layla.svg" alt=""><div><h2>أهلًا، أنا ليلة</h2><p>عملاؤك وفروعهم، ومشاكلك وحلولها… أرجع لها معاك.</p></div></section>'+
        '<div class="layla-tools"><button data-act="togglevoice" aria-pressed="'+voiceEnabled+'">'+(voiceEnabled?'إيقاف الرد الصوتي':'رد مسموع')+'</button>'+
        '<button data-act="togglewake" aria-pressed="'+wakeEnabled+'" '+(!SR?'disabled':'')+'>'+(wakeEnabled?'إيقاف النداء':'نداء يا ليلة')+'</button>'+
        '<button data-act="chatlocation">موقعي والمسافات</button><a href="#/settings">الذاكرة</a></div>'+
        '<p class="layla-status" id="layla-status" role="status" aria-live="polite">المحادثة بتتزامن مع حسابك. الإضافات والتعديلات بتحتاج تأكيدك.</p>'+
        '<div id="chat" class="chat" aria-live="polite" aria-relevant="additions"></div>'+
        '<div class="composer"><div class="qchips">'+chips.map(c=>'<button type="button" data-act="quickchat" data-t="'+esc(c)+'">'+esc(c)+'</button>').join('')+'</div>'+
        '<div class="cbox"><textarea id="cin" rows="1" placeholder="احكيلي: العميل والفرع، المشكلة، جرّبت إيه والنتيجة…" aria-label="رسالتك لليلة"></textarea>'+
        '<button class="ib" data-act="mic" aria-label="إملاء صوتي" '+(!SR?'disabled':'')+'>'+icon('mic')+'</button>'+
        '<button class="send" data-act="sendchat" aria-label="إرسال">'+icon('send')+'</button></div>'+
        '<small class="voice-note">النداء يحتاج التطبيق مفتوحًا. الصوت حسب دعم المتصفح، والتعرف قد يستخدم خدمة المتصفح. المسافات بخط مستقيم وليست زمن قيادة.</small></div>',
      after(){
        renderChat();const t=$('#cin');
        const fit=()=>{t.style.height='auto';t.style.height=Math.min(t.scrollHeight,160)+'px';};
        t.addEventListener('input',fit);
        t.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&window.matchMedia('(pointer:fine)').matches){e.preventDefault();const v=t.value;t.value='';fit();sendChat(v);}});
      }
    };
  };

  /* ---------- إشعارات الموبايل ---------- */
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  function b64uToU8(str) {
    let t = str.replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    const bin = atob(t), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function pushState() {
    if (!api.savePush) return 'hidden';
    if (!api.vapidKey) return 'noconfig';
    if (isIOS && !isStandalone()) return 'ios-install';
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    try {
      const reg = await navigator.serviceWorker.ready;
      return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
    } catch (e) { return 'unsupported'; }
  }
  function pushPanelHtml(st) {
    if (st === 'hidden') return '';
    const btn = (act, label, cls) => '<button class="btn sm ' + (cls || '') + '" data-act="' + act + '">' + label + '</button>';
    const msg = {
      on: 'الإشعارات شغالة على الجهاز ده. هتوصلك مواعيدك وتنبيهاتك حتى والتطبيق مقفول.',
      off: 'فعّل الإشعارات عشان تنبيهك بالمواعيد والمتابعات يوصلك على الموبايل.',
      denied: 'الإذن مرفوض. فعّله من إعدادات المتصفح للموقع ده وبعدين ارجع هنا.',
      'ios-install': 'على الأيفون لازم تثبّت التطبيق الأول: زرار المشاركة ثم «إضافة إلى الشاشة الرئيسية»، وافتحه منها وفعّل الإشعارات. محتاج iOS 16.4 أو أحدث.',
      unsupported: 'المتصفح ده مش بيدعم الإشعارات. جرّب Chrome على أندرويد.',
      noconfig: 'الإشعارات محتاجة إعداد: حط VAPID_PUBLIC_KEY في js/config.js (الخطوات في DEPLOY.md).'
    }[st] || '';
    const acts = st === 'on' ? btn('pushtest', 'جرّب إشعار', 'ghost') + btn('pushoff', 'أوقف الإشعارات', 'danger') : st === 'off' ? btn('pushon', icon('spark') + ' فعّل الإشعارات') : '';
    return '<h3>الإشعارات</h3><p class="muted small" style="margin-bottom:10px">' + msg + '</p>' + (acts ? '<div class="btnrow">' + acts + '</div>' : '');
  }
  function syncPushQuietly() {
    if (!api.savePush || !api.vapidKey || !('serviceWorker' in navigator) || !('Notification' in window) || Notification.permission !== 'granted') return;
    navigator.serviceWorker.ready.then(r => r.pushManager.getSubscription()).then(sub => sub && api.savePush(sub)).catch(() => { });
  }

  /* ---------- الإعدادات ---------- */
  V.settings = () => {
    const s = S.settings;
    return {
      title: 'الإعدادات', back: true, nav: false,
      html: '<div class="panel" id="pushpanel" style="display:none"></div><div class="panel"><h3>حدود التنبيهات</h3>' +
        '<div class="field"><label for="s_q">معاينة من غير كوتيشن: نبّهني بعد (يوم)</label><input id="s_q" type="number" min="1" max="60" value="' + s.alert_quote_days + '"></div>' +
        '<div class="field"><label for="s_f">كوتيشن من غير رد: نبّهني بعد (يوم)</label><input id="s_f" type="number" min="1" max="90" value="' + s.alert_followup_days + '"></div>' +
        '<div class="field"><label for="s_r">فكّرني بالميعاد قبلها بـ (دقيقة)</label><input id="s_r" type="number" min="5" max="1440" value="' + s.remind_before_min + '"></div></div>' +
        '<div class="panel"><h3>ليلة</h3><div class="field"><label for="s_about">عنّي وعن شغلي (ليلة بتقراه)</label><textarea id="s_about" style="min-height:120px">' + esc(s.about_me || '') + '</textarea>' +
        '<div class="hint">كل ما كان أدق، إجابات ليلة أفضل.</div></div>' +
        '<span class="lbl">اللي ليلة حافظاه</span><div id="memlist"><p class="muted small">بيحمّل...</p></div></div>' +
        '<div class="panel"><h3>عام</h3><div class="field" style="margin:0"><label for="s_c">المدينة الافتراضية</label><input id="s_c" list="cities" value="' + esc(s.default_city) + '"></div>' +
        '<datalist id="cities">' + CITIES.map(c => '<option value="' + c + '">').join('') + '</datalist></div>' +
        '<div class="btnrow"><button class="btn" data-act="savesettings">حفظ الإعدادات</button><button class="btn ghost" data-act="logout">' + icon('logout') + ' تسجيل خروج</button></div>' +
        '<p class="muted small" style="margin-top:18px">لتثبيت التطبيق: من قائمة المتصفح اختار «إضافة إلى الشاشة الرئيسية».</p>',
      after() {
        pushState().then(st => { const el = $('#pushpanel'); const h = pushPanelHtml(st); if (el && h) { el.innerHTML = h; el.style.display = ''; } });
        api.listMemory().then(rows => {
          const el = $('#memlist'); if (!el) return;
          el.innerHTML = rows.length ? '<div class="list">' + rows.map(r => '<div class="crow"><div class="main"><div class="t" style="white-space:normal">' + esc(r.fact) + '</div></div>' +
            '<button class="ib line" data-act="delmem" data-id="' + r.id + '" aria-label="مسح">' + icon('trash') + '</button></div>').join('') + '</div>'
            : '<p class="muted small">لسه مفيش حاجة. قولها «افتكر إن...» في المحادثة.</p>';
        }).catch(() => { const el = $('#memlist'); if (el) el.innerHTML = '<p class="muted small">مقدرتش أحمّل الذاكرة (اتأكد إنك شغّلت schema_v2.sql).</p>'; });
      }
    };
  };

  /* =====================================================
     الكتالوج (تصنيفات ومشاكل وأسباب). اللي بتكتبه بنفسك بيتحفظ على الموبايل
     ===================================================== */
  const CUSTOM_KEY = 'yaqoub_custom_catalog';
  function loadCustom() {
    try { return Object.assign({ cats: [], problems: {}, causes: {} }, JSON.parse(localStorage.getItem(CUSTOM_KEY) || '{}')); }
    catch (e) { return { cats: [], problems: {}, causes: {} }; }
  }
  function saveCustom(c) { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(c)); } catch (e) { /* تجاهل */ } }
  const uniq = a => Array.from(new Set(a.filter(Boolean)));
  const catsAll = () => uniq(YQ.CATS.slice(0, -1).concat(loadCustom().cats, [YQ.CATS[YQ.CATS.length - 1]]));
  const problemsFor = cat => uniq((YQ.PROBLEMS[cat] || YQ.GENERIC_PROBLEMS).concat(loadCustom().problems[cat] || []));
  const causesFor = cat => uniq((YQ.CAUSES[cat] || YQ.GENERIC_CAUSES).concat(loadCustom().causes[cat] || []));
  function rememberCustom(cat, problem, cause) {
    if (!cat) return;
    const c = loadCustom();
    if (catsAll().indexOf(cat) < 0) c.cats.push(cat);
    if (problem && problemsFor(cat).indexOf(problem) < 0) (c.problems[cat] = c.problems[cat] || []).push(problem);
    if (cause && causesFor(cat).indexOf(cause) < 0) (c.causes[cat] = c.causes[cat] || []).push(cause);
    c.cats = c.cats.slice(-40);
    saveCustom(c);
  }

  /* ---------- chips بتملى حقل نص (والحقل بيفضل قابل للكتابة) ---------- */
  const chipsFor = (list, target) => list.map(t =>
    '<button type="button" class="pick sm" data-act="fillchip" data-t="' + target + '" data-v="' + esc(t) + '">' + esc(t) + '</button>').join('');
  function syncFill(box) {
    if (!box) return;
    const inp = document.getElementById(box.dataset.for);
    if (!inp) return;
    $$('.pick[data-act=fillchip]', box).forEach(b => b.classList.toggle('on', b.dataset.v === inp.value.trim()));
  }
  document.addEventListener('input', e => {
    const id = e.target && e.target.dataset && e.target.dataset.chips;
    if (id) syncFill(document.getElementById(id));
  });

  /* =====================================================
     فورم العميل (صفحة مستقلة + جوه فورم الزيارة)
     ===================================================== */
  let CF = null;
  function newCF(c) {
    const phones = [];
    if (c && c.id) {
      phones.push({ name: c.contact_name || '', role: c.contact_role || '', cc: '966', phone: c.phone ? '+' + c.phone : '' });
      (S.ctmap.get(c.id) || []).forEach(k => phones.push({ id: k.id, name: k.name, role: k.role || '', cc: '966', phone: '+' + k.phone }));
    } else phones.push({ name: '', role: '', cc: '966', phone: '' });
    return { id: c && c.id || null, phones, geo: null, saving: false };
  }
  function phonesHtml() {
    return CF.phones.map((p, i) =>
      '<div class="prow"><div class="prow-h"><b>' + (i === 0 ? 'الرقم الأساسي' : 'رقم ' + (i + 1)) + '</b>' +
      (i > 0 ? '<button type="button" class="ib" data-act="rmphone" data-i="' + i + '" aria-label="حذف الرقم">' + icon('x') + '</button>' : '') + '</div>' +
      '<div class="two"><input type="text" data-ph="name" data-i="' + i + '" placeholder="اسم صاحب الرقم" value="' + esc(p.name) + '" autocomplete="off">' +
      '<input type="text" data-ph="role" data-i="' + i + '" placeholder="المسمى (مدير، محاسب...)" value="' + esc(p.role) + '" autocomplete="off"></div>' +
      '<div class="phone"><select data-ph="cc" data-i="' + i + '" aria-label="كود الدولة">' +
      COUNTRIES.map(c => '<option value="' + c[0] + '"' + (c[0] === p.cc ? ' selected' : '') + '>' + c[1] + '</option>').join('') + '</select>' +
      '<input type="tel" inputmode="tel" data-ph="phone" data-i="' + i + '" placeholder="5xxxxxxxx" value="' + esc(p.phone) + '" autocomplete="off"></div></div>').join('');
  }
  function renderPhones() { const el = $('#phones'); if (el) el.innerHTML = phonesHtml(); }
  function bindClientForm() {
    renderPhones();
    const box = $('#phones');
    if (box) {
      const upd = e => { const t = e.target; if (t.dataset && t.dataset.ph && CF.phones[+t.dataset.i]) CF.phones[+t.dataset.i][t.dataset.ph] = t.value; };
      box.addEventListener('input', upd); box.addEventListener('change', upd);
    }
    $$('[data-chips]').forEach(i => syncFill(document.getElementById(i.dataset.chips)));
  }

  function clientFieldsHtml(c) {
    c = c || {};
    const loc = c.lat != null ? c.lat + ',' + c.lng : (c.map_url || '');
    const hasMore = !!(c.email || c.work_hours || c.access_notes || c.tax_no || c.source || c.note);
    return '<div class="field"><label for="nc_name">اسم العميل أو الجهة</label><input id="nc_name" type="text" value="' + esc(c.name || '') + '" autocomplete="off"></div>' +
      '<div class="field"><span class="lbl">نوع العميل</span><div class="picks tight" id="ctypes" data-for="nc_type">' + chipsFor(YQ.CLIENT_TYPES, 'nc_type') + '</div>' +
      '<input id="nc_type" data-chips="ctypes" type="text" placeholder="أو اكتب نوع تاني" value="' + esc(c.client_type || '') + '" autocomplete="off"></div>' +
      '<div class="field"><span class="lbl">أرقام التواصل</span><div id="phones"></div>' +
      '<div class="btnrow"><button type="button" class="btn sm ghost" data-act="addphone">' + icon('plus') + ' رقم تاني باسم مختلف</button>' +
      (CONTACTS_OK ? '<button type="button" class="btn sm ghost" data-act="pickcontact">' + icon('users') + ' من جهات الاتصال</button>' : '') + '</div></div>' +
      '<div class="two"><div class="field"><label for="nc_city">المدينة</label><input id="nc_city" list="cities" value="' + esc(c.city || S.settings.default_city) + '"></div>' +
      '<div class="field"><label for="nc_addr">الحي أو العنوان</label><input id="nc_addr" type="text" value="' + esc(c.address || '') + '" autocomplete="off"></div></div>' +
      '<div class="field"><span class="lbl">الموقع</span><div class="geo"><button type="button" class="btn sm ghost" data-act="geo">' + icon('pin') + ' موقعي الحالي</button></div>' +
      '<input id="nc_map" type="text" class="ltr" placeholder="أو الصق رابط الموقع من واتساب" value="' + esc(loc) + '" autocomplete="off"><div id="geoOk" class="geo-ok hidden"></div></div>' +
      '<details class="more"' + (hasMore ? ' open' : '') + '><summary>تفاصيل أكتر عن العميل (اختياري)</summary>' +
      '<div class="field"><label for="nc_email">البريد الإلكتروني</label><input id="nc_email" type="email" class="ltr" value="' + esc(c.email || '') + '" autocomplete="off"></div>' +
      '<div class="field"><label for="nc_hours">ساعات الدوام</label><input id="nc_hours" type="text" placeholder="مثال: من 8 ص إلى 4 م، الأحد للخميس" value="' + esc(c.work_hours || '') + '"></div>' +
      '<div class="field"><label for="nc_access">تعليمات الدخول للموقع</label><textarea id="nc_access" style="min-height:64px" placeholder="مثال: البوابة الخلفية، تصريح دخول، اسأل عن م. خالد">' + esc(c.access_notes || '') + '</textarea></div>' +
      '<div class="field"><label for="nc_tax">الرقم الضريبي</label><input id="nc_tax" type="text" class="ltr" value="' + esc(c.tax_no || '') + '"></div>' +
      '<div class="field"><span class="lbl">مصدر العميل</span><div class="picks tight" id="csources" data-for="nc_source">' + chipsFor(YQ.SOURCES, 'nc_source') + '</div>' +
      '<input id="nc_source" data-chips="csources" type="text" placeholder="أو اكتب" value="' + esc(c.source || '') + '"></div>' +
      '<div class="field" style="margin-bottom:6px"><label for="nc_note">ملاحظات</label><textarea id="nc_note" style="min-height:64px">' + esc(c.note || '') + '</textarea></div></details>' +
      '<datalist id="cities">' + CITIES.map(x => '<option value="' + x + '">').join('') + '</datalist>';
  }

  function readClient() {
    const v = id => { const x = document.getElementById(id); return x ? x.value.trim() : ''; };
    if (!v('nc_name')) throw new Error('اكتب اسم العميل');
    const rows = CF.phones.map(p => ({ id: p.id, name: (p.name || '').trim(), role: (p.role || '').trim(), raw: (p.phone || '').trim(), cc: p.cc }))
      .filter(p => p.raw || p.name || p.role);
    if (!rows.length || !rows[0].raw) throw new Error('اكتب رقم العميل الأساسي');
    const seen = new Set();
    const phones = rows.map(p => {
      if (!p.raw) throw new Error('اكتب رقم «' + p.name + '»');
      const ph = normPhone(p.raw, p.cc);
      if (ph.length < 9) throw new Error('الرقم «' + p.raw + '» مش مظبوط');
      if (seen.has(ph)) throw new Error('الرقم ' + p.raw + ' متكرر');
      seen.add(ph);
      return { id: p.id, name: p.name, role: p.role, phone: ph };
    });
    const loc = parseLoc(v('nc_map')), raw = v('nc_map');
    const d = {
      name: v('nc_name'), type: v('nc_type'), city: v('nc_city'), address: v('nc_addr'), email: v('nc_email'), work_hours: v('nc_hours'),
      access_notes: v('nc_access'), tax_no: v('nc_tax'), source: v('nc_source'), note: v('nc_note'), phones,
      lat: null, lng: null, map_url: null
    };
    if (CF.geo) { d.lat = CF.geo.lat; d.lng = CF.geo.lng; }
    else if (loc) { d.lat = loc.lat; d.lng = loc.lng; d.map_url = loc.url || null; }
    else if (/^https?:/i.test(raw)) d.map_url = raw;
    return d;
  }
  function findDup(phone, exceptId) {
    const c = S.clients.find(x => x.id !== exceptId && x.phone === phone);
    if (c) return c;
    const k = S.contacts.find(x => x.client_id !== exceptId && x.phone === phone);
    return k ? S.cmap.get(k.client_id) : null;
  }
  async function persistClient(d, existing) {
    if (!existing) {
      const dup = findDup(d.phones[0].phone, null);
      if (dup) {
        if (confirm('الرقم الأساسي مسجل باسم «' + dup.name + '». نستخدم العميل ده بدل ما نكرره؟')) return { client: dup, reused: true };
        throw new Error('اتلغى الحفظ');
      }
    }
    const p0 = d.phones[0];
    const row = {
      name: d.name, client_type: d.type || null, phone: p0.phone, contact_name: p0.name || null, contact_role: p0.role || null,
      city: d.city || null, address: d.address || null, email: d.email || null, work_hours: d.work_hours || null,
      access_notes: d.access_notes || null, tax_no: d.tax_no || null, source: d.source || null, note: d.note || null,
      lat: d.lat, lng: d.lng, map_url: d.map_url
    };
    if (existing) row.id = existing.id;
    const saved = await api.saveClient(row);
    upsertClient(saved);
    const have = (S.ctmap.get(saved.id) || []).slice();
    const keep = new Set();
    for (const p of d.phones.slice(1)) {
      const body = { client_id: saved.id, name: p.name || 'بدون اسم', role: p.role || null, phone: p.phone };
      if (p.id) {
        keep.add(p.id);
        const old = have.find(k => k.id === p.id);
        if (!old || old.name !== body.name || (old.role || '') !== (p.role || '') || old.phone !== p.phone) {
          const k = await api.saveContact(Object.assign({ id: p.id }, body));
          S.contacts = S.contacts.map(x => x.id === k.id ? k : x);
        }
      } else {
        const k = await api.saveContact(body);
        S.contacts.push(k);
      }
    }
    if (existing) {
      for (const k of have) {
        if (!keep.has(k.id)) { await api.deleteContact(k.id); S.contacts = S.contacts.filter(x => x.id !== k.id); }
      }
    }
    reindex();
    return { client: saved, reused: false };
  }

  V.clientform = p => {
    const edit = p[0] === 'edit';
    const c = edit ? S.cmap.get(p[1]) : null;
    if (edit && !c) return notFound();
    CF = newCF(c);
    return {
      title: edit ? 'تعديل العميل' : 'عميل جديد', back: true, nav: false, cls: 'noNav',
      html: '<div class="panel"><h3>بيانات العميل</h3>' + clientFieldsHtml(c) + '</div>' +
        '<div class="savebar"><button class="btn block-btn" id="saveClientBtn" data-act="saveclient">' + (edit ? 'حفظ التعديلات' : 'حفظ العميل') + '</button>' +
        (edit ? '<button class="btn danger block-btn" style="margin-top:8px" data-act="delclient" data-id="' + c.id + '">حذف العميل</button>' : '') + '</div>',
      after() { bindClientForm(); }
    };
  };

  /* =====================================================
     فورم الزيارة / الميعاد
     ===================================================== */
  const ta = (id, label, val, ph) => '<div class="field"><label for="' + id + '">' + label + '</label><textarea id="' + id + '" placeholder="' + esc(ph || '') + '">' + esc(val || '') + '</textarea></div>';

  function detFieldHtml(kind, f, det) {
    if (f.type === 'chips' || f.type === 'multi') {
      return '<div class="field"><span class="lbl">' + f.label + '</span><div class="picks tight">' + f.opts.map(o =>
        '<button type="button" class="pick sm" data-act="dchip" data-k="' + f.k + '" data-v="' + esc(o) + '"' + (f.type === 'multi' ? ' data-multi="1"' : '') + '>' + esc(o) + '</button>').join('') + '</div></div>';
    }
    const val = det[f.k] == null ? '' : det[f.k];
    const extra = f.type === 'number' ? ' inputmode="decimal" min="0" step="any"' : '';
    return '<div class="field"><label for="d_' + kind + '_' + f.k + '">' + f.label + '</label><input id="d_' + kind + '_' + f.k + '" type="' + f.type + '"' + extra +
      ' value="' + esc(val) + '" placeholder="' + esc(f.ph || '') + '"></div>';
  }
  const detFields = (kind, done) => YQ.DET[kind].filter(f => done || f.pre).map(f => detFieldHtml(kind, f, F.det)).join('');

  function probCauseField(id, chipsId, label, val, ph) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><div class="picks tight" id="' + chipsId + '" data-for="' + id + '"></div>' +
      '<input id="' + id + '" data-chips="' + chipsId + '" type="text" value="' + esc(val || '') + '" placeholder="' + esc(ph) + '" autocomplete="off"></div>';
  }

  V.form = (p, q) => {
    const sub = p[0];
    let visit = null, mode;
    if (sub === 'edit' || sub === 'complete') {
      visit = S.vmap.get(p[1]);
      if (!visit) return notFound();
      mode = sub === 'complete' ? 'done' : (visit.status === 'scheduled' ? 'appt' : 'done');
    } else mode = sub === 'appt' ? 'appt' : 'done';

    const cid = visit ? visit.client_id : q.get('client');
    const client = cid ? S.cmap.get(cid) : null;
    const v = visit || {};
    F = {
      mode, visit, sub, clientId: client ? client.id : null, branchId: v.branch_id || q.get('branch') || '', newClient: false,
      kind: v.kind || q.get('kind') || (q.get('parent') ? 'install' : null),
      resolved: v.resolved == null ? null : v.resolved,
      quoteSent: !!v.quote_sent, decision: v.decision || 'pending',
      parent: v.parent_visit_id || q.get('parent') || null,
      priority: v.priority || 'normal', det: JSON.parse(JSON.stringify(v.details || {})),
      existing: (v.photos || []).slice(), removed: [], urls: {}, newFiles: [], saving: false
    };
    CF = newCF(null);
    const done = mode === 'done';
    const fixedClient = !!client;
    const at0 = !visit ? (done ? new Date() : nextHour()) : (sub === 'complete' ? new Date() : new Date(v.at));
    const title = sub === 'edit' ? 'تعديل' : sub === 'complete' ? 'كمّل بيانات الزيارة' : done ? 'زيارة تمت' : 'ميعاد زيارة';

    // --- العميل ---
    let clientBlock;
    if (fixedClient) {
      clientBlock = '<div class="picked"><b>' + esc(client.name) + '</b><span class="muted small">' + esc(client.city || '') + '</span></div>' + branchSelectHtml(client.id,F.branchId);
    } else {
      clientBlock =
        '<div class="seg" style="margin-bottom:12px"><button data-act="cswitch" data-v="old" id="cs_old" class="on">عميل موجود</button><button data-act="cswitch" data-v="new" id="cs_new">عميل جديد</button></div>' +
        '<div id="cOld"><div id="cPick" class="hidden"></div><div id="cSearch"><input id="cq2" type="search" placeholder="ابحث بالاسم أو الرقم" autocomplete="off"><div id="cres" class="found hidden"></div></div></div>' +
        '<div id="cNew" class="hidden">' + clientFieldsHtml(null) + '</div>';
    }

    // --- التصنيف (اختيار أو كتابة) ---
    const cats = catsAll();
    const customCat = v.category && cats.indexOf(v.category) < 0;
    const catBlock = '<div class="field"><label for="f_catsel">التصنيف</label><select id="f_catsel"><option value="">اختار التصنيف</option>' +
      cats.map(c => '<option' + (c === v.category ? ' selected' : '') + '>' + esc(c) + '</option>').join('') +
      '<option value="__new"' + (customCat ? ' selected' : '') + '>اكتب تصنيف تاني...</option></select>' +
      '<input id="f_cat" type="text" class="hidden" style="margin-top:8px" placeholder="اكتب اسم التصنيف" value="' + (customCat ? esc(v.category) : '') + '" autocomplete="off"></div>';

    const kindPicks = Object.keys(KINDS).map(k => '<button type="button" class="pick ' + k + '" data-act="pickKind" data-kind="' + k + '">' + KINDS[k] + '</button>').join('');
    const prioPicks = Object.keys(YQ.PRIORITIES).map(k => '<button type="button" class="pick sm" data-act="prio" data-v="' + k + '">' + YQ.PRIORITIES[k] + '</button>').join('');

    // --- بلوكات كل نوع ---
    const deviceBlock =
      '<div class="sub"><div class="field"><label for="f_device">الجهاز المتأثر</label><input id="f_device" type="text" value="' + esc(v.device_name || '') + '" placeholder="اسم الجهاز"></div>' +
      '<div class="field" style="margin:0"><label for="f_pw">باسورد الجهاز (اختياري)</label><div class="two" style="grid-template-columns:1fr auto"><input id="f_pw" type="password" class="ltr" autocomplete="new-password" placeholder="' + (v.has_device_password ? 'محفوظ. اكتب جديد لو عايز تغيّره' : '') + '"><button type="button" class="btn sm ghost" data-act="pwtoggle">إظهار</button></div>' +
      '<div class="hint">بيتحفظ مشفّر على السيرفر.</div>' +
      (v.has_device_password ? '<label class="check"><input id="f_clrpw" type="checkbox"> امسح الباسورد المحفوظ</label>' : '') + '</div></div>';
    const resolvedBlock =
      '<div class="field"><span class="lbl">العطل اتحل؟</span><div class="picks"><button type="button" class="pick" id="resYes" data-act="res" data-v="yes">اتحل</button><button type="button" class="pick" id="resNo" data-act="res" data-v="no">متحلش</button></div></div>' +
      '<div id="boxYes" class="hidden">' + ta('f_res', 'عملنا إيه؟', v.resolution, 'اللي اتعمل لحل العطل') + '</div>' +
      '<div id="boxNo" class="hidden"><div class="field"><label for="f_reason">ليه متحلش؟</label><select id="f_reason"><option value="">اختار السبب</option>' +
      Object.keys(REASONS).map(k => '<option value="' + k + '"' + (v.unresolved_reason === k ? ' selected' : '') + '>' + REASONS[k] + '</option>').join('') + '</select></div>' +
      ta('f_unote', 'تفاصيل (اختياري)', v.unresolved_note, '') +
      '<div class="field"><label for="f_follow">تاريخ المتابعة (اختياري)</label><input id="f_follow" type="date" value="' + esc(v.follow_up_date || '') + '"></div></div>';
    const quoteBlock =
      '<label class="check"><input id="f_qsent" type="checkbox"' + (v.quote_sent ? ' checked' : '') + '> الكوتيشن اتبعت</label>' +
      '<div id="boxQ" class="sub hidden" style="margin-top:8px"><div class="field"><label for="f_qdate">تاريخ الإرسال</label><input id="f_qdate" type="date" value="' + esc(v.quote_sent_at || dayKey(new Date())) + '"></div>' +
      '<div class="field"><label for="f_decision">قرار العميل</label><select id="f_decision">' +
      Object.keys(DECISIONS).map(k => '<option value="' + k + '"' + ((v.decision || 'pending') === k ? ' selected' : '') + '>' + DECISIONS[k] + '</option>').join('') + '</select></div>' +
      '<div id="boxRej" class="hidden" style="margin:0">' + ta('f_rej', 'سبب الرفض', v.reject_reason, '') + '</div></div>';

    const kindBlocks =
      '<div class="sec" data-k="fault">' +
      probCauseField('f_problem', 'probChips', 'المشكلة', v.problem, 'اختار من فوق أو اكتب المشكلة') +
      ta('f_desc', done ? 'وصف تفصيلي' : 'وصف المشكلة (كما قالها العميل)', v.description, 'ممكن تلصق رسالة العطل من واتساب') +
      (done ? deviceBlock : '') + detFields('fault', done) +
      (done ? probCauseField('f_cause', 'causeChips', 'السبب (جذر المشكلة)', v.cause, 'اختار من فوق أو اكتب السبب') + resolvedBlock : '') + '</div>' +

      '<div class="sec" data-k="inspection">' + detFields('inspection', done) +
      ta('f_iabout', done ? 'المعاينة كانت عن إيه؟' : 'المعاينة هتبقى عن إيه؟', v.insp_about, '') + ta('f_ineeds', 'المطلوب إيه؟', v.insp_needs, '') +
      (done ? quoteBlock : '') + '</div>' +

      '<div class="sec" data-k="supply">' + ta('f_items', done ? 'بنود التوريد' : 'بنود التوريد المتوقعة', v.supply_items, 'اكتب البنود بشكل بسيط') +
      (done ? '<div class="field"><label for="f_price">السعر (اختياري)</label><input id="f_price" type="number" inputmode="decimal" min="0" step="any" value="' + esc(v.supply_price == null ? '' : v.supply_price) + '"></div>' +
        '<div class="field"><span class="lbl">النوع</span><div class="picks">' +
        Object.keys(SUPPLY_MODES).map(k => '<label class="check" style="margin-inline-end:14px"><input type="radio" name="smode" value="' + k + '"' + ((v.supply_mode || 'supply_only') === k ? ' checked' : '') + '> ' + SUPPLY_MODES[k] + '</label>').join('') + '</div></div>' : '') +
      detFields('supply', done) + '</div>' +

      '<div class="sec" data-k="install">' + ta('i_desc', done ? 'وصف التركيب' : 'وصف الشغل المطلوب', v.description, '') + detFields('install', done) + '</div>' +

      '<div class="sec" data-k="maintenance">' + detFields('maintenance', done) +
      (done ? ta('m_desc', 'ملاحظات الفحص', v.description, 'أي حاجة لقيتها أثناء الصيانة') : '') + '</div>';

    const doneExtras = !done ? '' :
      '<div class="two"><div class="field"><label for="f_arr">وقت الوصول</label><input id="f_arr" type="time" value="' + (v.arrived_at ? timeOf(new Date(v.arrived_at)) : '') + '"></div>' +
      '<div class="field"><label for="f_fin">وقت الانتهاء</label><input id="f_fin" type="time" value="' + (v.finished_at ? timeOf(new Date(v.finished_at)) : '') + '"></div></div>' +
      '<div class="field"><span class="lbl">صور الشغل</span><div class="btnrow"><span class="btn sm ghost filebtn">' + icon('camera') + ' إضافة صور<input id="f_files" type="file" accept="image/*" multiple></span></div><div class="pgrid" id="pgrid"></div></div>';

    const html =
      '<div class="panel"><h3>العميل</h3>' + clientBlock + '</div>' +
      '<div class="panel"><h3>' + (done ? 'الزيارة' : 'الميعاد') + '</h3>' +
      '<div class="field"><label for="f_at">' + (done ? 'وقت الزيارة' : 'اليوم والساعة') + '</label><input id="f_at" type="datetime-local" value="' + toInput(at0) + '"></div>' +
      '<div class="field"><span class="lbl">' + (done ? 'سبب الزيارة' : 'سبب الزيارة المتوقع') + '</span><div class="picks">' + kindPicks + '</div></div>' +
      '<div class="field"><span class="lbl">الأولوية</span><div class="picks tight">' + prioPicks + '</div></div>' +
      catBlock +
      '<div class="field"><label for="f_met">' + (done ? 'قابلت مين؟' : 'هقابل مين؟') + '</label><div class="picks tight" id="metChips" data-for="f_met"></div>' +
      '<input id="f_met" data-chips="metChips" type="text" value="' + esc(v.met_with || '') + '" placeholder="اسم الشخص" autocomplete="off"></div>' +
      kindBlocks + doneExtras +
      '<div class="field" style="margin:0"><label for="f_notes">ملاحظات' + (done ? ' (اختياري)' : '') + '</label><textarea id="f_notes" placeholder="' + (done ? '' : 'أي حاجة تفتكرها عن الزيارة') + '">' + esc(v.notes || '') + '</textarea></div></div>' +
      '<div class="savebar"><button class="btn block-btn" id="saveBtn" data-act="save">' + (done ? 'حفظ الزيارة' : 'حفظ الميعاد') + '</button>' +
      (sub === 'complete' ? '<p class="muted small" style="text-align:center;margin-top:8px">بعد الحفظ الميعاد بيتحول لزيارة تمت.</p>' : '') + '</div>';

    return {
      title, back: true, nav: false, cls: 'noNav', html,
      after() {
        bindClientForm();
        syncForm();
        refreshCatChips();
        const cq2 = $('#cq2');
        if (cq2) cq2.addEventListener('input', e => searchClients(e.target.value));
        $('#f_catsel').addEventListener('change', () => { syncForm(); refreshCatChips(); });
        $('#f_cat').addEventListener('input', refreshCatChips);
        const qs = $('#f_qsent');
        if (qs) qs.addEventListener('change', () => { F.quoteSent = qs.checked; syncForm(); });
        const dc = $('#f_decision');
        if (dc) dc.addEventListener('change', () => { F.decision = dc.value; syncForm(); });
        const ff = $('#f_files');
        if (ff) ff.addEventListener('change', () => { F.newFiles = F.newFiles.concat(Array.from(ff.files)); ff.value = ''; renderPhotos(); });
        if (F.existing.length) {
          api.photoUrls(F.existing).then(map => { F.urls = map; renderPhotos(); }).catch(() => { });
        }
        renderPhotos();
      }
    };
  };

  function currentCat() {
    const s = $('#f_catsel');
    if (!s) return '';
    return s.value === '__new' ? ($('#f_cat').value || '').trim() : s.value;
  }
  function refreshCatChips() {
    const cat = currentCat();
    const pc = $('#probChips');
    if (pc) { pc.innerHTML = chipsFor(problemsFor(cat), 'f_problem'); syncFill(pc); }
    const cc = $('#causeChips');
    if (cc) { cc.innerHTML = chipsFor(causesFor(cat), 'f_cause'); syncFill(cc); }
  }
  function refreshMetChips() {
    const box = $('#metChips');
    if (!box) return;
    const c = F.clientId && S.cmap.get(F.clientId);
    const names = c ? uniq([c.contact_name].concat((S.ctmap.get(c.id) || []).map(k => k.name))) : [];
    box.innerHTML = chipsFor(names, 'f_met');
    syncFill(box);
  }

  function syncForm() {
    if (!F) return;
    $$('.pick[data-kind]').forEach(b => b.classList.toggle('on', b.dataset.kind === F.kind));
    $$('.pick[data-act=prio]').forEach(b => b.classList.toggle('on', b.dataset.v === F.priority));
    $$('.pick[data-act=dchip]').forEach(b => {
      const cur = F.det[b.dataset.k];
      b.classList.toggle('on', b.dataset.multi ? Array.isArray(cur) && cur.indexOf(b.dataset.v) >= 0 : cur === b.dataset.v);
    });
    $$('.sec[data-k]').forEach(s => s.classList.toggle('hidden', !F.kind || s.dataset.k.split(' ').indexOf(F.kind) < 0));
    $('#f_cat').classList.toggle('hidden', $('#f_catsel').value !== '__new');
    const y = $('#resYes'), n = $('#resNo');
    if (y) { y.classList.toggle('on', F.resolved === true); n.classList.toggle('on', F.resolved === false); }
    const by = $('#boxYes'), bn = $('#boxNo');
    if (by) { by.classList.toggle('hidden', F.resolved !== true); bn.classList.toggle('hidden', F.resolved !== false); }
    const bq = $('#boxQ');
    if (bq) { bq.classList.toggle('hidden', !F.quoteSent); $('#boxRej').classList.toggle('hidden', F.decision !== 'rejected'); }
    const co = $('#cOld'), cn = $('#cNew');
    if (co) {
      co.classList.toggle('hidden', F.newClient); cn.classList.toggle('hidden', !F.newClient);
      $('#cs_old').classList.toggle('on', !F.newClient); $('#cs_new').classList.toggle('on', F.newClient);
      const picked = F.clientId && S.cmap.get(F.clientId);
      $('#cPick').classList.toggle('hidden', !picked);
      $('#cSearch').classList.toggle('hidden', !!picked);
      if (picked) {
        $('#cPick').innerHTML = '<div class="picked"><b>' + esc(picked.name) + '</b><span class="muted small">' + esc(picked.city || '') + '</span>' +
          '<button type="button" class="ib" data-act="cclear" aria-label="تغيير">' + icon('x') + '</button></div>' + branchSelectHtml(picked.id, F.branchId);
      }
    }
    refreshMetChips();
  }

  function searchClients(text) {
    const box = $('#cres'), q = text.trim().toLowerCase(), qd = q.replace(/\D/g, '');
    if (!q) { box.classList.add('hidden'); return; }
    const hits = S.clients.filter(c => c.name.toLowerCase().includes(q) || (c.city || '').toLowerCase().includes(q) || (qd && (c.phone || '').includes(qd)) ||
      (S.ctmap.get(c.id) || []).some(k => k.name.toLowerCase().includes(q) || (qd && k.phone.includes(qd)))).slice(0, 8);
    box.classList.remove('hidden');
    box.innerHTML = hits.length
      ? hits.map(c => '<button type="button" data-act="cpick" data-id="' + c.id + '"><span><b>' + esc(c.name) + '</b><br><small class="muted">' + esc([c.client_type, c.city].filter(Boolean).join('، ')) + '</small></span><span class="ltr muted small">' + (c.phone ? '+' + esc(c.phone) : '') + '</span></button>').join('')
      : '<button type="button" data-act="cswitch" data-v="new"><span>مفيش عميل بالاسم ده. ضيفه كعميل جديد</span></button>';
  }

  function renderPhotos() {
    const g = $('#pgrid'); if (!g) return;
    let h = '';
    F.existing.forEach((path, i) => {
      h += '<div class="ph">' + (F.urls[path] ? '<img src="' + esc(F.urls[path]) + '" alt="صورة">' : '') +
        '<button type="button" class="x" data-act="rmold" data-i="' + i + '" aria-label="حذف الصورة">' + icon('x') + '</button></div>';
    });
    F.newFiles.forEach((f, i) => {
      h += '<div class="ph"><img src="' + esc(URL.createObjectURL(f)) + '" alt="صورة جديدة">' +
        '<button type="button" class="x" data-act="rmnew" data-i="' + i + '" aria-label="حذف الصورة">' + icon('x') + '</button></div>';
    });
    g.innerHTML = h;
  }

  async function compress(file, max) {
    max = max || 1600;
    const bmp = await createImageBitmap(file);
    const sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('مقدرتش أجهز الصورة')), 'image/jpeg', 0.8));
  }

  function readDetails(done) {
    const out = {};
    (YQ.DET[F.kind] || []).forEach(f => {
      if (!done && !f.pre) return;
      let val;
      if (f.type === 'chips' || f.type === 'multi') val = F.det[f.k];
      else { const el = document.getElementById('d_' + F.kind + '_' + f.k); val = el ? el.value.trim() : ''; }
      if (f.type === 'number' && val !== '' && val != null) val = Number(val);
      if (val === '' || val == null || (Array.isArray(val) && !val.length)) return;
      out[f.k] = val;
    });
    return out;
  }

  async function saveForm() {
    if (F.saving) return;
    const val = id => { const x = document.getElementById(id); const s = x ? x.value.trim() : ''; return s || null; };
    const btn = $('#saveBtn');

    // 1) التحقق
    const hasFixed = !!F.clientId;
    let cd = null;
    if (!hasFixed && F.newClient) {
      try { cd = readClient(); } catch (e) { return toast(e.message, 'err'); }
    } else if (!hasFixed) return toast('اختار عميل أو ضيف عميل جديد', 'err');
    const at = new Date($('#f_at').value);
    if (isNaN(at)) return toast('حدد اليوم والساعة', 'err');
    if (!F.kind) return toast('اختار سبب الزيارة', 'err');
    const cat = currentCat();
    if ($('#f_catsel').value === '__new' && !cat) return toast('اكتب اسم التصنيف أو اختار من القايمة', 'err');
    if (F.mode === 'done' && F.kind === 'fault') {
      if (!val('f_problem') && !val('f_desc')) return toast('اختار المشكلة أو اكتبها', 'err');
      if (F.resolved === null) return toast('حدد: العطل اتحل ولا لأ', 'err');
      if (F.resolved === false && !$('#f_reason').value) return toast('اختار سبب إن العطل متحلش', 'err');
    }

    F.saving = true; btn.disabled = true; btn.textContent = 'بيحفظ...';
    try {
      // 2) العميل
      let clientId = F.clientId;
      if (!hasFixed && F.newClient) {
        const r = await persistClient(cd, null);
        clientId = r.client.id;
      }

      // 3) الزيارة
      const row = {
        client_id: clientId, kind: F.kind, category: cat || null, at: at.toISOString(),
        notes: val('f_notes'), parent_visit_id: F.parent || null, priority: F.priority, met_with: val('f_met'),
        problem: null, cause: null, details: {}
      };
      row.branch_id = $('#f_branch') && $('#f_branch').value || null;
      if (F.visit) row.id = F.visit.id;
      if (F.mode === 'appt') {
        row.status = 'scheduled';
        row.details = readDetails(false);
        if (F.kind === 'fault') { row.problem = val('f_problem'); row.description = val('f_desc'); }
        else if (F.kind === 'inspection') { row.insp_about = val('f_iabout'); row.insp_needs = val('f_ineeds'); }
        else if (F.kind === 'supply') row.supply_items = val('f_items');
        else if (F.kind === 'install') row.description = val('i_desc');
      } else {
        const base = new Date(at);
        const combine = id => { const t = val(id); if (!t) return null; const d = new Date(base); d.setHours(+t.slice(0, 2), +t.slice(3, 5), 0, 0); return d.toISOString(); };
        Object.assign(row, {
          status: 'done', arrived_at: combine('f_arr'), finished_at: combine('f_fin'), details: readDetails(true),
          description: null, device_name: null, resolved: null, resolution: null, unresolved_reason: null, unresolved_note: null, follow_up_date: null,
          insp_about: null, insp_needs: null, quote_sent: false, quote_sent_at: null, decision: 'pending', reject_reason: null,
          supply_items: null, supply_price: null, supply_mode: null
        });
        if (F.kind === 'fault') {
          row.problem = val('f_problem'); row.cause = val('f_cause');
          row.description = val('f_desc'); row.device_name = val('f_device'); row.resolved = F.resolved;
          if (F.resolved) row.resolution = val('f_res');
          else { row.unresolved_reason = $('#f_reason').value || null; row.unresolved_note = val('f_unote'); row.follow_up_date = $('#f_follow').value || null; }
        } else if (F.kind === 'inspection') {
          row.insp_about = val('f_iabout'); row.insp_needs = val('f_ineeds'); row.quote_sent = F.quoteSent;
          if (F.quoteSent) {
            row.quote_sent_at = $('#f_qdate').value || dayKey(new Date());
            row.decision = $('#f_decision').value;
            if (row.decision === 'rejected') row.reject_reason = val('f_rej');
          }
        } else if (F.kind === 'supply') {
          row.supply_items = val('f_items'); row.supply_price = val('f_price') == null ? null : Number(val('f_price'));
          const sm = $('input[name=smode]:checked'); row.supply_mode = sm ? sm.value : 'supply_only';
        } else if (F.kind === 'install') {
          row.description = val('i_desc');
        } else if (F.kind === 'maintenance') {
          row.description = val('m_desc');
        }
      }
      let saved = await api.saveVisit(row);
      rememberCustom(cat, row.problem, row.cause);

      // 4) الباسورد
      if (F.mode === 'done' && F.kind === 'fault') {
        const pw = $('#f_pw') ? $('#f_pw').value : '';
        const clr = $('#f_clrpw') && $('#f_clrpw').checked;
        if (pw) { await api.setDevicePassword(saved.id, pw); saved.has_device_password = true; }
        else if (clr) { await api.setDevicePassword(saved.id, ''); saved.has_device_password = false; }
      }

      // 5) الصور
      if (F.mode === 'done' && (F.newFiles.length || F.removed.length)) {
        const photos = F.existing.slice();
        for (let i = 0; i < F.newFiles.length; i++) {
          btn.textContent = 'بيرفع الصور ' + (i + 1) + '/' + F.newFiles.length;
          photos.push(await api.uploadPhoto(saved.id, await compress(F.newFiles[i])));
        }
        const flag = saved.has_device_password;
        saved = await api.saveVisit({ id: saved.id, photos });
        saved.has_device_password = flag;
        if (F.removed.length) api.removePhotos(F.removed).catch(() => { });
      }

      upsertVisit(saved);
      F = null;
      if (saved.status === 'scheduled') {
        S.apptTab = 'up';
        toast('اتضاف: ' + relDay(new Date(saved.at)) + '، ' + dfTime.format(new Date(saved.at)));
        go('/appts');
      } else {
        toast('اتحفظت');
        go('/visit/' + saved.id);
      }
    } catch (e) {
      if (F) { F.saving = false; btn.disabled = false; btn.textContent = F.mode === 'appt' ? 'حفظ الميعاد' : 'حفظ الزيارة'; }
      fail(e);
    }
  }

  /* =====================================================
     الإجراءات (أزرار)
     ===================================================== */
  async function patchVisit(id, patch) {
    const saved = await api.saveVisit(Object.assign({ id }, patch));
    const old = S.vmap.get(id);
    if (old && saved.has_device_password == null) saved.has_device_password = old.has_device_password;
    upsertVisit(saved);
    render();
    return saved;
  }

  function exportCsv() {
    const head = ['الاسم', 'الرقم', 'المدينة', 'أرقام إضافية', 'عدد الزيارات', 'آخر زيارة', 'ملاحظة', 'رابط الموقع', 'رابط واتساب'];
    const rows = S.clients.map(c => {
      const vs = visitsOf(c.id).filter(v => v.status === 'done');
      const extra = (S.ctmap.get(c.id) || []).map(k => k.name + (k.role ? ' (' + k.role + ')' : '') + ': +' + k.phone).join(' / ');
      return [c.name, c.phone ? '+' + c.phone : '', c.city || '', extra, vs.length, vs[0] ? dfDate.format(new Date(vs[0].at)) : '', c.note || '', mapLink(c), waLink(c.phone)];
    });
    const csv = '\ufeff' + [head].concat(rows).map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'yaqoub-clients-' + dayKey(new Date()) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  function downloadBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res;
      s.onerror = () => rej(new Error('مقدرتش أحمّل مكتبة الإكسل. اتأكد من النت'));
      document.head.appendChild(s);
    });
  }
  async function exportXlsx(clientsOnly) {
    toast('بجهّز ملف الإكسل...');
    if (!window.ExcelJS) await loadScript('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js');
    const now = new Date();
    let wb, name;
    if (clientsOnly) {
      wb = window.YaqoubExcel.buildClients(window.ExcelJS, { clients: S.clients, contacts: S.contacts, visits: S.visits, now });
      name = 'yaqoub-clients-' + dayKey(now) + '.xlsx';
    } else {
      const R = S.range || rangeFor('month');
      wb = window.YaqoubExcel.build(window.ExcelJS, { clients: S.clients, contacts: S.contacts, visits: S.visits, range: { from: R.from, to: R.to }, now });
      name = 'yaqoub-report-' + dayKey(R.from) + '_' + dayKey(R.to) + '.xlsx';
    }
    const buf = await wb.xlsx.writeBuffer();
    downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
    toast('الملف اتحمّل');
  }

  const ACT = {
    back() { if (history.length > 1) history.back(); else go('/home'); },
    async logout() { if (confirm('تسجيل خروج؟')) await api.signOut(); },
    apptTab(el) { S.apptTab = el.dataset.t; render(); },
    preset(el) {
      const p = el.dataset.p;
      if (p === 'custom') { S.range = Object.assign({}, S.range || rangeFor('month'), { preset: 'custom' }); }
      else S.range = rangeFor(p);
      render();
    },
    exportcsv: exportCsv,
    exportxlsx() { return exportXlsx(false); },
    async pushon() {
      if (!('Notification' in window)) throw new Error('المتصفح مش بيدعم الإشعارات');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('الإذن اترفض. فعّله من إعدادات المتصفح للموقع');
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToU8(api.vapidKey) });
      await api.savePush(sub);
      toast('الإشعارات اشتغلت');
      render();
    },
    async pushoff() {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { const ep = sub.endpoint; await sub.unsubscribe(); await api.removePush(ep).catch(() => { }); }
      toast('اتوقفت الإشعارات');
      render();
    },
    async pushtest(el) {
      el.disabled = true;
      try {
        const r = await api.testPush();
        if (r && r.sent) toast('بعتّلك إشعار تجريبي'); else toast('مفيش جهاز مسجّل. فعّل الإشعارات الأول', 'err');
      } finally { el.disabled = false; }
    },
    pushdismiss() {
      try { localStorage.setItem('yq_push_dismiss', '1'); } catch (e) { /* تجاهل */ }
      const c = $('#pushcard'); if (c) c.innerHTML = '';
    },
    wamsg(el) {
      const v = S.vmap.get(el.dataset.id), c = v && S.cmap.get(v.client_id);
      if (!c || !c.phone) return toast('مفيش رقم للعميل', 'err');
      const at = new Date(v.at);
      const t = el.dataset.k === 'quote'
        ? 'السلام عليكم ' + c.name + '، حابين نتابع معاكم بخصوص عرض السعر اللي أرسلناه بعد المعاينة. هل في أي استفسار نقدر نوضحه؟'
        : 'السلام عليكم ' + c.name + '، نؤكد لكم زيارتنا ' + relDay(at) + ' الساعة ' + dfTime.format(at) + ' بإذن الله. فريق يعقوب.';
      window.open('https://wa.me/' + c.phone + '?text=' + encodeURIComponent(t), '_blank', 'noopener');
    },
    exportclients() { return exportXlsx(true); },

    /* ---- أرقام التواصل ---- */
    async addcontact(el) {
      const r = await askSheet({
        title: 'إضافة رقم تواصل',
        fields: [{ name: 'name', label: 'الاسم', required: true },
          { name: 'role', label: 'المسمى (اختياري)', placeholder: 'مدير، محاسب، فني...' },
          { name: 'phone', label: 'الرقم', type: 'tel', ltr: true, required: true, placeholder: '05xxxxxxxx أو +20...', hint: 'الرقم السعودي بيتظبط تلقائي. لدولة تانية ابدأ بـ +' }]
      });
      if (!r) return;
      const phone = normPhone(r.phone, '966');
      if (phone.length < 9) return toast('الرقم مش مظبوط', 'err');
      const k = await api.saveContact({ client_id: el.dataset.id, name: r.name, role: r.role || null, phone });
      S.contacts.push(k); reindex(); toast('اتضاف الرقم'); render();
    },
    async editcontact(el) {
      const k = S.contacts.find(x => x.id === el.dataset.id); if (!k) return;
      const r = await askSheet({
        title: 'تعديل رقم التواصل', danger: 'حذف الرقم',
        fields: [{ name: 'name', label: 'الاسم', value: k.name, required: true },
          { name: 'role', label: 'المسمى', value: k.role || '' },
          { name: 'phone', label: 'الرقم', type: 'tel', ltr: true, value: '+' + k.phone, required: true }]
      });
      if (!r) return;
      if (r.__delete) {
        if (!confirm('تحذف الرقم ده؟')) return;
        await api.deleteContact(k.id);
        S.contacts = S.contacts.filter(x => x.id !== k.id); reindex(); toast('اتحذف'); return render();
      }
      const phone = normPhone(r.phone, '966');
      if (phone.length < 9) return toast('الرقم مش مظبوط', 'err');
      const saved = await api.saveContact({ id: k.id, client_id: k.client_id, name: r.name, role: r.role || null, phone });
      S.contacts = S.contacts.map(x => x.id === k.id ? saved : x); reindex(); toast('اتحفظ'); render();
    },
    async importcontacts(el) {
      const cid = el.dataset.id;
      const picked = await navigator.contacts.select(['name', 'tel'], { multiple: true });
      if (!picked || !picked.length) return;
      let n = 0;
      for (const p of picked) {
        const name = (p.name && p.name[0]) || 'بدون اسم';
        const tels = Array.from(new Set((p.tel || []).map(t => normPhone(t, '966')).filter(t => t.length >= 9)));
        for (const t of tels) {
          if ((S.ctmap.get(cid) || []).some(k => k.phone === t)) continue;
          const k = await api.saveContact({ client_id: cid, name, role: null, phone: t });
          S.contacts.push(k); reindex(); n++;
        }
      }
      toast(n ? 'اتضاف ' + n + ' رقم' : 'مفيش أرقام جديدة'); render();
    },
    async pickcontact() {
      const r = await navigator.contacts.select(['name', 'tel'], { multiple: true });
      if (!r || !r.length) return;
      r.forEach(p => {
        const name = (p.name && p.name[0]) || '';
        const tel = p.tel && p.tel[0];
        if (!tel) return;
        const first = CF.phones[0];
        const row = { name, role: '', cc: '966', phone: tel };
        if (CF.phones.length === 1 && !first.phone.trim() && !first.name.trim()) CF.phones[0] = row; else CF.phones.push(row);
      });
      renderPhones();
      const nm = $('#nc_name');
      if (nm && !nm.value.trim() && CF.phones[0].name) nm.value = CF.phones[0].name;
    },
    addphone() {
      CF.phones.push({ name: '', role: '', cc: '966', phone: '' });
      renderPhones();
      const rows = $$('.prow'); const last = rows[rows.length - 1];
      if (last) { const i = $('input', last); if (i) i.focus(); }
    },
    rmphone(el) { CF.phones.splice(+el.dataset.i, 1); renderPhones(); },
    fillchip(el) {
      const inp = document.getElementById(el.dataset.t);
      inp.value = inp.value.trim() === el.dataset.v ? '' : el.dataset.v;
      syncFill(el.parentElement);
    },
    dchip(el) {
      const k = el.dataset.k, v = el.dataset.v;
      if (el.dataset.multi) {
        const a = Array.isArray(F.det[k]) ? F.det[k].slice() : [];
        const i = a.indexOf(v);
        if (i >= 0) a.splice(i, 1); else a.push(v);
        F.det[k] = a;
      } else F.det[k] = F.det[k] === v ? '' : v;
      syncForm();
    },
    prio(el) { F.priority = el.dataset.v; syncForm(); },

    /* ---- ليلة ---- */
    sendchat() { const t = $('#cin'); const v = t.value; t.value = ''; t.style.height = 'auto'; return sendChat(v); },
    quickchat(el) { return sendChat(el.dataset.t); },
    clearchat() {
      if (!confirm('تبدأ محادثة جديدة؟')) return;
      S.chat = []; saveChat(); render();
    },
    async draftok(el) {
      const m = S.chat[+el.dataset.m], d = m && m.drafts && m.drafts[+el.dataset.d];
      if (!d || d.state !== 'new') return;
      el.disabled = true;
      const msg = await applyDraft(d);
      d.state = 'done';
      S.chat.push({ role: 'assistant', content: msg });
      saveChat(); renderChat();
    },
    draftno(el) {
      const m = S.chat[+el.dataset.m], d = m && m.drafts && m.drafts[+el.dataset.d];
      if (!d || d.state !== 'new') return;
      d.state = 'no'; saveChat(); renderChat();
    },
    mic() { startVoiceInput(false); },
    togglevoice() { voiceEnabled=!voiceEnabled; if(!voiceEnabled&&window.speechSynthesis)speechSynthesis.cancel();render(); },
    togglewake() {
      if(wakeEnabled)stopVoice();else{wakeEnabled=true;voiceEnabled=true;startVoiceInput(true);}
      render();
    },
    async chatlocation() {
      if(!confirm('نحسب مسافتك من مواقع العملاء والفروع؟ موقعك الدقيق يفضل في ذاكرة الصفحة فقط، والمسافات وأسماء المواقع بتتبعت لليلة لمعالجة سؤالك.'))return;
      const pos=await getPos();S.location={lat:pos.latitude,lng:pos.longitude,at:Date.now()};
      const sites=nearbySites();
      S.chat.push({role:'assistant',content:sites.length?'أقرب المواقع ليك بخط مستقيم:\n'+sites.slice(0,5).map(x=>x.label+': '+x.km.toFixed(1)+' كم').join('\n'):'مفيش إحداثيات محفوظة للعملاء. ضيف إحداثيات العميل أو الفرع الأول.'});
      saveChat();renderChat();voiceStatus('تم حساب المسافات. الموقع صالح للمقارنة لمدة 5 دقائق.');
    },
    addbranch(el) { return editBranch(el.dataset.id,null); },
    editbranch(el) { const b=S.branches.find(x=>x.id===el.dataset.id);if(b)return editBranch(b.client_id,b); },
    async delmem(el) {
      await api.deleteMemory(el.dataset.id);
      const row = el.closest('.crow'); if (row) row.remove();
      toast('اتمسحت من ذاكرة ليلة');
    },
    complete(el) { go('/form/complete/' + el.dataset.id); },
    edit(el) { go('/form/edit/' + el.dataset.id); },

    async postpone(el) {
      const v = S.vmap.get(el.dataset.id); if (!v) return;
      const r = await askSheet({ title: 'تأجيل الميعاد', submit: 'أجّل', fields: [{ name: 'at', label: 'الميعاد الجديد', type: 'datetime-local', value: toInput(new Date(Math.max(Date.now(), new Date(v.at).getTime()))), required: true }] });
      if (!r) return;
      await patchVisit(v.id, { at: new Date(r.at).toISOString(), status: 'scheduled' });
      toast('اتأجّل');
    },
    async cancelv(el) {
      if (!confirm('تلغي الميعاد ده؟')) return;
      await patchVisit(el.dataset.id, { status: 'cancelled' });
      toast('اتلغى');
    },
    async reopen(el) {
      const v = S.vmap.get(el.dataset.id);
      await patchVisit(v.id, { status: 'scheduled', at: new Date(Date.now() + 36e5).toISOString() });
      toast('رجع ميعاد. عدّل وقته من تعديل');
    },
    async delv(el) {
      const v = S.vmap.get(el.dataset.id);
      if (!confirm('حذف نهائي للزيارة دي؟')) return;
      await api.deleteVisit(v.id);
      if (v.photos && v.photos.length) api.removePhotos(v.photos).catch(() => { });
      S.visits = S.visits.filter(x => x.id !== v.id); reindex();
      toast('اتحذفت');
      go('/client/' + v.client_id);
    },
    async closefault(el) {
      const r = await askSheet({ title: 'العطل اتحل', submit: 'تأكيد', fields: [{ name: 'resolution', label: 'عملنا إيه؟', type: 'textarea', required: true }] });
      if (!r) return;
      await patchVisit(el.dataset.id, { resolved: true, resolution: r.resolution, unresolved_reason: null, unresolved_note: null, follow_up_date: null });
      toast('اتقفل');
    },
    async quote(el) {
      const r = await askSheet({ title: 'إرسال الكوتيشن', submit: 'تسجيل', fields: [{ name: 'd', label: 'تاريخ الإرسال', type: 'date', value: dayKey(new Date()), required: true }] });
      if (!r) return;
      await patchVisit(el.dataset.id, { quote_sent: true, quote_sent_at: r.d });
      toast('اتسجل');
    },
    async decide(el) {
      const v = S.vmap.get(el.dataset.id);
      const r = await askSheet({
        title: 'قرار العميل', submit: 'حفظ',
        fields: [{ name: 'decision', label: 'القرار', type: 'select', value: v.decision, options: Object.keys(DECISIONS).map(k => [k, DECISIONS[k]]) },
          { name: 'reject', label: 'سبب الرفض (لو رفض)', type: 'textarea', value: v.reject_reason || '' }], focus: false
      });
      if (!r) return;
      await patchVisit(v.id, { decision: r.decision, reject_reason: r.decision === 'rejected' ? (r.reject || null) : null });
      toast('اتحفظ');
    },
    install(el) {
      const v = S.vmap.get(el.dataset.id);
      go('/form/appt?client=' + v.client_id + '&kind=install&parent=' + v.id);
    },
    async showpw(el) {
      const pw = await api.getDevicePassword(el.dataset.id);
      if (!pw) return toast('مفيش باسورد محفوظ');
      const cell = el.parentElement;
      cell.innerHTML = '<code class="ltr">' + esc(pw) + '</code>';
      setTimeout(() => { if (cell.isConnected) cell.innerHTML = '<button class="linkbtn" data-act="showpw" data-id="' + esc(el.dataset.id) + '">إظهار</button>'; }, 15000);
    },

    newclient() { go('/clientform/new'); },
    editclient(el) { go('/clientform/edit/' + el.dataset.id); },
    async saveclient(el) {
      if (!CF || CF.saving) return;
      let d;
      try { d = readClient(); } catch (e) { return toast(e.message, 'err'); }
      CF.saving = true; el.disabled = true; el.textContent = 'بيحفظ...';
      const wasEdit = !!CF.id;
      try {
        const r = await persistClient(d, wasEdit ? S.cmap.get(CF.id) : null);
        toast(wasEdit ? 'اتحفظ التعديل' : (r.reused ? 'العميل موجود بالفعل' : 'اتضاف العميل'));
        CF = null;
        go('/client/' + r.client.id);
      } catch (e) {
        if (CF) { CF.saving = false; el.disabled = false; el.textContent = wasEdit ? 'حفظ التعديلات' : 'حفظ العميل'; }
        fail(e);
      }
    },
    async delclient(el) {
      const c = S.cmap.get(el.dataset.id);
      const n = visitsOf(c.id).length;
      if (!confirm('هيتحذف «' + c.name + '» و ' + n + ' زيارة معاه نهائيًا. متأكد؟')) return;
      await api.deleteClient(c.id);
      S.clients = S.clients.filter(x => x.id !== c.id);
      S.visits = S.visits.filter(x => x.client_id !== c.id);
      reindex();
      toast('اتحذف العميل');
      go('/clients');
    },
    async geoclient(el) {
      const c = S.cmap.get(el.dataset.id);
      toast('بحدد موقعك...');
      const pos = await getPos();
      upsertClient(await api.saveClient({ id: c.id, lat: +pos.latitude.toFixed(6), lng: +pos.longitude.toFixed(6) }));
      toast('اتحدّث موقع العميل'); render();
    },
    async savesettings() {
      const s = {
        alert_quote_days: Math.max(1, parseInt($('#s_q').value, 10) || 3),
        alert_followup_days: Math.max(1, parseInt($('#s_f').value, 10) || 7),
        remind_before_min: Math.max(5, parseInt($('#s_r').value, 10) || 60),
        default_city: $('#s_c').value.trim() || 'الرياض',
        about_me: $('#s_about').value.trim() || DEFAULT_ABOUT
      };
      S.settings = Object.assign({}, S.settings, await api.saveSettings(s));
      toast('اتحفظت الإعدادات');
    },

    /* ---- الفورم ---- */
    pickKind(el) { F.kind = el.dataset.kind; syncForm(); },
    res(el) { F.resolved = el.dataset.v === 'yes'; syncForm(); },
    cswitch(el) { F.newClient = el.dataset.v === 'new'; F.clientId = null; syncForm(); },
    cpick(el) { F.clientId = el.dataset.id; F.newClient = false; syncForm(); },
    cclear() { F.clientId = null; syncForm(); const i = $('#cq2'); if (i) { i.value = ''; $('#cres').classList.add('hidden'); i.focus(); } },
    async geo(el) {
      el.disabled = true;
      try {
        const pos = await getPos();
        CF.geo = { lat: +pos.latitude.toFixed(6), lng: +pos.longitude.toFixed(6) };
        const ok = $('#geoOk'); ok.classList.remove('hidden');
        ok.textContent = 'تم تحديد موقعك (دقة حوالي ' + Math.round(pos.accuracy) + ' متر)';
      } finally { el.disabled = false; }
    },
    pwtoggle(el) { const i = $('#f_pw'); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.textContent = show ? 'إخفاء' : 'إظهار'; },
    rmold(el) { const i = +el.dataset.i; F.removed.push(F.existing[i]); F.existing.splice(i, 1); renderPhotos(); },
    rmnew(el) { F.newFiles.splice(+el.dataset.i, 1); renderPhotos(); },
    save: saveForm
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (el && ACT[el.dataset.act]) {
      e.preventDefault();
      Promise.resolve().then(() => ACT[el.dataset.act](el, e)).catch(fail);
      return;
    }
    const g = e.target.closest('[data-go]');
    if (g && !e.target.closest('a')) go(g.dataset.go);
  });

  /* =====================================================
     الهيكل والراوتر
     ===================================================== */
  function go(path) {
    const h = '#' + path;
    if (location.hash === h) render(); else location.hash = h;
  }
  function route() {
    const h = (location.hash || '#/home').slice(1);
    const i = h.indexOf('?');
    const path = i < 0 ? h : h.slice(0, i);
    return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(i < 0 ? '' : h.slice(i + 1)) };
  }
  function navHtml(name) {
    const tab = { home: 'home', appts: 'appts', clients: 'clients', client: 'clients', stats: 'stats', visit: 'appts', layla: 'layla', settings: 'settings' }[name];
    const on = t => tab === t ? ' class="on"' : '';
    const n = computeAlerts().length;
    return '<nav class="nav"><div class="side-brand"><img src="icons/logo.svg" alt=""><div><b>يعقوب</b><small>YAQOUB</small></div></div>' +
      '<a href="#/home"' + on('home') + '>' + icon('home') + '<span>الرئيسية</span>' + (n ? '<i class="badge">' + n + '</i>' : '') + '</a>' +
      '<a href="#/appts"' + on('appts') + '>' + icon('calendar') + '<span>المواعيد</span></a>' +
      '<a class="fab" href="#/add" aria-label="إضافة">' + icon('plus') + '<span>إضافة</span></a>' +
      '<a href="#/clients"' + on('clients') + '>' + icon('users') + '<span>العملاء</span></a>' +
      '<a href="#/stats"' + on('stats') + '>' + icon('chart') + '<span>إحصائيات</span></a>' +
      '<a class="dsk" href="#/layla"><img src="icons/layla.svg" alt=""><span>ليلة</span></a>' +
      '<a class="dsk" href="#/settings"' + on('settings') + '>' + icon('gear') + '<span>الإعدادات</span></a></nav>';
  }
  function shell(o, name) {
    const top = o.back
      ? '<header class="bar"><button class="ib" data-act="back" aria-label="رجوع">' + icon('back') + '</button><h1>' + esc(o.title) + '</h1><span class="grow"></span>' + (o.topRight || '') + '</header>'
      : '<header class="bar brand"><img src="icons/logo.svg" alt=""><div class="brand-wrap"><h1>' + (o.title && name !== 'home' ? esc(o.title) : 'يعقوب') + '</h1><a class="brand-credit" href="https://nader-dev1.github.io/portoflio/" target="_blank" rel="noopener">Developed by Nader Elsayed</a></div><span class="grow"></span>' +
      '<a class="ib layla-ib" href="#/layla" aria-label="ليلة"><img src="icons/layla.svg" alt=""></a><a class="ib" href="#/settings" aria-label="الإعدادات">' + icon('gear') + '</a></header>';
    return top + '<main class="' + (o.cls || '') + '">' + o.html + '</main>' + (o.nav === false ? '' : navHtml(name));
  }
  let lastHash = '';
  function render() {
    if (!S.user) return;
    const r = route(), name = r.parts[0] || 'home';
    if (name !== 'layla') stopVoice();
    if (name !== 'form') F = null;
    if (name !== 'form' && name !== 'clientform') CF = null;
    const view = V[name];
    if (!view) return go('/home');
    const out = view(r.parts.slice(1), r.q);
    appEl.innerHTML = shell(out, name);
    document.body.classList.toggle('has-nav', out.nav !== false);
    if (location.hash !== lastHash) { window.scrollTo(0, 0); lastHash = location.hash; }
    if (out.after) out.after();
  }

  /* =====================================================
     الدخول والتشغيل
     ===================================================== */
  function showSetup() {
    appEl.innerHTML = '<div class="setup"><h2>خطوة واحدة ناقصة</h2><p style="margin:10px 0">افتح الملف <code>js/config.js</code> وحط رابط مشروع Supabase والمفتاح العام (anon key)، وبعدين حدّث الصفحة.</p><p class="muted small">الخطوات كلها في ملف README.md</p></div>';
  }
  function showLogin(msg) {
    document.body.classList.remove('has-nav');
    appEl.innerHTML = '<div class="login"><form class="box" id="lf"><img src="icons/logo.svg" alt=""><h1>يعقوب</h1><p class="sm">YAQOUB</p>' +
      '<p class="tagline">نظام عمليات ميدانية لمهندس الشبكات والبنية التحتية</p>' +
      '<div class="field"><label for="le">البريد الإلكتروني</label><div class="inwrap">' + icon('mail') + '<input id="le" type="email" class="ltr" autocomplete="username" required></div></div>' +
      '<div class="field"><label for="lp">كلمة المرور</label><div class="inwrap">' + icon('lock') + '<input id="lp" type="password" class="ltr" autocomplete="current-password" required></div></div>' +
      '<p class="err" id="lerr">' + esc(msg || '') + '</p><button class="btn block-btn" id="lb">تسجيل الدخول</button></form></div>';
    $('#lf').addEventListener('submit', async e => {
      e.preventDefault();
      const b = $('#lb'); b.disabled = true; b.textContent = 'لحظة...';
      try {
        const sess = await api.signIn($('#le').value.trim(), $('#lp').value);
        await start(sess);
      } catch (err) {
        b.disabled = false; b.textContent = 'تسجيل الدخول';
        $('#lerr').textContent = /Invalid login/i.test(err.message || '') ? 'البريد أو كلمة المرور غلط' : (err.message || 'مقدرتش أدخل');
      }
    });
  }
  async function start(sess) {
    S.user = sess.user;
    S.chat = loadChat();
    appEl.innerHTML = '<div class="splash"><img src="icons/logo.svg" alt=""></div>';
    try {
      await loadData();
      const remoteChat = await api.loadChat().catch(() => null);
      if (Array.isArray(remoteChat)) S.chat = remoteChat;
    } catch (e) {
      console.error(e);
      appEl.innerHTML = '<div class="setup"><h2>مقدرتش أحمّل البيانات</h2><p style="margin:10px 0">اتأكد من النت، وإنك شغّلت ملف schema.sql في Supabase.</p><p class="muted small ltr">' + esc(e.message || '') + '</p><p style="margin-top:14px"><button class="btn" onclick="location.reload()">حاول تاني</button></p></div>';
      return;
    }
    if (!location.hash) location.hash = '#/home';
    render();
    syncPushQuietly();
  }

  async function boot() {
    window.addEventListener('hashchange', render);
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => { });
      // لما تدوس على إشعار والتطبيق مفتوح، نفتح الصفحة بتاعته
      navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.go) go(e.data.go); });
    }
    if (!api || !api.configured) return showSetup();
    api.onSignedOut(() => { S.user = null; showLogin(); });

    // العمل بدون نت: مؤشر + إعادة تحميل بعد الرفع
    if (api.bindLookup) {
      api.bindLookup({ clients: id => S.cmap.get(id), visits: id => S.vmap.get(id), contacts: id => S.contacts.find(k => k.id === id) });
      const nb = document.createElement('div'); nb.id = 'netbar'; nb.setAttribute('role', 'status'); document.body.appendChild(nb);
      const updateNet = () => {
        const n = api.pending(), off = !navigator.onLine;
        nb.className = off ? 'show off' : (n ? 'show' : '');
        nb.innerHTML = off ? '<span class="dot"></span>أوفلاين: اللي بتسجله بيتحفظ على موبايلك' + (n ? ' (' + n + ' مستني)' : '')
          : (n ? '<span class="dot"></span>بيرفع ' + n + ' عملية...' : '');
      };
      api.onQueue(updateNet);
      window.addEventListener('online', updateNet);
      window.addEventListener('offline', updateNet);
      api.onSynced(async r => {
        if (!S.user) return;
        if (r.done) toast('اترفعت ' + r.done + ' عملية');
        if (r.failed) toast(r.failed + ' عملية معرفتش أرفعها', 'err');
        try { await loadData(); if (route().parts[0] !== 'form') render(); } catch (e) { /* تجاهل */ }
      });
    }

    // تحديث هادي لما ترجع للتطبيق، وتحديث التنبيهات كل دقيقة
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState !== 'visible' || !S.user || Date.now() - S.loadedAt < 90000) return;
      try { await loadData(); if (route().parts[0] !== 'form') render(); } catch (e) { /* تجاهل */ }
    });
    setInterval(() => {
      const n = route().parts[0];
      if (S.user && (n === 'home' || n === 'appts') && !sheetEl.classList.contains('open')) render();
    }, 60000);

    const sess = await api.session();
    if (!sess) return showLogin();
    await start(sess);
  }

  boot();
})();
