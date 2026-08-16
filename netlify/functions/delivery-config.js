const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, max-age=0' };
const allowedOrigins = new Set(['https://myraices.com', 'https://www.myraices.com']);

function response(statusCode, body, origin) {
  const headers = { ...JSON_HEADERS };
  if (origin && (allowedOrigins.has(origin) || origin.endsWith('.netlify.app'))) headers['Access-Control-Allow-Origin'] = origin;
  return { statusCode, headers, body: JSON.stringify(body) };
}
function normalizeList(value) {
  if (Array.isArray(value)) return value.flatMap(normalizeList);
  return String(value || '').split(/[,;\n]+/).map(v => v.trim()).filter(Boolean);
}
function parseSettings(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string') { try { return JSON.parse(value); } catch {} }
  return {};
}
function sanitizeZones(input) {
  const settings = parseSettings(input);
  const raw = Array.isArray(settings.delivery_zones) ? settings.delivery_zones
    : Array.isArray(settings.deliveryZones) ? settings.deliveryZones
    : Array.isArray(settings.operation?.delivery_zones) ? settings.operation.delivery_zones
    : [];
  return raw
    .filter(zone => zone && zone.active !== false && zone.enabled !== false)
    .map(zone => {
      const coverage = [
        ...normalizeList(zone.zips ?? zone.zip_codes ?? zone.zipCodes),
        ...normalizeList(zone.coverage)
      ];
      const explicitPrefixes = normalizeList(zone.prefixes ?? zone.prefix);
      const zips = coverage
        .filter(v => !String(v).trim().endsWith('*'))
        .map(v => String(v).replace(/\D/g, '').slice(0, 5))
        .filter(v => v.length === 5);
      const prefixes = [
        ...coverage.filter(v => String(v).trim().endsWith('*')).map(v => String(v).replace(/\D/g, '').slice(0, 5)),
        ...explicitPrefixes.map(v => String(v).replace(/\D/g, '').slice(0, 5))
      ].filter(Boolean);
      return {
        name: String(zone.name || zone.label || '').trim().slice(0, 120),
        fee: Math.max(0, Number(zone.fee ?? zone.cost ?? zone.price ?? 0)),
        zips: [...new Set(zips)],
        prefixes: [...new Set(prefixes)]
      };
    })
    .filter(zone => zone.name && (zone.zips.length || zone.prefixes.length));
}

function centralDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function normalizeDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}
function scheduleActive(enabled, startDate, endDate) {
  if (!enabled) return false;
  const today = centralDateKey();
  if (startDate && today < startDate) return false;
  if (endDate && today > endDate) return false;
  return true;
}

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || '';
  if (event.httpMethod === 'OPTIONS') return response(204, {}, origin);
  if (event.httpMethod !== 'GET') return response(405, { error: 'METHOD_NOT_ALLOWED' }, origin);
  try {
    const url = process.env.SUPABASE_URL || 'https://tqtnffinhqbyesjdollk.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) return response(500, { error: 'DELIVERY_CONFIG_UNAVAILABLE' }, origin);
    const res = await fetch(`${url}/rest/v1/nurai_settings?section=eq.operation&select=settings&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`SUPABASE_${res.status}:${text.slice(0, 250)}`);
    const rows = text ? JSON.parse(text) : [];
    const settings = rows?.[0]?.settings || {};
    const zones = sanitizeZones(settings);
    const freeDeliveryEnabled = settings.free_delivery_enabled !== false;
    const rawThreshold = Number(settings.free_delivery_threshold ?? 100);
    const freeDeliveryThreshold = Number.isFinite(rawThreshold) && rawThreshold >= 0 ? rawThreshold : 100;
    const freeDeliveryStartDate = normalizeDate(settings.free_delivery_start_date);
    const freeDeliveryEndDate = normalizeDate(settings.free_delivery_end_date);
    const freeDeliveryActive = scheduleActive(freeDeliveryEnabled, freeDeliveryStartDate, freeDeliveryEndDate);
    return response(200, {
      zones,
      freeDeliveryEnabled,
      freeDeliveryActive,
      freeDeliveryThreshold,
      freeDeliveryStartDate,
      freeDeliveryEndDate,
      scheduleTimeZone: 'America/Chicago',
      source: 'nurai_settings',
      updatedAt: new Date().toISOString()
    }, origin);
  } catch (err) {
    console.error('delivery-config', err);
    return response(503, { error: 'DELIVERY_CONFIG_UNAVAILABLE', zones: [] }, origin);
  }
};
