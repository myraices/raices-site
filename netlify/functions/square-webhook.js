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
  const res = await fetch(`${url}/rest/v1/orders?${filter}&select=id,square_order_id,status,payment_status,inventory_deducted_at,paid_at,confirmation_email_sent_at&limit=1`, {
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

async function completeDigitalOrder(order) {
  if (!order?.id || order.fulfillment_type !== 'digital') return order;
  if (String(order.status || '').toLowerCase() === 'completed') return order;

  const completedAt = new Date().toISOString();
  const fromStatus = order.status || 'paid';
  await supabasePatch(order.id, {
    status: 'completed',
    completed_at: completedAt,
    updated_at: completedAt
  });

  const { url, key } = supabaseConfig();
  const history = await fetch(`${url}/rest/v1/order_status_history`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      order_id: order.id,
      from_status: fromStatus,
      to_status: 'completed',
      note: 'Entrega digital completada automáticamente tras confirmar el pago y habilitar la descarga.',
      changed_at: completedAt
    })
  });
  if (!history.ok && history.status !== 409) {
    console.warn('[square-webhook] digital_history_failed', history.status, await history.text());
  }

  return { ...order, status: 'completed', completed_at: completedAt };
}


async function completePaidOrder(orderId, paymentId, paidAt) {
  const { url, key } = supabaseConfig();
  const res = await fetch(`${url}/rest/v1/rpc/complete_paid_order_and_deduct_inventory`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      p_order_id: orderId,
      p_square_payment_id: paymentId || null,
      p_paid_at: paidAt
    })
  });
  if (!res.ok) throw new Error(`SUPABASE_COMPLETE_ORDER_${res.status}:${await res.text()}`);
  return res.json().catch(() => null);
}


async function supabaseGetOrderDetails(orderId) {
  const { url, key } = supabaseConfig();
  const res = await fetch(`${url}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=id,order_number,customer_name,customer_email,customer_phone,delivery_address,delivery_apt,delivery_city,delivery_state,delivery_zip,delivery_zone,fulfillment_type,subtotal,delivery_amount,tax_amount,total_amount,currency,payment_status,status,paid_at,confirmation_email_sent_at,completed_at,manage_token,order_items(id,product_id,product_name,variant_name,quantity,unit_price,line_total,sku)`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!res.ok) throw new Error(`SUPABASE_ORDER_DETAILS_${res.status}:${await res.text()}`);
  const rows = await res.json();
  return rows?.[0] || null;
}

async function createOrderNotification(order) {
  if (!order?.id) return;
  const { url, key } = supabaseConfig();
  const number = order.order_number || String(order.id).slice(0, 8);
  const payload = {
    type: 'order_paid',
    title: 'Pago confirmado',
    message: `#${number} · ${order.customer_name || 'Cliente'} · $${Number(order.total_amount || 0).toFixed(2)}`,
    order_id: order.id,
    action_url: `/orders?order=${order.id}`,
    dedupe_key: `order-paid:${order.id}`,
    metadata: { order_number: number, total: Number(order.total_amount || 0) }
  };
  const res = await fetch(`${url}/rest/v1/app_notifications`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(payload)
  });
  if (!res.ok && res.status !== 409) throw new Error(`SUPABASE_NOTIFICATION_${res.status}:${await res.text()}`);
}

