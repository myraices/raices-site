const crypto = require('crypto');

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

function verifySignature(signature, body, url, key) {
  if (!signature || !key || !url) return false;
  const expected = crypto.createHmac('sha256', key).update(url + body).digest('base64');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL || 'https://tqtnffinhqbyesjdollk.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY_MISSING');
  return { url, key };
}

async function supabaseFind(filter) {
  const { url, key } = supabaseConfig();
  const res = await fetch(`${url}/rest/v1/orders?${filter}&select=id,square_order_id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!res.ok) throw new Error(`SUPABASE_FIND_${res.status}:${await res.text()}`);
  const rows = await res.json();
  return rows?.[0] || null;
}

async function supabasePatch(id, values) {
  const { url, key } = supabaseConfig();
  const res = await fetch(`${url}/rest/v1/orders?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(values)
  });
  if (!res.ok) throw new Error(`SUPABASE_PATCH_${res.status}:${await res.text()}`);
}

async function getSquareReferenceId(squareOrderId) {
  if (!squareOrderId) return '';
  const environment = String(process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase();
  const squareBase = environment === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
  const res = await fetch(`${squareBase}/v2/orders/${encodeURIComponent(squareOrderId)}`, {
    headers: {
      Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      'Square-Version': '2026-07-15'
    }
  });
  if (!res.ok) {
    console.error('square-webhook order lookup failed', res.status, await res.text());
    return '';
  }
  const data = await res.json();
  return data.order?.reference_id || '';
}

async function resolveInternalOrder(payment) {
  const squareOrderId = String(payment?.order_id || '').trim();
  if (!squareOrderId) return null;

  // Primary lookup: the Square payment order_id stored in orders.square_order_id.
  let order = await supabaseFind(`square_order_id=eq.${encodeURIComponent(squareOrderId)}`);
  if (order) return order;

  // Compatibility lookup: payment.order_id may already be the internal order UUID.
  order = await supabaseFind(`id=eq.${encodeURIComponent(squareOrderId)}`);
  if (order) return order;

  // Final fallback: retrieve Square's reference_id and use the internal order id.
  const referenceId = await getSquareReferenceId(squareOrderId);
  if (!referenceId) return null;
  return supabaseFind(`id=eq.${encodeURIComponent(referenceId)}`);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: JSON_HEADERS, body: 'Method not allowed' };

  try {
    const body = event.body || '';
    const signature = event.headers['x-square-hmacsha256-signature'] || event.headers['X-Square-HmacSha256-Signature'];
    const notificationUrl = process.env.SQUARE_WEBHOOK_NOTIFICATION_URL || `${process.env.URL}/.netlify/functions/square-webhook`;
    if (!verifySignature(signature, body, notificationUrl, process.env.SQUARE_WEBHOOK_SIGNATURE_KEY)) {
      return { statusCode: 403, headers: JSON_HEADERS, body: 'Invalid signature' };
    }

    const payload = JSON.parse(body);
    if (!['payment.updated', 'payment.created'].includes(payload.type)) {
      return { statusCode: 200, headers: JSON_HEADERS, body: 'Ignored' };
    }

    const payment = payload.data?.object?.payment;
    if (!payment?.order_id) return { statusCode: 200, headers: JSON_HEADERS, body: 'No order' };

    const order = await resolveInternalOrder(payment);
    if (!order?.id) {
      console.error('square-webhook order not found', { paymentId: payment.id, squareOrderId: payment.order_id });
      return { statusCode: 200, headers: JSON_HEADERS, body: 'Order not found' };
    }

    const squareStatus = String(payment.status || 'UNKNOWN').toUpperCase();
    const completed = squareStatus === 'COMPLETED';
    const failed = squareStatus === 'FAILED' || squareStatus === 'CANCELED';

    const values = completed
      ? {
          status: 'paid',
          payment_status: 'completed',
          square_payment_id: payment.id || null,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      : {
          status: failed ? 'cancelled' : 'pending_payment',
          payment_status: failed ? 'failed' : 'pending',
          square_payment_id: payment.id || null,
          updated_at: new Date().toISOString()
        };

    // Do not erase paid_at when Square sends an intermediate event.
    await supabasePatch(order.id, values);
    return { statusCode: 200, headers: JSON_HEADERS, body: 'OK' };
  } catch (err) {
    console.error('square-webhook', err);
    return { statusCode: 500, headers: JSON_HEADERS, body: 'Webhook error' };
  }
};
