/* العمل بدون إنترنت.
   لما النت يقطع: بنحفظ العملية على الموبايل (IndexedDB) ونعرضها في التطبيق فورًا،
   ولما النت يرجع بنرفعها بالترتيب لوحدها.
   - البيانات المحمّلة آخر مرة بتتخزن عشان التطبيق يفتح من غير نت.
   - ليلة وإظهار الباسورد والصور القديمة محتاجين نت. */
(function () {
  'use strict';
  const api = window.api;
  if (!api || !api.configured || !window.indexedDB) return;
  const real = Object.assign({}, api);

  /* ---------- IndexedDB صغيرة ---------- */
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open('yaqoub_offline', 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
        r.result.createObjectStore('kv');
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return db().then(d => new Promise((res, rej) => {
      const t = d.transaction(store, mode);
      let out;
      const rq = fn(t.objectStore(store));
      if (rq) rq.onsuccess = () => { out = rq.result; };
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    }));
  }
  const kvGet = k => tx('kv', 'readonly', s => s.get(k));
  const kvSet = (k, v) => tx('kv', 'readwrite', s => s.put(v, k));
  const qAll = () => tx('queue', 'readonly', s => s.getAll());
  const qAdd = op => tx('queue', 'readwrite', s => s.add(op));
  const qDel = id => tx('queue', 'readwrite', s => s.delete(id));

  const isNet = e => !navigator.onLine || /Failed to fetch|NetworkError|Load failed|network request|fetch failed/i.test(String((e && e.message) || e));
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

  let pending = 0, flushing = false, lookup = {};
  const qListeners = [], syncListeners = [];
  const emit = () => qListeners.forEach(f => { try { f(pending); } catch (e) { /* تجاهل */ } });
  async function refreshPending() { try { pending = (await qAll()).length; } catch (e) { pending = 0; } emit(); }

  /* ---------- تطبيق العمليات على نسخة البيانات المحفوظة ---------- */
  function applyOp(d, op, result) {
    const up = (arr, row) => { const i = arr.findIndex(x => x.id === row.id); if (i >= 0) arr[i] = Object.assign({}, arr[i], row); else arr.push(row); };
    const clean = r => { const o = Object.assign({}, r); delete o.__new; return o; };
    if (op.t === 'saveClient') up(d.clients, result || clean(Object.assign({ created_at: new Date().toISOString() }, op.c)));
    else if (op.t === 'saveVisit') up(d.visits, result || clean(Object.assign({ photos: [], has_device_password: false, quote_sent: false, decision: 'pending', priority: 'normal', details: {}, created_at: new Date().toISOString() }, op.v)));
    else if (op.t === 'saveContact') up(d.contacts, result || clean(Object.assign({ created_at: new Date().toISOString() }, op.k)));
    else if (op.t === 'deleteVisit') d.visits = d.visits.filter(x => x.id !== op.id);
    else if (op.t === 'deleteContact') d.contacts = d.contacts.filter(x => x.id !== op.id);
    else if (op.t === 'deleteClient') {
      d.clients = d.clients.filter(x => x.id !== op.id);
      d.visits = d.visits.filter(x => x.client_id !== op.id);
      d.contacts = d.contacts.filter(x => x.client_id !== op.id);
    } else if (op.t === 'setpw') {
      const v = d.visits.find(x => x.id === op.id); if (v) v.has_device_password = !!op.pw;
    }
    return d;
  }
  async function patchCache(op, result) {
    try {
      const c = await kvGet('cache');
      if (c) await kvSet('cache', applyOp(c, op, result));
    } catch (e) { /* تجاهل */ }
  }

  /* ---------- تنفيذ أو تخزين ---------- */
  async function tryOrQueue(call, op, optimistic) {
    if (pending === 0 && navigator.onLine) {
      try {
        const r = await call();
        patchCache(op, r);
        return r;
      } catch (e) { if (!isNet(e)) throw e; }
    }
    await qAdd(op);
    await refreshPending();
    patchCache(op, null);
    flush();
    return optimistic();
  }
  const merged = (kind, row, defaults) => {
    const base = row.__new ? defaults : (lookup[kind] && lookup[kind](row.id)) || {};
    const out = Object.assign({}, base, row);
    delete out.__new;
    return out;
  };

  api.saveClient = c => {
    const row = c.id ? c : Object.assign({}, c, { id: uuid(), __new: true });
    return tryOrQueue(() => real.saveClient(row), { t: 'saveClient', c: row },
      () => merged('clients', row, { created_at: new Date().toISOString() }));
  };
  api.saveVisit = v => {
    const row = v.id ? v : Object.assign({}, v, { id: uuid(), __new: true });
    return tryOrQueue(() => real.saveVisit(row), { t: 'saveVisit', v: row },
      () => merged('visits', row, { photos: [], has_device_password: false, quote_sent: false, decision: 'pending', priority: 'normal', details: {}, created_at: new Date().toISOString() }));
  };
  api.saveContact = k => {
    const row = k.id ? k : Object.assign({}, k, { id: uuid(), __new: true });
    return tryOrQueue(() => real.saveContact(row), { t: 'saveContact', k: row },
      () => merged('contacts', row, { created_at: new Date().toISOString() }));
  };
  api.deleteClient = id => tryOrQueue(() => real.deleteClient(id), { t: 'deleteClient', id }, () => undefined);
  api.deleteVisit = id => tryOrQueue(() => real.deleteVisit(id), { t: 'deleteVisit', id }, () => undefined);
  api.deleteContact = id => tryOrQueue(() => real.deleteContact(id), { t: 'deleteContact', id }, () => undefined);
  api.setDevicePassword = (id, pw) => tryOrQueue(() => real.setDevicePassword(id, pw), { t: 'setpw', id, pw }, () => undefined);

  async function getUid() {
    try {
      const s = await real.session();
      if (s && s.user) { kvSet('uid', s.user.id); return s.user.id; }
    } catch (e) { /* تجاهل */ }
    return kvGet('uid');
  }
  api.uploadPhoto = async (visitId, blob) => {
    const uid = await getUid();
    if (!uid) throw new Error('سجّل دخول بنت الأول');
    const path = uid + '/' + visitId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.jpg';
    await tryOrQueue(() => real.uploadPhotoTo(path, blob), { t: 'photo', path, blob }, () => path);
    return path;
  };
  api.photoUrls = async paths => { try { return await real.photoUrls(paths); } catch (e) { return {}; } };

  /* ---------- الجلسة والتحميل ---------- */
  api.session = async () => {
    try {
      const s = await real.session();
      if (s) { kvSet('sessUser', s.user); kvSet('uid', s.user.id); return s; }
      if (navigator.onLine) return null;
    } catch (e) { if (navigator.onLine && !isNet(e)) throw e; }
    const u = await kvGet('sessUser');
    return u ? { user: u } : null;
  };
  api.signIn = async (email, password) => {
    const s = await real.signIn(email, password);
    if (s && s.user) { kvSet('sessUser', s.user); kvSet('uid', s.user.id); }
    return s;
  };
  api.signOut = async () => { await real.signOut(); await kvSet('sessUser', null); await kvSet('cache', null); };

  api.loadAll = async () => {
    if (pending > 0 && navigator.onLine) await flush();
    try {
      const d = await real.loadAll();
      d.contacts = d.contacts || [];
      await kvSet('cache', d);
      return d;
    } catch (e) {
      if (isNet(e)) {
        const c = await kvGet('cache');
        if (c) return c; // الكاش اتعدّل بالعمليات المستنية
      }
      throw e;
    }
  };

  /* ---------- رفع المستني ---------- */
  async function runOp(op) {
    switch (op.t) {
      case 'saveClient': return real.saveClient(op.c);
      case 'saveVisit': return real.saveVisit(op.v);
      case 'saveContact': return real.saveContact(op.k);
      case 'deleteClient': return real.deleteClient(op.id);
      case 'deleteVisit': return real.deleteVisit(op.id);
      case 'deleteContact': return real.deleteContact(op.id);
      case 'setpw': return real.setDevicePassword(op.id, op.pw);
      case 'photo': return real.uploadPhotoTo(op.path, op.blob);
    }
  }
  async function flush() {
    if (flushing || !navigator.onLine) return;
    flushing = true;
    let done = 0, failed = 0;
    try {
      const ops = await qAll();
      for (const op of ops) {
        try {
          await runOp(op);
          await qDel(op.id); done++;
        } catch (e) {
          if (isNet(e)) break;
          if (e && (e.code === '23505' || /duplicate key/i.test(e.message || ''))) { await qDel(op.id); done++; continue; } // اتنفذت قبل كده
          console.error('offline op failed', op.t, e);
          await qDel(op.id); failed++;
        }
      }
    } finally {
      flushing = false;
      await refreshPending();
      if (done || failed) syncListeners.forEach(f => { try { f({ done, failed }); } catch (e) { /* تجاهل */ } });
    }
  }

  api.bindLookup = o => { lookup = o || {}; };
  api.onQueue = cb => { qListeners.push(cb); cb(pending); };
  api.onSynced = cb => { syncListeners.push(cb); };
  api.pending = () => pending;
  api.flush = flush;

  window.addEventListener('online', () => { flush(); emit(); });
  window.addEventListener('offline', emit);
  setInterval(() => { if (pending > 0) flush(); }, 30000);
  refreshPending().then(() => { if (pending > 0) flush(); });
})();
