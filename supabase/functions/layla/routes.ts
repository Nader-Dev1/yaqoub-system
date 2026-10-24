// Server-only Google Routes integration. All client lookups use the caller's RLS client.
export const routeTool = {
  name: 'plan_route',
  description: 'طريق Google Maps لعميل/فرع، ومقارنة المرور بعملاء مسجلين قرب الطريق مع زمن الزيادة الفعلي إن كان Google Routes مفعلاً. حدد البداية بعنوان واضح أو عميل/فرع محفوظ. لا تختار فرعاً عشوائياً.',
  input_schema: { type: 'object', properties: {
    destination_client_id: { type: 'string' }, destination_branch_id: { type: 'string' },
    origin_address: { type: 'string' }, origin_client_id: { type: 'string' }, origin_branch_id: { type: 'string' },
    max_detour_minutes: { type: 'number' }
  }, required: ['destination_client_id'] }
};
export function mapsLink(origin, destination, via = null) {
  const u = new URL('https://www.google.com/maps/dir/');
  u.search = new URLSearchParams({ api: '1', origin, destination, travelmode: 'driving', ...(via ? { waypoints: via } : {}) }).toString();
  return u.href;
}
export function decodePolyline(encoded) {
  const points = []; let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    const read = () => { let n = 0, shift = 0, b; do { if (i >= encoded.length || shift > 30) throw new Error('Invalid route geometry'); b = encoded.charCodeAt(i++) - 63; n |= (b & 31) << shift; shift += 5; } while (b >= 32); return n & 1 ? ~(n >> 1) : n >> 1; };
    lat += read(); lng += read(); points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}
