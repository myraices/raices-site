const crypto = require('crypto');
const { calculateManualTax } = require('./tax-engine');

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const allowedOrigins = new Set(['https://myraices.com', 'https://www.myraices.com']);

function response(statusCode, body, origin) {
  const headers = { ...JSON_HEADERS };
  if (origin && (allowedOrigins.has(origin) || origin.endsWith('.netlify.app'))) headers['Access-Control-Allow-Origin'] = origin;
  return { statusCode, headers, body: JSON.stringify(body) };
}
function cents(value) { return Math.round(Number(value || 0) * 100); }
function normalizeZip(value) { return String(value || '').replace(/\D/g, '').slice(0, 5); }
function normalizeList(value) {
  if (Array.isArray(value)) return value.flatMap(normalizeList);
  return String(value || '').split(/[,;\n]+/).map(v => v.trim()).filter(Boolean);
}
function parseSettings(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string') { try { return JSON.parse(value); } catch {} }
  return {};
}
function normalizeDeliveryZones(input) {
  const settings = parseSettings(input);
  const raw = Array.isArray(settings.delivery_zones) ? settings.delivery_zones
    : Array.isArray(settings.deliveryZones) ? settings.deliveryZones
    : Array.isArray(settings.operation?.delivery_zones) ? settings.operation.delivery_zones
    : [];
  return raw
    .filter(zone => zone && zone.active !== false && zone.enabled !== false)
    .map(zone => {
      const coverage = [...normalizeList(zone.zips ?? zone.zip_codes ?? zone.zipCodes), ...normalizeList(zone.coverage)];
      const zips = coverage.filter(v => !String(v).trim().endsWith('*')).map(v => String(v).replace(/\D/g,'').slice(0,5)).filter(v => v.length === 5);
      const prefixes = [
        ...coverage.filter(v => String(v).trim().endsWith('*')).map(v => String(v).replace(/\D/g,'').slice(0,5)),
        ...normalizeList(zone.prefixes ?? zone.prefix).map(v => String(v).replace(/\D/g,'').slice(0,5))
      ].filter(Boolean);
      return { name: safeText(zone.name || zone.label,120), fee: Math.max(0,Number(zone.fee ?? zone.cost ?? zone.price ?? 0)), zips:[...new Set(zips)], prefixes:[...new Set(prefixes)] };
    })
    .filter(zone => zone.name && (zone.zips.length || zone.prefixes.length));
}
function centralDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'America/Chicago', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function normalizeDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}
async function deliverySettings() {
  const rows = await supabaseRequest('nurai_settings?section=eq.operation&select=settings&limit=1');
  const settings = parseSettings(rows?.[0]?.settings || {});
  const zones = normalizeDeliveryZones(settings);
  const enabled = settings.free_delivery_enabled !== false;
  const rawThreshold = Number(settings.free_delivery_threshold ?? 100);
  const threshold = Number.isFinite(rawThreshold) && rawThreshold >= 0 ? rawThreshold : 100;
  const startDate = normalizeDate(settings.free_delivery_start_date);
  const endDate = normalizeDate(settings.free_delivery_end_date);
  const today = centralDateKey();
  const active = enabled && (!startDate || today >= startDate) && (!endDate || today <= endDate);
  return { zones, freeDelivery: { enabled, active, threshold, startDate, endDate } };
}
async function salesTaxSettings() {
  const rows = await supabaseRequest('nurai_settings?section=eq.payments&select=settings&limit=1');
  const settings = parseSettings(rows?.[0]?.settings || {});
  return settings.sales_tax && typeof settings.sales_tax === 'object' ? settings.sales_tax : null;
}
function zoneFor(zip, zones) {
  return (zones || []).find(z => (z.zips || []).includes(zip) || (z.prefixes || []).some(p => zip.startsWith(p)));
}
async function productMap() {
  console.log('[checkout] load_products:start');
  const rows = await supabaseRequest('products?select=*&status=in.(active,sold_out)');
  const map = new Map((rows || []).map(p => [String(p.sku || '').trim(), p]));
  console.log('[checkout] load_products:finish', { count: map.size });
  return map;
}
function productName(p) { return safeText(p?.name_es || p?.name_en || p?.name || p?.sku, 180); }
function isDigitalProduct(p) {
  return String(p?.sku || '').startsWith('RA-LB-') ||
    (String(p?.category || '').toLowerCase() === 'wellness' && String(p?.collection || '').toLowerCase() === 'the library') ||
    /producto digital|ebook|pdf/i.test(String(p?.ingredients || '') + ' ' + String(p?.conservation || ''));
}
function safeText(v, max=500) { return String(v || '').trim().slice(0, max); }

