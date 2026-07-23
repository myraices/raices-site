const crypto = require('crypto');
const products = require('../../data/products.json');

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const allowedOrigins = new Set(['https://myraices.com', 'https://www.myraices.com']);

function response(statusCode, body, origin) {
  const headers = { ...JSON_HEADERS };
  if (origin && (allowedOrigins.has(origin) || origin.endsWith('.netlify.app'))) headers['Access-Control-Allow-Origin'] = origin;
  return { statusCode, headers, body: JSON.stringify(body) };
}
function cents(value) { return Math.round(Number(value || 0) * 100); }
function normalizeZip(value) { return String(value || '').replace(/\D/g, '').slice(0, 5); }
function zoneFor(zip) {
  const zones = [
    { name: 'Katy / Cinco Ranch', fee: 5, zips: ['77449','77450','77491','77493','77494'] },
    { name: 'Fulshear', fee: 8, zips: ['77441'] },
    { name: 'Richmond', fee: 8, zips: ['77406','77407','77469'] },
    { name: 'Sugar Land', fee: 15, zips: ['77478','77479','77498'] },
    { name: 'Cypress', fee: 15, zips: ['77429','77433'] },
    { name: 'Houston', fee: 15, prefixes: ['770'] }
  ];
  return zones.find(z => (z.zips || []).includes(zip) || (z.prefixes || []).some(p => zip.startsWith(p)));
}
function productMap() { return new Map(products.map(p => [p.sku, p])); }
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

    const map = productMap();
    let subtotal = 0;
    let physicalSubtotal = 0;
    const validated = items.map(raw => {
      const p = map.get(safeText(raw.sku, 60));
      const qty = Math.max(1, Math.min(20, Number.parseInt(raw.qty, 10) || 0));
      if (!p || p.available === false || p.soldOut) throw new Error('PRODUCT_NOT_AVAILABLE');
      if (Number.isFinite(Number(p.stock)) && qty > Number(p.stock)) throw new Error('INSUFFICIENT_STOCK');
      const unitCents = cents(p.price);
      const digital = isDigitalProduct(p);
      subtotal += unitCents * qty;
      if (!digital) physicalSubtotal += unitCents * qty;
      return { sku: p.sku, name: p.name, variant: safeText(raw.variant, 120), qty, unitCents, digital };
    });
    const hasPhysicalItems = validated.some(i => !i.digital);
    const zone = hasPhysicalItems ? zoneFor(zip) : { name: 'Digital delivery', fee: 0 };
    if (hasPhysicalItems && !zone) return response(400, { error: 'DELIVERY_OUTSIDE_COVERAGE' }, origin);
    if (hasPhysicalItems && (!safeText(customer.phone, 40) || !safeText(customer.address, 180) || !safeText(customer.city, 100) || !safeText(customer.state, 20) || zip.length !== 5)) {
      return response(400, { error: 'DELIVERY_DATA_INCOMPLETE' }, origin);
    }
    if (hasPhysicalItems && (!customer.addressVerified || !safeText(customer.placeId, 200))) return response(400, { error: 'ADDRESS_NOT_VERIFIED' }, origin);
    const deliveryCents = !hasPhysicalItems || physicalSubtotal >= 10000 ? 0 : cents(zone.fee);
    const totalCents = subtotal + deliveryCents;

    const pending = await supabaseRequest('orders', {
      method: 'POST',
      body: JSON.stringify({
        status: 'pending_payment', payment_status: 'pending', payment_provider: 'square',
        fulfillment_type: 'delivery',
        currency: 'USD',
        subtotal: subtotal / 100,
        discount_amount: 0,
        tax_amount: 0,
        delivery_amount: deliveryCents / 100,
        total_amount: totalCents / 100,
        subtotal_cents: subtotal,
        delivery_cents: deliveryCents,
        tax_cents: 0,
        total_cents: totalCents,
        customer_name: safeText(customer.name,120), customer_email: safeText(customer.email,180).toLowerCase(), customer_phone: safeText(customer.phone,40),
        delivery_address: hasPhysicalItems ? safeText(customer.address,180) : 'Digital delivery', delivery_apt: hasPhysicalItems ? safeText(customer.apt,60) : '', delivery_city: hasPhysicalItems ? safeText(customer.city,100) : 'Online', delivery_state: hasPhysicalItems ? safeText(customer.state,20) : 'N/A', delivery_zip: hasPhysicalItems ? zip : '00000',
        delivery_zone: zone.name, google_place_id: hasPhysicalItems ? safeText(customer.placeId,200) : '', delivery_notes: hasPhysicalItems ? safeText(customer.notes,1000) : 'Digital product — delivery by email/account',
        checkout_environment: environment
      })
    });
    const order = pending?.[0];
    if (!order?.id) throw new Error('ORDER_CREATION_FAILED');

    await supabaseRequest('order_items', {
      method: 'POST',
      body: JSON.stringify(validated.map(i => ({
        order_id: order.id,
        sku: i.sku,
        product_name: i.name,
        variant: i.variant,
        variant_name: i.variant,
        quantity: i.qty,
        unit_price: i.unitCents / 100,
        line_total: (i.unitCents * i.qty) / 100,
        unit_price_cents: i.unitCents,
        line_total_cents: i.unitCents * i.qty
      })))
    });

    const lineItems = validated.map(i => ({
      name: i.variant ? `${i.name} · ${i.variant}` : i.name,
      quantity: String(i.qty),
      base_price_money: { amount: i.unitCents, currency: 'USD' },
      note: i.sku
    }));
    if (deliveryCents > 0) lineItems.push({ name: `Delivery · ${zone.name}`, quantity: '1', base_price_money: { amount: deliveryCents, currency: 'USD' } });

    const baseUrl = process.env.URL || 'https://myraices.com';
    const squareBase = environment === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';
    const squareRes = await fetch(`${squareBase}/v2/online-checkout/payment-links`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Square-Version': '2026-07-15', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        order: { location_id: locationId, reference_id: order.id, line_items: lineItems },
        checkout_options: { redirect_url: `${baseUrl}/order-confirmation.html?order=${encodeURIComponent(order.id)}`, ask_for_shipping_address: false },
        pre_populated_data: { buyer_email: safeText(customer.email,180) }
      })
    });
    const squareText = await squareRes.text();
    const squareData = squareText ? JSON.parse(squareText) : {};
    if (!squareRes.ok || !squareData.payment_link?.url) {
      await supabaseRequest(`orders?id=eq.${order.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'checkout_error', provider_error: JSON.stringify(squareData).slice(0,2000) }) });
      return response(502, { error: 'SQUARE_CHECKOUT_FAILED', details: squareData.errors || [] }, origin);
    }

    await supabaseRequest(`orders?id=eq.${order.id}`, { method: 'PATCH', body: JSON.stringify({ square_order_id: squareData.payment_link.order_id, square_payment_link_id: squareData.payment_link.id }) });
    return response(200, { checkoutUrl: squareData.payment_link.url, orderId: order.id, orderNumber: order.order_number, environment }, origin);
  } catch (err) {
    console.error('create-square-checkout', err);
    const known = ['PRODUCT_NOT_AVAILABLE','INSUFFICIENT_STOCK'];
    return response(known.includes(err.message) ? 409 : 500, { error: known.includes(err.message) ? err.message : 'CHECKOUT_UNAVAILABLE' }, origin);
  }
};
