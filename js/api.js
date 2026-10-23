/* طبقة البيانات: كل الكلام مع Supabase بيمر من هنا.
   لو اتغير الباكند بعدين، بنعدّل الملف ده بس. */
(function () {
  'use strict';

  const cfg = window.YAQOUB_CONFIG || {};
  const configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !/^PASTE/.test(cfg.SUPABASE_URL) && !/^PASTE/.test(cfg.SUPABASE_ANON_KEY));

  let sb = null;
  if (configured && window.supabase) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
  }

  const CLIENT_FIELDS = ['name', 'phone', 'city', 'lat', 'lng', 'map_url', 'note', 'client_type', 'contact_name', 'contact_role',
    'address', 'email', 'work_hours', 'access_notes', 'tax_no', 'source'];
  const VISIT_FIELDS = ['client_id', 'status', 'kind', 'category', 'at', 'arrived_at', 'finished_at',
    'description', 'notes', 'parent_visit_id', 'photos',
    'device_name', 'resolved', 'resolution', 'unresolved_reason', 'unresolved_note', 'follow_up_date',
    'insp_about', 'insp_needs', 'quote_sent', 'quote_sent_at', 'decision', 'reject_reason',
    'supply_items', 'supply_price', 'supply_mode', 'priority', 'met_with', 'problem', 'cause', 'details'];
  // ما بنجيبش device_password_enc للمتصفح أبدًا
  const VISIT_COLS = ['id', 'created_at', 'has_device_password'].concat(VISIT_FIELDS).join(',');
  const SETTINGS_FIELDS = ['alert_quote_days', 'alert_followup_days', 'remind_before_min', 'default_city', 'about_me'];
  const CONTACT_FIELDS = ['client_id', 'name', 'role', 'phone'];

  function must(res) {
    if (res.error) throw res.error;
    return res.data;
  }
  function pick(obj, keys) {
    const out = {};
    keys.forEach(k => { if (k in obj) out[k] = obj[k]; });
    return out;
  }

  // Supabase بيرجّع 1000 صف بس في الطلب، فبنجيب على دفعات
  async function fetchAll(table, cols, orderCol, asc) {
    let out = [];
    const step = 1000;
    for (let from = 0; ; from += step) {
      const rows = must(await sb.from(table).select(cols)
        .order(orderCol, { ascending: asc }).range(from, from + step - 1));
      out = out.concat(rows);
      if (rows.length < step) break;
    }
    return out;
  }

  const vapid = (cfg.VAPID_PUBLIC_KEY && !/^PASTE/.test(cfg.VAPID_PUBLIC_KEY)) ? cfg.VAPID_PUBLIC_KEY : '';

  window.api = {
    configured,
    vapidKey: vapid,

    // ---------- الدخول ----------
    async session() {
      const { data } = await sb.auth.getSession();
      return data.session;
    },
    onSignedOut(cb) {
      sb.auth.onAuthStateChange((event, session) => { if (!session) cb(event); });
    },
    async signIn(email, password) {
      return must(await sb.auth.signInWithPassword({ email, password })).session;
    },
    async signOut() {
      await sb.auth.signOut();
    },

    // ---------- تحميل كل البيانات ----------
    async loadAll() {
      const [clients, visits, contacts, settings] = await Promise.all([
        fetchAll('clients', '*', 'name', true),
        fetchAll('visits', VISIT_COLS, 'at', false),
        fetchAll('client_contacts', '*', 'created_at', true).catch(() => []), // لو لسه ما شغلتش schema_v2
        sb.from('settings').select('*').maybeSingle().then(must)
      ]);
      return { clients, visits, contacts, settings };
    },

    // ---------- العملاء ----------
    async saveClient(c) {
      const row = pick(c, CLIENT_FIELDS);
      if (c.id && !c.__new) return must(await sb.from('clients').update(row).eq('id', c.id).select().single());
      if (c.__new) row.id = c.id;
      return must(await sb.from('clients').insert(row).select().single());
    },
    async deleteClient(id) {
      must(await sb.from('clients').delete().eq('id', id));
    },

    // ---------- أرقام التواصل ----------
    async saveContact(c) {
      const row = pick(c, CONTACT_FIELDS);
      if (c.id && !c.__new) return must(await sb.from('client_contacts').update(row).eq('id', c.id).select().single());
      if (c.__new) row.id = c.id;
      return must(await sb.from('client_contacts').insert(row).select().single());
    },
    async deleteContact(id) {
      must(await sb.from('client_contacts').delete().eq('id', id));
    },

    // ---------- إشعارات الموبايل ----------
    async savePush(sub) {
      const j = sub.toJSON();
      must(await sb.from('push_subscriptions').upsert({
        endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 200)
      }, { onConflict: 'endpoint' }).select('id').single());
    },
    async removePush(endpoint) {
      must(await sb.from('push_subscriptions').delete().eq('endpoint', endpoint));
    },
    async testPush() {
      const { data, error } = await sb.functions.invoke('notify', { body: { test: true } });
      if (error) {
        let m = error.message;
        try {
          const j = await error.context.json();
          if (typeof j.error === 'string') m = j.error;
          else if (j.error && typeof j.error.message === 'string') m = j.error.message;
          else if (typeof j.message === 'string') m = j.message;
          if (j.code) m += ' (' + j.code + ')';
        } catch (e) { /* Network errors may not have a response body. */ }
        throw new Error(m);
      }
      return data;
    },

    // ---------- ليلة ----------
    async layla(messages, digest) {
      const { data, error } = await sb.functions.invoke('layla', { body: { messages, digest } });
      if (error) {
        let m = error.message;
        try {
          const j = await error.context.json();
          if (typeof j.error === 'string') m = j.error;
          else if (j.error && typeof j.error.message === 'string') m = j.error.message;
          else if (typeof j.message === 'string') m = j.message;
          if (j.code) m += ' (' + j.code + ')';
        } catch (e) { /* Network errors may not have a response body. */ }
        throw new Error(m);
      }
      return data;
    },
    async listMemory() {
      return must(await sb.from('layla_memory').select('id,fact,created_at').order('created_at', { ascending: false }).limit(100));
    },
    async deleteMemory(id) {
      must(await sb.from('layla_memory').delete().eq('id', id));
    },

    // ---------- الزيارات ----------
    async saveVisit(v) {
      const row = pick(v, VISIT_FIELDS);
      if (v.id && !v.__new) return must(await sb.from('visits').update(row).eq('id', v.id).select(VISIT_COLS).single());
      if (v.__new) row.id = v.id;
      return must(await sb.from('visits').insert(row).select(VISIT_COLS).single());
    },
    async deleteVisit(id) {
      must(await sb.from('visits').delete().eq('id', id));
    },

    // ---------- باسورد الجهاز (مشفر على السيرفر) ----------
    async setDevicePassword(visitId, pw) {
      must(await sb.rpc('set_device_password', { p_visit: visitId, p_pw: pw }));
    },
    async getDevicePassword(visitId) {
      return must(await sb.rpc('get_device_password', { p_visit: visitId }));
    },

    // ---------- الصور ----------
    async uploadPhotoTo(path, blob) {
      const res = await sb.storage.from('visit-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (res.error) throw res.error;
      return path;
    },
    async uploadPhoto(visitId, blob) {
      const { data } = await sb.auth.getUser();
      const path = data.user.id + '/' + visitId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.jpg';
      return this.uploadPhotoTo(path, blob);
    },
    async photoUrls(paths) {
      if (!paths || !paths.length) return {};
      const rows = must(await sb.storage.from('visit-photos').createSignedUrls(paths, 3600));
      const out = {};
      rows.forEach(r => { if (r.signedUrl) out[r.path] = r.signedUrl; });
      return out;
    },
    async removePhotos(paths) {
      if (!paths || !paths.length) return;
      await sb.storage.from('visit-photos').remove(paths);
    },

    // ---------- الإعدادات ----------
    async saveSettings(s) {
      return must(await sb.from('settings').upsert(pick(s, SETTINGS_FIELDS), { onConflict: 'owner' }).select().single());
    }
  };
})();