async function supabaseRequest(path, options = {}) {
  const url = process.env.SUPABASE_URL || 'https://tqtnffinhqbyesjdollk.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY_MISSING');
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(options.headers || {}) }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SUPABASE_${res.status}:${text.slice(0,300)}`);
  return text ? JSON.parse(text) : null;
}

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || '';
  if (event.httpMethod === 'OPTIONS') return response(204, {}, origin);
  if (event.httpMethod !== 'POST') return response(405, { error: 'METHOD_NOT_ALLOWED' }, origin);

  try {
    const environment = String(process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase();
    const salesEnabled = String(process.env.SQUARE_SALES_ENABLED || 'false').toLowerCase() === 'true';
    if (environment === 'production' && !salesEnabled) return response(503, { error: 'LIVE_SALES_DISABLED' }, origin);

    const token = process.env.SQUARE_ACCESS_TOKEN;
    const locationId = process.env.SQUARE_LOCATION_ID;
    if (!token || !locationId) return response(500, { error: 'SQUARE_CONFIGURATION_MISSING' }, origin);

    const payload = JSON.parse(event.body || '{}');
    const customer = payload.customer || {};
    if (payload.acceptedTerms !== true) return response(400, { error: 'TERMS_NOT_ACCEPTED' }, origin);
    const items = Array.isArray(payload.items) ? payload.items : [];
    const zip = normalizeZip(customer.zip);
    if (!items.length) return response(400, { error: 'EMPTY_CART' }, origin);
    if (!safeText(customer.name, 120) || !/^\S+@\S+\.\S+$/.test(safeText(customer.email, 180))) return response(400, { error: 'CUSTOMER_DATA_INCOMPLETE' }, origin);

    console.log('[checkout] validate_request:start', { itemCount: items.length });
    const map = await productMap();
    let subtotal = 0;
    let physicalSubtotal = 0;
    const validated = items.map(raw => {
      const p = map.get(safeText(raw.sku, 60));
      const qty = Math.max(1, Math.min(20, Number.parseInt(raw.qty, 10) || 0));
      if (!p || !['active','sold_out'].includes(String(p.status || '').toLowerCase()) || String(p.status || '').toLowerCase() === 'sold_out') throw new Error('PRODUCT_NOT_AVAILABLE');
      if (p.stock !== null && p.stock !== undefined && Number.isFinite(Number(p.stock)) && qty > Number(p.stock)) throw new Error('INSUFFICIENT_STOCK');
      const unitCents = cents(p.price);
      const digital = isDigitalProduct(p);
      subtotal += unitCents * qty;
      if (!digital) physicalSubtotal += unitCents * qty;
      const productionCost = Number(p.production_cost || 0);
      const packagingCost = Number(p.packaging_cost || 0);
      const logisticsCost = Number(p.logistics_cost || 0);
      const unitCost = Math.max(0, productionCost + packagingCost + logisticsCost);
      const taxStatus = ['food_exempt','physical_taxable','digital_taxable','digital_review'].includes(String(p.tax_status || '')) ? String(p.tax_status) : (digital ? 'digital_review' : (p.taxable === true ? 'physical_taxable' : 'food_exempt'));
      if (digital && !safeText(p.digital_file_path,500)) throw new Error('DIGITAL_FILE_MISSING');
      return { sku: p.sku, productId: p.id || null, name: productName(p), variant: safeText(raw.variant, 120), qty, unitCents, unitCost, digital, taxStatus, digitalFilePath: safeText(p.digital_file_path,500) };
    });
    const hasPhysicalItems = validated.some(i => !i.digital);
    const deliveryConfig = hasPhysicalItems ? await deliverySettings() : { zones: [], freeDelivery: { enabled:false, active:false, threshold:0 } };
    const zones = deliveryConfig.zones;
    if (hasPhysicalItems && !zones.length) return response(503, { error: 'DELIVERY_CONFIG_UNAVAILABLE' }, origin);
    const zone = hasPhysicalItems ? zoneFor(zip, zones) : { name: 'Digital delivery', fee: 0 };
    if (hasPhysicalItems && !zone) return response(400, { error: 'DELIVERY_OUTSIDE_COVERAGE' }, origin);
    if (hasPhysicalItems && (!safeText(customer.phone, 40) || !safeText(customer.address, 180) || !safeText(customer.city, 100) || !safeText(customer.state, 20) || zip.length !== 5)) {
      return response(400, { error: 'DELIVERY_DATA_INCOMPLETE' }, origin);
    }
    if (hasPhysicalItems && (!customer.addressVerified || !safeText(customer.placeId, 200))) return response(400, { error: 'ADDRESS_NOT_VERIFIED' }, origin);
    const freeThresholdCents = Math.round(Number(deliveryConfig.freeDelivery?.threshold || 0) * 100);
    const freeDeliveryApplies = hasPhysicalItems && deliveryConfig.freeDelivery?.active && (freeThresholdCents === 0 || physicalSubtotal >= freeThresholdCents);
    const deliveryCents = !hasPhysicalItems || freeDeliveryApplies ? 0 : cents(zone.fee);
    const hasTaxablePhysical = validated.some(i => i.taxStatus === 'physical_taxable');
    const hasTaxableItems = validated.some(i => i.taxStatus === 'physical_taxable' || i.taxStatus === 'digital_taxable');
    const hasDigitalReview = validated.some(i => i.taxStatus === 'digital_review');
    if (environment === 'production' && hasDigitalReview) return response(503, { error: 'DIGITAL_TAX_REVIEW_REQUIRED' }, origin);
    if (hasTaxablePhysical && hasDigitalReview) return response(503, { error: 'DIGITAL_TAX_REVIEW_REQUIRED' }, origin);

    let taxResult;
    try {
      const salesTax = hasTaxableItems ? await salesTaxSettings() : null;
      taxResult = calculateManualTax({ customer: { ...customer, zip }, items: validated, deliveryCents, salesTax });
    } catch (taxError) {
      console.error('[checkout] tax_engine', taxError.message, taxError.details || '');
      if (taxError.message === 'TAX_RULE_NOT_CONFIGURED') return response(503, { error: 'TAX_RULE_NOT_CONFIGURED', state: taxError.details?.state || safeText(customer.state,20) }, origin);
      throw taxError;
    }
    const preTaxTotalCents = subtotal + deliveryCents;
    const taxCentsExpected = Number(taxResult.taxCents || 0);

    console.log('[checkout] tax_calculated', { provider: taxResult.provider, taxCentsExpected, ratePercent: taxResult.ratePercent, freightTaxable: taxResult.freightTaxable });
    const pendingOrderPayload = {
      fulfillment_type: hasPhysicalItems ? 'delivery' : 'digital',
      subtotal: subtotal / 100,
      delivery_amount: deliveryCents / 100,
      subtotal_cents: subtotal,
      delivery_cents: deliveryCents,
      customer_name: safeText(customer.name,120),
      customer_email: safeText(customer.email,180).toLowerCase(),
      customer_phone: safeText(customer.phone,40),
      delivery_address: hasPhysicalItems ? safeText(customer.address,180) : 'Digital delivery',
      delivery_apt: hasPhysicalItems ? safeText(customer.apt,60) : '',
      delivery_city: hasPhysicalItems ? safeText(customer.city,100) : 'Online',
      delivery_state: safeText(customer.state,20) || 'N/A',
      delivery_zip: hasPhysicalItems ? zip : (zip || '00000'),
      delivery_zone: zone.name,
      google_place_id: hasPhysicalItems ? safeText(customer.placeId,200) : '',
      delivery_notes: hasPhysicalItems ? safeText(customer.notes,1000) : 'Digital product — delivery by email/account',
      checkout_environment: environment,
      is_test: environment !== 'production'
    };
    const pendingItemsPayload = validated.map(i => ({
      product_id: i.productId,
      sku: i.sku,
      product_name: i.name,
      variant: i.variant,
      variant_name: i.variant,
      quantity: i.qty,
      unit_price: i.unitCents / 100,
      line_total: (i.unitCents * i.qty) / 100,
      unit_price_cents: i.unitCents,
      line_total_cents: i.unitCents * i.qty,
      unit_cost_snapshot: i.unitCost
    }));

    const TAX_UID = 'RAICES-SALES-TAX';
    const appliedTax = { tax_uid: TAX_UID };
    const lineItems = validated.map(i => ({
      name: i.variant ? `${i.name} · ${i.variant}` : i.name,
      quantity: String(i.qty),
      base_price_money: { amount: i.unitCents, currency: 'USD' },
      note: `${i.sku} · tax:${i.taxStatus}`,
      ...((i.taxStatus === 'physical_taxable' || i.taxStatus === 'digital_taxable') && taxCentsExpected > 0 ? { applied_taxes: [appliedTax] } : {})
    }));
    if (deliveryCents > 0) lineItems.push({
      name: `Delivery · ${zone.name}`,
      quantity: '1',
      base_price_money: { amount: deliveryCents, currency: 'USD' },
      ...(hasTaxablePhysical && taxCentsExpected > 0 && taxResult.freightTaxable ? { applied_taxes: [appliedTax] } : {})
    });
    const orderTaxes = taxCentsExpected > 0 ? [{
      uid: TAX_UID,
      name: 'Sales tax',
      percentage: String(Number(taxResult.ratePercent || 0).toFixed(6)),
      type: 'ADDITIVE',
      scope: 'LINE_ITEM'
    }] : [];

    const squareOrderPayload = { location_id: locationId, line_items: lineItems, ...(orderTaxes.length ? { taxes: orderTaxes } : {}) };
    if (taxCentsExpected > 0) {
      const squareBaseForCalc = environment === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';
      const calcRes = await fetch(`${squareBaseForCalc}/v2/orders/calculate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Square-Version': '2026-07-15', 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: squareOrderPayload })
      });
      const calcText = await calcRes.text();
      let calcData = {};
      try { calcData = calcText ? JSON.parse(calcText) : {}; } catch {}
      if (!calcRes.ok || !calcData.order) return response(502, { error: 'SQUARE_TAX_CALCULATION_FAILED', details: calcData.errors || [] }, origin);
      const squareTaxCents = Number(calcData.order.total_tax_money?.amount || calcData.order.net_amounts?.tax_money?.amount || 0);
      if (Math.abs(squareTaxCents - taxCentsExpected) > 1) {
        console.error('[checkout] tax_mismatch', { taxCentsExpected, squareTaxCents });
        return response(503, { error: 'TAX_CALCULATION_MISMATCH' }, origin);
      }
    }

    const checkoutId = crypto.randomUUID();
    await supabaseRequest('checkout_sessions', {
      method: 'POST',
      body: JSON.stringify({
        id: checkoutId,
        status: 'created',
        environment,
        payload: {
          order: pendingOrderPayload,
          items: pendingItemsPayload,
          expected: { tax_cents: taxCentsExpected, pre_tax_total_cents: preTaxTotalCents }
        }
      })
    });

    const baseUrl = process.env.URL || 'https://myraices.com';
    const squareBase = environment === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';
    console.log('[checkout] create_square_link:start', { checkoutId, taxProfile: validated.map(i => ({ sku:i.sku, taxStatus:i.taxStatus })) });
    const squareRes = await fetch(`${squareBase}/v2/online-checkout/payment-links`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Square-Version': '2026-07-15', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        order: { ...squareOrderPayload, reference_id: checkoutId },
        checkout_options: {
          redirect_url: `${baseUrl}/order-confirmation.html?checkout=${encodeURIComponent(checkoutId)}`,
          ask_for_shipping_address: false,
          allow_tipping: false,
          enable_coupon: false,
        },
        pre_populated_data: { buyer_email: safeText(customer.email,180) }
      })
    });
    const squareText = await squareRes.text();
    const squareData = squareText ? JSON.parse(squareText) : {};
    if (!squareRes.ok || !squareData.payment_link?.url) {
      await supabaseRequest(`checkout_sessions?id=eq.${checkoutId}`, { method: 'PATCH', body: JSON.stringify({ status: 'failed', updated_at: new Date().toISOString() }) });
      return response(502, { error: 'SQUARE_CHECKOUT_FAILED', details: squareData.errors || [] }, origin);
    }

    console.log('[checkout] create_square_link:finish', { checkoutId, squareOrderId: squareData.payment_link.order_id });
    const squareOrder = squareData.related_resources?.orders?.[0] || null;
    const taxCents = Number(squareOrder?.total_tax_money?.amount || squareOrder?.net_amounts?.tax_money?.amount || 0);
    const squareTotalCents = Number(squareOrder?.total_money?.amount || squareOrder?.net_amounts?.total_money?.amount || (preTaxTotalCents + taxCents));
    await supabaseRequest(`checkout_sessions?id=eq.${checkoutId}`, { method: 'PATCH', body: JSON.stringify({
      status: 'square_ready',
      square_order_id: squareData.payment_link.order_id,
      square_payment_link_id: squareData.payment_link.id,
      updated_at: new Date().toISOString()
    }) });
    console.log('[checkout] finish_checkout', { checkoutId, taxCents, totalCents: squareTotalCents });
    return response(200, { checkoutUrl: squareData.payment_link.url, checkoutId, environment, taxCents, totalCents: squareTotalCents }, origin);
  } catch (err) {
    console.error('create-square-checkout', err);
    const known = ['PRODUCT_NOT_AVAILABLE','INSUFFICIENT_STOCK','DIGITAL_FILE_MISSING'];
    return response(known.includes(err.message) ? 409 : 500, { error: known.includes(err.message) ? err.message : 'CHECKOUT_UNAVAILABLE' }, origin);
  }
};