function money(value) { return `$${Number(value || 0).toFixed(2)}`; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function ensureDigitalEntitlements(order) {
  const items = (order?.order_items || []).filter(item => item.product_id);
  if (!items.length) return [];
  const ids = [...new Set(items.map(item => item.product_id))];
  const products = await (async()=>{
    const { url, key } = supabaseConfig();
    const res = await fetch(`${url}/rest/v1/products?id=in.(${ids.join(',')})&select=id,operational_type,product_type,digital_file_path,digital_file_name`, { headers:{apikey:key,Authorization:`Bearer ${key}`} });
    if(!res.ok) throw new Error(`SUPABASE_DIGITAL_PRODUCTS_${res.status}:${await res.text()}`);
    return res.json();
  })();
  const digital = products.filter(p => (p.operational_type === 'digital' || p.product_type === 'digital') && p.digital_file_path);
  if (!digital.length) return [];
  const { url, key } = supabaseConfig();
  const results=[];
  for (const product of digital) {
    let res = await fetch(`${url}/rest/v1/digital_entitlements?order_id=eq.${encodeURIComponent(order.id)}&product_id=eq.${encodeURIComponent(product.id)}&select=download_token,product_id,revoked_at&limit=1`, {headers:{apikey:key,Authorization:`Bearer ${key}`}});
    let rows = res.ok ? await res.json() : [];
    let row = rows?.[0];
    if (!row) {
      res = await fetch(`${url}/rest/v1/digital_entitlements`, {method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({order_id:order.id,product_id:product.id,customer_email:String(order.customer_email||'').toLowerCase()})});
      if(!res.ok) throw new Error(`SUPABASE_ENTITLEMENT_${res.status}:${await res.text()}`);
      row=(await res.json())?.[0];
    }
    if(row?.download_token && !row.revoked_at){
      const item=items.find(i=>String(i.product_id)===String(product.id));
      results.push({productId:product.id,name:item?.product_name||product.digital_file_name||'Producto digital',token:row.download_token});
    }
  }
  return results;
}

async function sendOrderConfirmation(order, entitlements = []) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey || !order?.customer_email) {
    console.warn('[square-webhook] send_confirmation:omitted', { reason: !apiKey ? 'BREVO_API_KEY_MISSING' : 'CUSTOMER_EMAIL_MISSING', orderId: order?.id });
    return;
  }
  const senderName = process.env.BREVO_SENDER_NAME || 'Raíces';
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'info@myraices.com';
  const items = (order.order_items || []).map(item => `<tr><td style="padding:8px 0;border-bottom:1px solid #e7ece9">${escapeHtml(item.product_name)}${item.variant_name ? ` · ${escapeHtml(item.variant_name)}` : ''} × ${Number(item.quantity || 0)}</td><td style="padding:8px 0;border-bottom:1px solid #e7ece9;text-align:right">${money(item.line_total)}</td></tr>`).join('');
  const address = order.fulfillment_type === 'digital' ? 'Entrega digital' : [order.delivery_address, order.delivery_apt, order.delivery_city, order.delivery_state, order.delivery_zip].filter(Boolean).map(escapeHtml).join(', ');
  const orderStatusText = order.fulfillment_type === 'digital' && String(order.status || '').toLowerCase() === 'completed'
    ? 'Pago confirmado · Entrega digital completada'
    : 'Pago confirmado · En preparación';
  const htmlContent = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#173d38;background:#f5f7f6;padding:24px"><div style="max-width:620px;margin:auto;background:#fff;padding:32px;border-radius:16px"><h1 style="margin-top:0">Gracias por tu compra</h1><p>Hola ${escapeHtml(order.customer_name || '')}, tu pago fue confirmado y recibimos correctamente tu pedido.</p><p><strong>Pedido #${escapeHtml(order.order_number || '')}</strong><br>Estado: ${escapeHtml(orderStatusText)}</p><table style="width:100%;border-collapse:collapse">${items}</table><table style="width:100%;margin-top:18px"><tr><td>Subtotal</td><td style="text-align:right">${money(order.subtotal)}</td></tr><tr><td>Entrega</td><td style="text-align:right">${money(order.delivery_amount)}</td></tr><tr><td>Sales tax</td><td style="text-align:right">${money(order.tax_amount)}</td></tr><tr><td style="padding-top:8px"><strong>Total pagado</strong></td><td style="padding-top:8px;text-align:right"><strong>${money(order.total_amount)}</strong></td></tr></table>${entitlements.length ? `<div style="margin-top:22px;padding:18px;background:#f3f7f5;border-radius:12px"><strong>Tus descargas digitales</strong><p style="margin:8px 0 12px">Accede a tus ebooks desde estos enlaces seguros:</p>${entitlements.map(e=>`<p style="margin:8px 0"><a href="${escapeHtml((process.env.URL||'https://myraices.com')+'/.netlify/functions/digital-download?token='+e.token)}" style="display:inline-block;padding:10px 16px;background:#174f45;color:#fff;text-decoration:none;border-radius:8px">Descargar ${escapeHtml(e.name)}</a></p>`).join('')}</div>` : ''}<p style="margin-top:22px"><strong>Entrega:</strong><br>${address}</p><p>${order.fulfillment_type === 'digital' ? 'También encontrarás tus descargas en Mi Cuenta si compraste con una cuenta de Raíces.' : 'Te mantendremos informado cuando tu pedido avance.'}</p>${order.manage_token ? `<div style="margin-top:24px;padding:18px;background:#fbf5ea;border-radius:12px"><strong>¿Necesitas cancelar o reportar un problema?</strong><p style="margin:8px 0 14px">Puedes gestionar las opciones disponibles para este pedido desde un enlace seguro. Las cancelaciones solo están disponibles antes de que el pedido salga a entrega.</p><a href="${escapeHtml((process.env.URL||'https://myraices.com')+'/manage-order.html?token='+order.manage_token)}" style="display:inline-block;padding:11px 18px;background:#174f45;color:#fff;text-decoration:none;border-radius:999px;font-weight:700">Gestionar pedido</a></div>` : ''}</div></body></html>`;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({ sender: { name: senderName, email: senderEmail }, to: [{ email: order.customer_email, name: order.customer_name || order.customer_email }], subject: `Pedido #${order.order_number || ''} confirmado`, htmlContent })
  });
  if (!res.ok) throw new Error(`BREVO_CONFIRMATION_${res.status}:${await res.text()}`);
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

