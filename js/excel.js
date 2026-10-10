/* تقرير Excel كامل: داشبورد ملخص + شيتات تفصيلية.
   بيتبني بمكتبة ExcelJS (بتتحمل وقت الضغط على زرار التصدير بس). */
(function () {
  'use strict';

  const KINDS = { fault: 'عطل', inspection: 'معاينة', supply: 'توريد', install: 'تركيب', maintenance: 'صيانة دورية' };
  const PRIO = { normal: 'عادي', urgent: 'عاجل', emergency: 'طارئ' };
  const DETDEF = (window.YQ && window.YQ.DET) || {};
  // بنحوّل تفاصيل النوع لنص مقروء
  function detText(v) {
    const d = v.details || {};
    return (DETDEF[v.kind] || Object.keys(d).map(k => ({ k, label: k }))).map(f => {
      const x = d[f.k];
      if (x == null || x === '' || (Array.isArray(x) && !x.length)) return '';
      return f.label + ': ' + (Array.isArray(x) ? x.join('، ') : x);
    }).filter(Boolean).join('\n');
  }
  const REASONS = { client_refused: 'رفض العميل', no_solution: 'مالوش حل', engineer_failed: 'المهندس لم يتوصل لحل', other: 'سبب آخر' };
  const DECISIONS = { pending: 'في الانتظار', approved: 'تم التعميد', rejected: 'رفض' };
  const SUPPLY = { supply_only: 'توريد فقط', supply_maintenance: 'توريد وصيانة' };
  const STATUS = { scheduled: 'مجدول', done: 'تمت', cancelled: 'ملغي' };

  const NAVY = 'FF0B1F5C', BLUE = 'FF0B4DB9', ORANGE = 'FFFF6600', PAPER = 'FFF5F7FA', LINE = 'FFDFE4EE',
    INK = 'FF1E2A44', MUTED = 'FF66708C', WHITE = 'FFFFFFFF', RED = 'FFD93A26', GREEN = 'FF12906A', ORANGE_SOFT = 'FFFFEBDD';
  const FONT = 'Arial';

  const LOC = 'ar-SA-u-ca-gregory-nu-latn';
  const dfWeekday = new Intl.DateTimeFormat(LOC, { weekday: 'long' });
  const dfDate = new Intl.DateTimeFormat(LOC, { day: 'numeric', month: 'long', year: 'numeric' });

  // Excel بيخزّن التاريخ UTC، فبنزحزحه عشان يظهر بتوقيتك المحلي
  const xl = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  const pad = n => String(n).padStart(2, '0');
  const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const weekStart = d => { const x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 1) % 7)); return x; };
  const solid = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
  const thin = argb => ({ style: 'thin', color: { argb } });
  const box = argb => ({ top: thin(argb), bottom: thin(argb), left: thin(argb), right: thin(argb) });

  function countBy(arr, fn, labels) {
    const m = {};
    arr.forEach(x => { const k = fn(x); if (k) m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).map(k => ({ label: labels ? (labels[k] || k) : k, n: m[k] })).sort((a, b) => b.n - a.n);
  }
  const pct = (a, b) => b ? a / b : 0;

  /* ---------- شيت بيانات عام ---------- */
  function dataSheet(wb, name, cols, rows, o) {
    o = o || {};
    const ws = wb.addWorksheet(name, {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
      properties: { tabColor: { argb: o.tab || BLUE } }
    });
    ws.columns = cols.map(c => ({ width: c.w || 14 }));
    const h = ws.addRow(cols.map(c => c.h));
    h.height = 26;
    h.eachCell(cell => {
      cell.fill = solid(NAVY);
      cell.font = { name: FONT, bold: true, color: { argb: WHITE }, size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = box(NAVY);
    });
    if (!rows.length) {
      const r = ws.addRow(['مفيش بيانات في الفترة دي']);
      r.getCell(1).font = { name: FONT, color: { argb: MUTED } };
      return ws;
    }
    rows.forEach((r, i) => {
      const row = ws.addRow(r);
      cols.forEach((c, j) => {
        const cell = row.getCell(j + 1);
        if (c.fmt) cell.numFmt = c.fmt;
        cell.font = { name: FONT, size: 11, color: { argb: INK } };
        cell.alignment = { vertical: 'top', wrapText: !!c.wrap, horizontal: c.center ? 'center' : undefined };
        cell.border = box(LINE);
        if (i % 2 === 1) cell.fill = solid(PAPER);
      });
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
    return ws;
  }

  function addTotalRow(ws, label, colIdx, fromRow, toRow, total, fmt, ncols) {
    const r = ws.addRow([]);
    const letter = String.fromCharCode(64 + colIdx);
    r.getCell(1).value = label;
    r.getCell(colIdx).value = { formula: 'SUM(' + letter + fromRow + ':' + letter + toRow + ')', result: total };
    if (fmt) r.getCell(colIdx).numFmt = fmt;
    for (let c = 1; c <= ncols; c++) {
      const cell = r.getCell(c);
      cell.fill = solid(ORANGE_SOFT);
      cell.font = { name: FONT, bold: true, color: { argb: NAVY }, size: 11 };
      cell.border = box(ORANGE);
    }
  }

  /* ---------- صف زيارة موحّد ---------- */
  function visitRow(v, cmap) {
    const c = cmap.get(v.client_id) || {};
    const at = new Date(v.at);
    let details = '', outcome = '', done = '';
    if (v.kind === 'fault') {
      details = v.description || '';
      outcome = v.status !== 'done' ? '' : v.resolved ? 'اتحل' : 'متحلش';
      done = v.resolved ? (v.resolution || '') : ((REASONS[v.unresolved_reason] || '') + (v.unresolved_note ? ': ' + v.unresolved_note : ''));
    } else if (v.kind === 'inspection') {
      details = [v.insp_about, v.insp_needs ? 'المطلوب: ' + v.insp_needs : ''].filter(Boolean).join('\n');
    } else if (v.kind === 'supply') {
      details = v.supply_items || '';
    } else details = v.description || '';
    const arr = v.arrived_at ? new Date(v.arrived_at) : null, fin = v.finished_at ? new Date(v.finished_at) : null;
    const mins = arr && fin && fin >= arr ? Math.round((fin - arr) / 60000) : null;
    return [
      xl(at), dfWeekday.format(at), xl(at), c.name || '', c.city || '',
      KINDS[v.kind] || v.kind, v.category || '', STATUS[v.status] || v.status,
      PRIO[v.priority] || '', v.problem || '', v.cause || '', v.met_with || '',
      details, v.device_name || '', outcome, done,
      v.kind === 'inspection' ? (v.quote_sent ? 'اتبعت' + (v.quote_sent_at ? ' ' + v.quote_sent_at : '') : 'لسه') : '',
      v.kind === 'inspection' ? DECISIONS[v.decision] + (v.reject_reason ? ': ' + v.reject_reason : '') : '',
      v.supply_price != null ? Number(v.supply_price) : null, v.kind === 'supply' ? (SUPPLY[v.supply_mode] || '') : '',
      arr ? xl(arr) : null, fin ? xl(fin) : null, mins,
      v.follow_up_date || '', detText(v), v.notes || ''
    ];
  }
  const VISIT_COLS = [
    { h: 'التاريخ', w: 13, fmt: 'yyyy-mm-dd', center: true }, { h: 'اليوم', w: 11, center: true }, { h: 'الوقت', w: 9, fmt: 'hh:mm', center: true },
    { h: 'العميل', w: 24 }, { h: 'المدينة', w: 12 }, { h: 'النوع', w: 10, center: true }, { h: 'التصنيف', w: 13 }, { h: 'الحالة', w: 10, center: true },
    { h: 'الأولوية', w: 9, center: true }, { h: 'المشكلة', w: 26, wrap: true }, { h: 'السبب', w: 24, wrap: true }, { h: 'قابلت', w: 14 },
    { h: 'التفاصيل', w: 38, wrap: true }, { h: 'الجهاز', w: 15 }, { h: 'النتيجة', w: 11, center: true }, { h: 'اللي اتعمل / السبب', w: 34, wrap: true },
    { h: 'الكوتيشن', w: 15 }, { h: 'قرار العميل', w: 22, wrap: true }, { h: 'قيمة التوريد (ر.س)', w: 14, fmt: '#,##0.00' }, { h: 'نوع التوريد', w: 13 },
    { h: 'وصل', w: 8, fmt: 'hh:mm', center: true }, { h: 'انتهى', w: 8, fmt: 'hh:mm', center: true }, { h: 'المدة (دقيقة)', w: 10, center: true },
    { h: 'متابعة', w: 12, center: true }, { h: 'تفاصيل إضافية', w: 34, wrap: true }, { h: 'ملاحظات', w: 30, wrap: true }
  ];

  /* ---------- الداشبورد (الملخص) ---------- */
  function summarySheet(wb, d, S) {
    const ws = wb.addWorksheet('الملخص', {
      views: [{ rightToLeft: true, showGridLines: false }],
      properties: { tabColor: { argb: ORANGE } }
    });
    ws.columns = Array.from({ length: 8 }, () => ({ width: 17 }));

    // العنوان
    ws.mergeCells('A1:H1');
    const t = ws.getCell('A1');
    t.value = 'يعقوب  |  تقرير الأداء';
    t.font = { name: FONT, size: 22, bold: true, color: { argb: WHITE } };
    t.fill = solid(NAVY);
    t.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 46;
    ws.mergeCells('A2:H2');
    const sub = ws.getCell('A2');
    sub.value = 'الفترة: من ' + dfDate.format(d.range.from) + ' إلى ' + dfDate.format(d.range.to) + '      |      تاريخ التقرير: ' + dfDate.format(d.now);
    sub.font = { name: FONT, size: 11, color: { argb: WHITE } };
    sub.fill = solid(BLUE);
    sub.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 24;
    ws.getRow(3).height = 10;

    let row = 4;
    const sectionTitle = text => {
      ws.mergeCells(row, 1, row, 8);
      const c = ws.getCell(row, 1);
      c.value = text;
      c.font = { name: FONT, size: 14, bold: true, color: { argb: NAVY } };
      c.alignment = { horizontal: 'right', vertical: 'middle' };
      for (let i = 1; i <= 8; i++) ws.getCell(row, i).border = { bottom: { style: 'medium', color: { argb: ORANGE } } };
      ws.getRow(row).height = 26;
      row++;
    };
    const card = (r, colIdx, label, value, fmt, color) => {
      const c1 = colIdx * 2 + 1;
      ws.mergeCells(r, c1, r, c1 + 1);
      ws.mergeCells(r + 1, c1, r + 1, c1 + 1);
      const l = ws.getCell(r, c1), v = ws.getCell(r + 1, c1);
      l.value = label;
      l.font = { name: FONT, size: 10, color: { argb: MUTED } };
      l.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      v.value = value;
      if (fmt) v.numFmt = fmt;
      v.font = { name: FONT, size: 22, bold: true, color: { argb: color || NAVY } };
      v.alignment = { horizontal: 'center', vertical: 'middle' };
      [c1, c1 + 1].forEach(ci => {
        ws.getCell(r, ci).fill = solid(PAPER); ws.getCell(r + 1, ci).fill = solid(PAPER);
        ws.getCell(r, ci).border = { top: { style: 'medium', color: { argb: ORANGE } }, left: thin(LINE), right: thin(LINE) };
        ws.getCell(r + 1, ci).border = { bottom: thin(LINE), left: thin(LINE), right: thin(LINE) };
      });
    };
    const cardRow = list => {
      list.forEach((c, i) => card(row, i, c[0], c[1], c[2], c[3]));
      ws.getRow(row).height = 24; ws.getRow(row + 1).height = 38;
      row += 3;
    };

    const done = S.done;
    const faults = done.filter(v => v.kind === 'fault');
    const insp = done.filter(v => v.kind === 'inspection');
    const supply = done.filter(v => v.kind === 'supply');
    const install = done.filter(v => v.kind === 'install');
    const resolved = faults.filter(v => v.resolved === true).length;
    const approved = insp.filter(v => v.decision === 'approved').length;
    const rejected = insp.filter(v => v.decision === 'rejected').length;
    const sent = insp.filter(v => v.quote_sent).length;
    const supplyTotal = supply.reduce((a, v) => a + (v.supply_price ? Number(v.supply_price) : 0), 0);
    const uniqueClients = new Set(done.map(v => v.client_id)).size;
    const newClients = d.clients.filter(c => c.created_at && new Date(c.created_at) >= d.range.from && new Date(c.created_at) <= d.range.to).length;

    sectionTitle('نظرة عامة');
    cardRow([['إجمالي الزيارات التي تمت', done.length], ['أعطال', faults.length, null, RED], ['معاينات', insp.length, null, BLUE], ['توريد', supply.length, null, GREEN]]);
    cardRow([['تركيب', install.length], ['نسبة حل الأعطال', pct(resolved, faults.length), '0%', GREEN], ['نسبة التعميد', pct(approved, insp.length), '0%', ORANGE], ['قيمة التوريد (ر.س)', supplyTotal, '#,##0', GREEN]]);
    cardRow([['عملاء تمت زيارتهم', uniqueClients], ['عملاء جدد في الفترة', newClients], ['مواعيد قادمة الآن', S.upcoming, null, BLUE], ['مواعيد فايتة الآن', S.late, null, S.late ? RED : NAVY]]);

    // جدول بأعمدة شريط
    const barTable = (title, items, total, labelHead) => {
      sectionTitle(title);
      const heads = [[1, 2, labelHead || 'البند'], [3, 3, 'العدد'], [4, 4, 'النسبة'], [5, 8, 'الرسم']];
      heads.forEach(h => {
        if (h[1] > h[0]) ws.mergeCells(row, h[0], row, h[1]);
        const c = ws.getCell(row, h[0]);
        c.value = h[2];
        for (let i = h[0]; i <= h[1]; i++) { ws.getCell(row, i).fill = solid(NAVY); ws.getCell(row, i).border = box(NAVY); }
        c.font = { name: FONT, bold: true, color: { argb: WHITE } };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      row++;
      if (!items.length) {
        ws.mergeCells(row, 1, row, 8);
        ws.getCell(row, 1).value = 'مفيش بيانات في الفترة دي';
        ws.getCell(row, 1).font = { name: FONT, color: { argb: MUTED } };
        row += 2; return;
      }
      const max = Math.max.apply(null, items.map(i => i.n).concat([1]));
      items.forEach((it, idx) => {
        ws.mergeCells(row, 1, row, 2); ws.mergeCells(row, 5, row, 8);
        const a = ws.getCell(row, 1), n = ws.getCell(row, 3), p = ws.getCell(row, 4), b = ws.getCell(row, 5);
        a.value = it.label; n.value = it.n; p.value = pct(it.n, total || max); p.numFmt = '0%';
        b.value = '█'.repeat(Math.max(1, Math.round(it.n / max * 30)));
        a.font = { name: FONT, color: { argb: INK } }; a.alignment = { horizontal: 'right', wrapText: true };
        n.font = { name: FONT, bold: true, color: { argb: NAVY } }; n.alignment = { horizontal: 'center' };
        p.font = { name: FONT, color: { argb: MUTED } }; p.alignment = { horizontal: 'center' };
        b.font = { name: FONT, color: { argb: ORANGE }, size: 10 }; b.alignment = { horizontal: 'right' };
        for (let i = 1; i <= 8; i++) {
          const c = ws.getCell(row, i);
          c.border = { bottom: thin(LINE) };
          if (idx % 2 === 1) c.fill = solid(PAPER);
        }
        row++;
      });
      row++;
    };

    barTable('الزيارات حسب النوع', countBy(done, v => v.kind, KINDS), done.length, 'النوع');
    barTable('الزيارات حسب التصنيف', countBy(done, v => v.category), done.length, 'التصنيف');
    barTable('الأعطال: اتحل ' + resolved + ' من ' + faults.length + '، وأسباب اللي متحلش',
      countBy(faults.filter(v => v.resolved === false), v => v.unresolved_reason || 'other', REASONS), faults.length - resolved, 'السبب');
    barTable('أكتر المشاكل تكرارًا', countBy(faults, v => v.problem).slice(0, 10), faults.length, 'المشكلة');
    barTable('أكتر الأسباب (جذر المشكلة)', countBy(faults, v => v.cause).slice(0, 10), faults.length, 'السبب');
    barTable('المعاينات والكوتيشن (من ' + insp.length + ' معاينة)', [
      { label: 'اتبعتلها كوتيشن', n: sent }, { label: 'تم التعميد', n: approved }, { label: 'رفض', n: rejected },
      { label: 'في الانتظار', n: insp.filter(v => v.decision === 'pending').length }, { label: 'من غير كوتيشن', n: insp.filter(v => !v.quote_sent).length }
    ].filter(x => x.n > 0), insp.length, 'المرحلة');
    barTable('التوريد (إجمالي القيمة ' + supplyTotal.toLocaleString('en-US') + ' ر.س)', countBy(supply, v => v.supply_mode || 'supply_only', SUPPLY), supply.length, 'النوع');
    barTable('أكتر العملاء زيارات', countBy(done, v => (d.cmap.get(v.client_id) || {}).name).slice(0, 10), done.length, 'العميل');
    barTable('الزيارات حسب المدينة', countBy(done, v => (d.cmap.get(v.client_id) || {}).city).slice(0, 10), done.length, 'المدينة');

    // اتجاه أسبوعي
    const weeks = {};
    done.forEach(v => { const k = dayKey(weekStart(new Date(v.at))); weeks[k] = (weeks[k] || 0) + 1; });
    barTable('الزيارات حسب الأسبوع (يبدأ السبت)', Object.keys(weeks).sort().map(k => ({ label: 'أسبوع ' + k, n: weeks[k] })), done.length, 'الأسبوع');

    ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    return ws;
  }

  /* ---------- شيتات العملاء وأرقام التواصل ---------- */
  function addClientSheets(wb, d, inRange) {
    // العملاء
    const doneAll = d.visits.filter(v => v.status === 'done');
    const ctBy = new Map();
    d.contacts.forEach(k => { if (!ctBy.has(k.client_id)) ctBy.set(k.client_id, []); ctBy.get(k.client_id).push(k); });
    const mapUrl = c => c.lat != null && c.lng != null ? 'https://www.google.com/maps?q=' + c.lat + ',' + c.lng : (/^https?:/i.test(c.map_url || '') ? c.map_url : '');
    const clientRows = d.clients.map(c => {
      const mine = doneAll.filter(v => v.client_id === c.id).sort((a, b) => new Date(b.at) - new Date(a.at));
      const inR = mine.filter(inRange).length;
      const openF = mine.filter(v => v.kind === 'fault' && v.resolved === false).length;
      const extra = (ctBy.get(c.id) || []).map(k => k.name + (k.role ? ' (' + k.role + ')' : '') + ': +' + k.phone).join('\n');
      return [c.name, c.client_type || '', c.city || '', c.address || '', c.phone ? '+' + c.phone : '', c.contact_name ? c.contact_name + (c.contact_role ? ' (' + c.contact_role + ')' : '') : '', extra,
        c.email || '', c.work_hours || '', c.access_notes || '', mine.length, inR, mine[0] ? xl(new Date(mine[0].at)) : null, openF,
        c.phone ? { text: 'واتساب', hyperlink: 'https://wa.me/' + c.phone } : '', mapUrl(c) ? { text: 'الموقع', hyperlink: mapUrl(c) } : '', c.source || '', c.note || ''];
    });
    const cws = dataSheet(wb, 'العملاء', [
      { h: 'العميل', w: 26 }, { h: 'النوع', w: 14 }, { h: 'المدينة', w: 13 }, { h: 'الحي / العنوان', w: 20 }, { h: 'الرقم الأساسي', w: 17 }, { h: 'صاحب الرقم الأساسي', w: 20 },
      { h: 'أرقام إضافية', w: 36, wrap: true }, { h: 'البريد', w: 22 }, { h: 'ساعات الدوام', w: 20 }, { h: 'تعليمات الدخول', w: 26, wrap: true },
      { h: 'كل الزيارات', w: 11, center: true }, { h: 'زيارات الفترة', w: 11, center: true }, { h: 'آخر زيارة', w: 13, fmt: 'yyyy-mm-dd', center: true },
      { h: 'أعطال مفتوحة', w: 11, center: true }, { h: 'واتساب', w: 10, center: true }, { h: 'الموقع', w: 10, center: true }, { h: 'المصدر', w: 16 }, { h: 'ملاحظة', w: 34, wrap: true }
    ], clientRows, { tab: GREEN });
    for (let i = 2; i <= clientRows.length + 1; i++) {
      [15, 16].forEach(ci => { const cell = cws.getCell(i, ci); if (cell.value) cell.font = { name: FONT, color: { argb: BLUE }, underline: true }; });
    }

    // أرقام التواصل
    const phoneRows = [];
    d.clients.forEach(c => {
      if (c.phone) phoneRows.push([c.name, c.contact_name || c.name, c.contact_role ? 'الأساسي، ' + c.contact_role : 'الرقم الأساسي', '+' + c.phone, { text: 'واتساب', hyperlink: 'https://wa.me/' + c.phone }]);
      (ctBy.get(c.id) || []).forEach(k => phoneRows.push([c.name, k.name, k.role || '', '+' + k.phone, { text: 'واتساب', hyperlink: 'https://wa.me/' + k.phone }]));
    });
    const pws = dataSheet(wb, 'أرقام التواصل', [
      { h: 'العميل', w: 28 }, { h: 'الاسم', w: 24 }, { h: 'المسمى', w: 18 }, { h: 'الرقم', w: 18 }, { h: 'واتساب', w: 11, center: true }
    ], phoneRows, { tab: GREEN });
    for (let i = 2; i <= phoneRows.length + 1; i++) {
      const cell = pws.getCell(i, 5); if (cell.value) cell.font = { name: FONT, color: { argb: BLUE }, underline: true };
    }
  }

  /* ---------- البناء الكامل ---------- */
  function build(ExcelJS, d) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'يعقوب';
    wb.created = d.now;
    wb.title = 'تقرير يعقوب';

    d.cmap = new Map(d.clients.map(c => [c.id, c]));
    const inRange = v => { const t = new Date(v.at); return t >= d.range.from && t <= d.range.to; };
    const done = d.visits.filter(v => v.status === 'done' && inRange(v)).sort((a, b) => new Date(a.at) - new Date(b.at));
    const sched = d.visits.filter(v => v.status === 'scheduled');
    const S = {
      done,
      upcoming: sched.filter(v => new Date(v.at) >= d.now).length,
      late: sched.filter(v => new Date(v.at) < d.now).length
    };

    summarySheet(wb, d, S);

    // كل الزيارات
    dataSheet(wb, 'كل الزيارات', VISIT_COLS, done.map(v => visitRow(v, d.cmap)), { tab: BLUE });

    // الأعطال
    const faults = done.filter(v => v.kind === 'fault');
    dataSheet(wb, 'الأعطال', [
      { h: 'التاريخ', w: 13, fmt: 'yyyy-mm-dd', center: true }, { h: 'العميل', w: 24 }, { h: 'المدينة', w: 12 }, { h: 'التصنيف', w: 13 },
      { h: 'الأولوية', w: 9, center: true }, { h: 'المشكلة', w: 28, wrap: true }, { h: 'السبب', w: 26, wrap: true },
      { h: 'وصف العطل', w: 36, wrap: true }, { h: 'الجهاز', w: 15 }, { h: 'الحالة', w: 11, center: true },
      { h: 'اللي اتعمل', w: 34, wrap: true }, { h: 'سبب عدم الحل', w: 24, wrap: true }, { h: 'متابعة', w: 12, center: true }, { h: 'ملاحظات', w: 28, wrap: true }
    ], faults.map(v => {
      const c = d.cmap.get(v.client_id) || {};
      return [xl(new Date(v.at)), c.name || '', c.city || '', v.category || '', PRIO[v.priority] || '', v.problem || '', v.cause || '', v.description || '', v.device_name || '',
        v.resolved ? 'اتحل' : 'مفتوح', v.resolved ? (v.resolution || '') : '',
        v.resolved ? '' : (REASONS[v.unresolved_reason] || '') + (v.unresolved_note ? ': ' + v.unresolved_note : ''), v.follow_up_date || '', v.notes || ''];
    }), { tab: RED });

    // المعاينات
    const insp = done.filter(v => v.kind === 'inspection');
    dataSheet(wb, 'المعاينات', [
      { h: 'تاريخ المعاينة', w: 13, fmt: 'yyyy-mm-dd', center: true }, { h: 'العميل', w: 24 }, { h: 'المدينة', w: 12 }, { h: 'التصنيف', w: 13 },
      { h: 'المعاينة عن', w: 30, wrap: true }, { h: 'المطلوب', w: 30, wrap: true }, { h: 'الكوتيشن', w: 12, center: true },
      { h: 'تاريخ الإرسال', w: 13, center: true }, { h: 'قرار العميل', w: 14, center: true }, { h: 'سبب الرفض', w: 26, wrap: true }, { h: 'أيام منذ المعاينة', w: 12, center: true }
    ], insp.map(v => {
      const c = d.cmap.get(v.client_id) || {};
      return [xl(new Date(v.at)), c.name || '', c.city || '', v.category || '', v.insp_about || '', v.insp_needs || '',
        v.quote_sent ? 'اتبعت' : 'لسه', v.quote_sent_at || '', DECISIONS[v.decision], v.reject_reason || '',
        Math.floor((d.now - new Date(v.at)) / 864e5)];
    }), { tab: BLUE });

    // التوريد
    const supply = done.filter(v => v.kind === 'supply');
    const supplyCols = [
      { h: 'التاريخ', w: 13, fmt: 'yyyy-mm-dd', center: true }, { h: 'العميل', w: 24 }, { h: 'المدينة', w: 12 }, { h: 'التصنيف', w: 13 },
      { h: 'البنود', w: 44, wrap: true }, { h: 'النوع', w: 14, center: true }, { h: 'السعر (ر.س)', w: 14, fmt: '#,##0.00' }, { h: 'ملاحظات', w: 28, wrap: true }
    ];
    const sws = dataSheet(wb, 'التوريد', supplyCols, supply.map(v => {
      const c = d.cmap.get(v.client_id) || {};
      return [xl(new Date(v.at)), c.name || '', c.city || '', v.category || '', v.supply_items || '', SUPPLY[v.supply_mode] || '',
        v.supply_price != null ? Number(v.supply_price) : null, v.notes || ''];
    }), { tab: GREEN });
    if (supply.length) addTotalRow(sws, 'الإجمالي', 7, 2, supply.length + 1,
      supply.reduce((a, v) => a + (v.supply_price ? Number(v.supply_price) : 0), 0), '#,##0.00', supplyCols.length);

    // المواعيد (قادمة وفايتة وملغية في الفترة)
    const appts = d.visits.filter(v => v.status === 'scheduled' || (v.status === 'cancelled' && inRange(v)))
      .sort((a, b) => new Date(a.at) - new Date(b.at));
    dataSheet(wb, 'المواعيد', [
      { h: 'التاريخ', w: 13, fmt: 'yyyy-mm-dd', center: true }, { h: 'اليوم', w: 11, center: true }, { h: 'الساعة', w: 9, fmt: 'hh:mm', center: true },
      { h: 'العميل', w: 24 }, { h: 'المدينة', w: 12 }, { h: 'النوع', w: 10, center: true }, { h: 'التصنيف', w: 13 },
      { h: 'الحالة', w: 12, center: true }, { h: 'ملاحظات', w: 34, wrap: true }
    ], appts.map(v => {
      const c = d.cmap.get(v.client_id) || {}, at = new Date(v.at);
      const st = v.status === 'cancelled' ? 'ملغي' : at < d.now ? 'فايت' : 'قادم';
      return [xl(at), dfWeekday.format(at), xl(at), c.name || '', c.city || '', KINDS[v.kind] || v.kind, v.category || '', st, v.notes || ''];
    }), { tab: ORANGE });

    // يوم بيوم
    const days = [];
    const cur = startOfDay(d.range.from), last = startOfDay(d.range.to);
    for (let i = 0; cur <= last && i < 400; i++) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    const byDay = {};
    done.forEach(v => { const k = dayKey(new Date(v.at)); (byDay[k] = byDay[k] || []).push(v); });
    const maxDay = Math.max.apply(null, days.map(x => (byDay[dayKey(x)] || []).length).concat([1]));
    const dayCols = [
      { h: 'التاريخ', w: 13, fmt: 'yyyy-mm-dd', center: true }, { h: 'اليوم', w: 12, center: true }, { h: 'إجمالي الزيارات', w: 12, center: true },
      { h: 'أعطال', w: 9, center: true }, { h: 'معاينات', w: 9, center: true }, { h: 'توريد', w: 9, center: true }, { h: 'تركيب', w: 9, center: true }, { h: 'الرسم', w: 30 }
    ];
    const dws = dataSheet(wb, 'يوم بيوم', dayCols, days.map(x => {
      const vs = byDay[dayKey(x)] || [];
      const k = n => vs.filter(v => v.kind === n).length;
      return [xl(x), dfWeekday.format(x), vs.length, k('fault'), k('inspection'), k('supply'), k('install'), '█'.repeat(Math.round(vs.length / maxDay * 24))];
    }), { tab: BLUE });
    if (days.length) {
      const n = days.length + 1;
      const r = dws.addRow(['الإجمالي']);
      [3, 4, 5, 6, 7].forEach(ci => {
        const L = String.fromCharCode(64 + ci);
        r.getCell(ci).value = { formula: 'SUM(' + L + '2:' + L + n + ')', result: done.filter(v => ci === 3 ? true : v.kind === ['', '', '', 'fault', 'inspection', 'supply', 'install'][ci - 1]).length };
      });
      for (let c = 1; c <= dayCols.length; c++) {
        const cell = r.getCell(c);
        cell.fill = solid(ORANGE_SOFT); cell.font = { name: FONT, bold: true, color: { argb: NAVY } }; cell.border = box(ORANGE);
        if (c >= 3 && c <= 7) cell.alignment = { horizontal: 'center' };
      }
      for (let i = 2; i <= n; i++) dws.getCell(i, 8).font = { name: FONT, color: { argb: ORANGE }, size: 10 };
    }

    addClientSheets(wb, d, inRange);

    return wb;
  }

  // قاعدة العملاء بس (من قسم العملاء)
  function buildClients(ExcelJS, d) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'يعقوب'; wb.created = d.now;
    d.cmap = new Map(d.clients.map(c => [c.id, c]));
    d.range = { from: new Date(2000, 0, 1), to: d.now };
    addClientSheets(wb, d, () => true);
    return wb;
  }

  window.YaqoubExcel = { build, buildClients };
})();
