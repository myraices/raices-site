const REVIEW_URL = 'https://g.page/r/CY9CP9FhFlv_EBM/review';

const copy = {
  es: {
    subject: '¿Cómo fue tu experiencia con Raíces?',
    message: 'Gracias por tu compra. Si te gustaría compartir tu experiencia, puedes dejar una reseña en Google.',
    button: 'Dejar una reseña en Google'
  },
  en: {
    subject: 'How was your experience with Raíces?',
    message: 'Thank you for your order. If you’d like to share your experience, you can leave a review on Google.',
    button: 'Leave a Google review'
  }
};

async function sendReview(order, apiKey, database) {
  const { subject, message, button } = copy[order.email_language];
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      sender: {
        name: process.env.BREVO_SENDER_NAME || 'Raíces',
        email: process.env.BREVO_SENDER_EMAIL || 'info@myraices.com'
      },
      to: [{ email: order.customer_email }],
      subject,
      htmlContent: `<html lang="${order.email_language}"><body><p>${message}</p><p><a href="${REVIEW_URL}">${button}</a></p><p>Raíces</p></body></html>`,
      textContent: `${message}\n\n${button}: ${REVIEW_URL}\n\nRaíces`
    })
  });
  if (!response.ok) throw new Error(`BREVO_REVIEW_${response.status}`);

  const filters = new URLSearchParams({
    id: `eq.${order.order_id}`,
    review_email_claimed_at: `eq.${order.claimed_at}`,
    review_email_sent_at: 'is.null',
    select: 'id'
  });
  const recorded = await database(`orders?${filters}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ review_email_sent_at: new Date().toISOString(), review_email_claimed_at: null })
  });
  if (recorded.length !== 1) throw new Error('REVIEW_EMAIL_DELIVERY_STATE_NOT_RECORDED');
  console.log('[review-email-scheduler] sent', { orderId: order.order_id });
}

exports.handler = async () => {
  if (process.env.GOOGLE_REVIEW_EMAILS_ENABLED !== 'true') {
    return { statusCode: 200, body: 'Review emails disabled' };
  }

  const apiKey = process.env.BREVO_API_KEY;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.SUPABASE_URL || 'https://tqtnffinhqbyesjdollk.supabase.co';
  if (!apiKey || !key) {
    console.error('[review-email-scheduler] Missing Brevo or Supabase configuration');
    return { statusCode: 500, body: 'Review email configuration missing' };
  }

  async function database(path, options) {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      ...options,
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...options.headers },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error(`SUPABASE_REVIEW_${response.status}`);
    return response.json();
  }

  try {
    const orders = await database('rpc/claim_due_review_emails', { method: 'POST', body: '{}' });
    const results = await Promise.allSettled(orders.map(order => sendReview(order, apiKey, database)));
    let failed = 0;
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failed += 1;
        console.error('[review-email-scheduler] failed', { orderId: orders[index].order_id, error: result.reason?.message });
      }
    });
    return { statusCode: failed ? 500 : 200, body: JSON.stringify({ sent: orders.length - failed, failed }) };
  } catch (error) {
    console.error('[review-email-scheduler] claim_failed', error.message);
    return { statusCode: 500, body: 'Could not get due review emails' };
  }
};