// Distance to the actual returned road geometry is only a shortlist, never proof of an easy detour.
export function corridorKm(point, path) {
  const scale = Math.cos(point.lat * Math.PI / 180), x = point.lng * scale, y = point.lat;
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], ax = a[1] * scale, ay = a[0], dx = b[1] * scale - ax, dy = b[0] - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy) * 111.32);
  }
  return best;
}
export async function planRoute(input, ctx, key, request) {
  if (ctx.routeUsed) return { error: 'تم حساب مسار في هذا الرد بالفعل. اعرض نتيجته أو اطلب رحلة جديدة.' };
  ctx.routeUsed = true;
  const { sb } = ctx;
  async function site(clientId, branchId) {
    const c = await sb.from('clients').select('id,name,city,address,lat,lng,map_url').eq('id', clientId).maybeSingle();
    if (c.error) throw new Error('تعذر قراءة العميل');
    if (!c.data) throw new Error('العميل غير متاح');
    const branches = await sb.from('client_branches').select('id,client_id,name,city,address,lat,lng,map_url').eq('client_id', clientId);
    if (branches.error) throw new Error('تعذر قراءة فروع العميل');
    if (!branchId && branches.data.length) return { choose_branch: true, client: c.data.name, branches: branches.data.map(b => ({ id: b.id, name: b.name })) };
    const b = branchId ? branches.data.find(b => b.id === branchId) : null;
    if (branchId && !b) throw new Error('الفرع غير تابع للعميل');
    const row = b || c.data, label = c.data.name + (b ? ' — ' + b.name : '');
    const coords = Number.isFinite(row.lat) && Number.isFinite(row.lng);
    const address = [row.address, row.city].filter(Boolean).join('، ');
    if (!coords && !row.address) return { missing_location: true, label, message: 'احفظ عنواناً واضحاً أو إحداثيات لهذا الفرع أولاً.' };
    return { client_id: clientId, branch_id: b?.id || null, label, lat: row.lat, lng: row.lng,
      query: coords ? row.lat + ',' + row.lng : label + '، ' + address,
      waypoint: coords ? { location: { latLng: { latitude: row.lat, longitude: row.lng } } } : { address: label + '، ' + address } };
  }
  const destination = await site(input.destination_client_id, input.destination_branch_id);
  if (!destination.waypoint) return destination;
  let origin;
  if (input.origin_client_id) origin = await site(input.origin_client_id, input.origin_branch_id);
  else if (typeof input.origin_address === 'string' && input.origin_address.trim().length >= 4) {
    const address = input.origin_address.trim().slice(0, 300);
    origin = { label: address, query: address, waypoint: { address } };
  } else return { ask_origin: true, message: 'يا بشمهندس نادر، هتتحرك من أنهي عنوان أو فرع؟' };
  if (!origin.waypoint) return origin;
  const google_maps_url = mapsLink(origin.query, destination.query);
  if (!key) return { integration: 'maps_link_only', origin: origin.label, destination: destination.label, google_maps_url,
    message: 'رابط الملاحة جاهز. حساب الطرق والزحمة والعملاء على الطريق داخل ليلة يحتاج تفعيل Google Routes API ومفتاحه في السيرفر؛ لا توجد حالياً بيانات طريق أو زمن وصول يمكن الاستناد إليها.' };
  async function compute(via = null) {
    const response = await request('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.description' },
      body: JSON.stringify({ origin: origin.waypoint, destination: destination.waypoint,
        ...(via ? { intermediates: [via.waypoint] } : {}), travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE',
        computeAlternativeRoutes: !via, languageCode: 'ar', units: 'METRIC' })
    });
    if (!response.ok) throw new Error('تعذر جلب الطريق من Google Maps. تحقق من تفعيل Routes API والفوترة وصلاحية المفتاح.');
    const data = await response.json();
    const routes = (data.routes || []).filter(r => /^\d+(\.\d+)?s$/.test(r.duration) && Number.isFinite(r.distanceMeters));
    if (!routes.length) throw new Error('Google Maps لم يجد طريق قيادة لهذه المواقع.');
    return routes.sort((a, b) => parseFloat(a.duration) - parseFloat(b.duration));
  }
  const routes = await compute(), fastest = routes[0], geometry = decodePolyline(fastest.polyline?.encodedPolyline || '');
  const [clients, branches] = await Promise.all([
    sb.from('clients').select('id,name,lat,lng'),
    sb.from('client_branches').select('id,client_id,name,lat,lng')
  ]);
  if (clients.error || branches.error) return { error: 'تعذر قراءة مواقع العملاء لترشيح محطات الطريق', google_maps_url };
  const names = new Map(clients.data.map(c => [c.id, c.name]));
  const branchClients = new Set(branches.data.map(b => b.client_id));
  const sites = [
    ...clients.data.filter(c => !branchClients.has(c.id)).map(c => ({ ...c, client_id: c.id, branch_id: null, label: c.name })),
    ...branches.data.map(b => ({ ...b, branch_id: b.id, label: names.get(b.client_id) + ' — ' + b.name }))
  ].filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng) &&
    !(s.client_id === destination.client_id && s.branch_id === destination.branch_id) &&
    !(s.client_id === origin.client_id && s.branch_id === origin.branch_id))
    .map(s => ({ ...s, corridor_km: corridorKm(s, geometry) })).filter(s => s.corridor_km <= 3)
    .sort((a, b) => a.corridor_km - b.corridor_km).slice(0, 3);
  const maxDetour = Math.max(0, Math.min(30, Number(input.max_detour_minutes) || 10));
  const stops = []; let failedChecks = 0;
  for (const s of sites) {
    s.query = s.lat + ',' + s.lng;
    s.waypoint = { location: { latLng: { latitude: s.lat, longitude: s.lng } } };
    try {
      const via = (await compute(s))[0], extra = Math.max(0, (parseFloat(via.duration) - parseFloat(fastest.duration)) / 60);
      if (extra <= maxDetour) stops.push({ name: s.label, extra_minutes: Math.round(extra * 10) / 10,
        total_minutes: Math.ceil(parseFloat(via.duration) / 60), google_maps_url: mapsLink(origin.query, destination.query, s.query) });
    } catch { failedChecks++; }
  }
  return { provider: 'Google Maps', calculated_at: new Date().toISOString(), origin: origin.label, destination: destination.label,
    google_maps_url, routes: routes.map(r => ({ description: r.description, minutes: Math.ceil(parseFloat(r.duration) / 60), km: Math.round(r.distanceMeters / 100) / 10 })),
    nearby_stops: stops.sort((a, b) => a.extra_minutes - b.extra_minutes), checked_candidates: sites.length, failed_checks: failedChecks,
    coverage: 'مقارنة حتى 3 مواقع محفوظة بإحداثيات وقريبة من هندسة أسرع مسار أعادته Google. كل ترشيح محطة منفردة؛ جمع المحطات يحتاج حساباً جديداً. الأوقات تقديرية ومتغيرة، وليست ضماناً لأسرع طريق مطلقاً.' };
}