async function getSquareOrderAmounts(squareOrderId) {
  if (!squareOrderId) return null;
  const environment = String(process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase();
  const squareBase = environment === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';
  const res = await fetch(`${squareBase}/v2/orders/${encodeURIComponent(squareOrderId)}`, {
    headers: { Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`, 'Square-Version': '2026-07-15' }
  });
  if (!res.ok) return null;
  const data = await res.json();
  const sq = data.order || {};
  return {
    taxCents: Number(sq.total_tax_money?.amount || sq.net_amounts?.tax_money?.amount || 0),
    totalCents: Number(sq.total_money?.amount || sq.net_amounts?.total_money?.amount || 0)
  };
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
    const refundedCents = Number(payment.refunded_money?.amount || 0);
    const hasRefund = refundedCents > 0;
    const completed = squareStatus === 'COMPLETED';
    const failed = squareStatus === 'FAILED' || squareStatus === 'CANCELED';

    // Square keeps the payment itself as COMPLETED after a refund and emits another
    // payment.updated event. That event must never mark the NURAI order as paid again.
    // The refund is recorded by NURAI's refund function; this webhook only ignores the
    // post-refund payment update so it cannot overwrite cancelled/refunded states.
    if (hasRefund) {
      console.log('square-webhook ignored refunded payment update', {
        orderId: order.id,
        paymentId: payment.id,
        refundedCents,
        squareStatus
      });
      return { statusCode: 200, headers: JSON_HEADERS, body: 'Refund update ignored' };
    }

    if (completed) {
      const finalAmounts = await getSquareOrderAmounts(payment.order_id);
      if (finalAmounts && finalAmounts.totalCents > 0) {
        await supabasePatch(order.id, {
          tax_amount: finalAmounts.taxCents / 100,
          tax_cents: finalAmounts.taxCents,
          total_amount: finalAmounts.totalCents / 100,
          total_cents: finalAmounts.totalCents,
          updated_at: new Date().toISOString()
        });
      }
      const wasAlreadyPaid =
        String(order.status || '').toLowerCase() === 'paid' ||
        String(order.payment_status || '').toLowerCase() === 'completed' ||
        Boolean(order.inventory_deducted_at) ||
        Boolean(order.paid_at);
      if (!wasAlreadyPaid) {
        // Atomic database operation: marks paid and deducts stock once, even if Square retries the webhook.
        const paidAt = payment.updated_at || payment.created_at || new Date().toISOString();
        console.log('[square-webhook] complete_order:start', { orderId: order.id, paymentId: payment.id });
        await completePaidOrder(order.id, payment.id || null, paidAt);
        console.log('[square-webhook] complete_order:finish', { orderId: order.id });
      } else {
        console.log('[square-webhook] complete_order:already_paid', { orderId: order.id, paymentId: payment.id });
      }
      let paidOrder = await supabaseGetOrderDetails(order.id);
      const digitalEntitlements = await ensureDigitalEntitlements(paidOrder);
      if (paidOrder?.fulfillment_type === 'digital') {
        await completeDigitalOrder(paidOrder);
        paidOrder = await supabaseGetOrderDetails(order.id);
      }
      console.log('[square-webhook] notification:start', { orderId: order.id });
      await createOrderNotification(paidOrder);
      console.log('[square-webhook] notification:finish', { orderId: order.id });
      if (!paidOrder?.confirmation_email_sent_at) {
        console.log('[square-webhook] confirmation_email:start', { orderId: order.id });
        await sendOrderConfirmation(paidOrder, digitalEntitlements);
        await supabasePatch(order.id, { confirmation_email_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        console.log('[square-webhook] confirmation_email:finish', { orderId: order.id });
      } else {
        console.log('[square-webhook] confirmation_email:already_sent', { orderId: order.id });
      }
    } else {
      // Square can deliver payment.created/payment.updated events out of order.
      // Once an order is paid, completed or has already deducted inventory, it must never
      // be downgraded to pending/cancelled by a delayed intermediate webhook.
      const alreadyPaid =
        String(order.status || '').toLowerCase() === 'paid' ||
        String(order.payment_status || '').toLowerCase() === 'completed' ||
        Boolean(order.inventory_deducted_at) ||
        Boolean(order.paid_at);

      if (alreadyPaid) {
        console.log('square-webhook ignored delayed non-completed event for paid order', {
          orderId: order.id,
          paymentId: payment.id,
          squareStatus
        });
        return { statusCode: 200, headers: JSON_HEADERS, body: 'Already paid' };
      }

      const values = {
        status: failed ? 'cancelled' : 'pending_payment',
        payment_status: failed ? 'failed' : 'pending',
        square_payment_id: payment.id || null,
        updated_at: new Date().toISOString()
      };
      await supabasePatch(order.id, values);
    }
    return { statusCode: 200, headers: JSON_HEADERS, body: 'OK' };
  } catch (err) {
    console.error('square-webhook', err);
    return { statusCode: 500, headers: JSON_HEADERS, body: 'Webhook error' };
  }
};
