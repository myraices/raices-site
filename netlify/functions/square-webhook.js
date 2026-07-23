const crypto = require('crypto');

function verifySignature(signature, body, url, key) {
  if (!signature || !key || !url) return false;
  const expected = crypto.createHmac('sha256', key).update(url + body).digest('base64');
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
async function supabasePatch(id, values) {
  const url = process.env.SUPABASE_URL || 'https://tqtnffinhqbyesjdollk.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${url}/rest/v1/orders?id=eq.${encodeURIComponent(id)}`, { method:'PATCH', headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'}, body:JSON.stringify(values) });
  if (!res.ok) throw new Error(`SUPABASE_${res.status}:${await res.text()}`);
}
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode:405, body:'Method not allowed' };
  try {
    const body = event.body || '';
    const signature = event.headers['x-square-hmacsha256-signature'] || event.headers['X-Square-HmacSha256-Signature'];
    const notificationUrl = process.env.SQUARE_WEBHOOK_NOTIFICATION_URL || `${process.env.URL}/.netlify/functions/square-webhook`;
    if (!verifySignature(signature, body, notificationUrl, process.env.SQUARE_WEBHOOK_SIGNATURE_KEY)) return { statusCode:403, body:'Invalid signature' };
    const payload = JSON.parse(body);
    if (!['payment.updated','payment.created'].includes(payload.type)) return { statusCode:200, body:'Ignored' };
    const payment = payload.data?.object?.payment;
    if (!payment?.order_id) return { statusCode:200, body:'No order' };
    const environment = String(process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase();
    const squareBase = environment === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';
    const res = await fetch(`${squareBase}/v2/orders/${encodeURIComponent(payment.order_id)}`, { headers:{Authorization:`Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,'Square-Version':'2026-07-15'} });
    const data = await res.json();
    const referenceId = data.order?.reference_id;
    if (!referenceId) return { statusCode:200, body:'No reference' };
    const status = payment.status || 'UNKNOWN';
    const completed = status === 'COMPLETED';
    await supabasePatch(referenceId, { payment_status: status, status: completed ? 'paid' : status.toLowerCase(), square_payment_id: payment.id || null, paid_at: completed ? new Date().toISOString() : null, updated_at: new Date().toISOString() });
    return { statusCode:200, body:'OK' };
  } catch (err) { console.error('square-webhook',err); return { statusCode:500, body:'Webhook error' }; }
};
