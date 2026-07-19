
function validHumanName(value) {
  const name = String(value || "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60) return false;
  if (!/^[\p{L}][\p{L}\p{M}'’.-]*(?: [\p{L}][\p{L}\p{M}'’.-]*)*$/u.test(name)) return false;
  const letters = name.toLocaleLowerCase().replace(/[^\p{L}]/gu, "");
  if (/(.)\1{4,}/u.test(letters)) return false;
  if (letters.length >= 10 && !/[aeiouáéíóúü]/u.test(letters)) return false;
  if (letters.length >= 14 && /[^aeiouáéíóúüy]{8,}/u.test(letters)) return false;
  return true;
}

async function verifyTurnstile(event, token, action) {
  const secret = String(process.env.TURNSTILE_SECRET_KEY || "").trim();
  if (!secret) throw new Error("TURNSTILE_SECRET_KEY no está configurada en Netlify.");
  if (!token) return false;
  const params = new URLSearchParams();
  params.set("secret", secret);
  params.set("response", token);
  const clientIp = event.headers["x-nf-client-connection-ip"] || event.headers["x-forwarded-for"];
  if (clientIp) params.set("remoteip", String(clientIp).split(",")[0].trim());
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });
  const result = await response.json();
  return Boolean(result.success && (!result.action || result.action === action));
}

async function syncBrevoInternally(event, payload) {
  const secret = String(process.env.TURNSTILE_SECRET_KEY || "").trim();
  const configuredBase = String(process.env.URL || process.env.DEPLOY_PRIME_URL || "").replace(/\/$/, "");
  const host = String(event.headers.host || "").trim();
  const protocol = String(event.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const baseUrl = configuredBase || (host ? `${protocol}://${host}` : "");
  if (!baseUrl || !secret) return { ok: false, skipped: true };
  try {
    const response = await fetch(`${baseUrl}/.netlify/functions/brevo-subscribe`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-raices-internal-secret": secret
      },
      body: JSON.stringify(payload)
    });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    console.error("Internal Brevo sync failed", error);
    return { ok: false, error: error.message };
  }
}

exports.handler = async function(event) {
  const corsHeaders = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "POST, OPTIONS"
  };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ message: "Method not allowed" }) };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const email = String(payload.email || "").trim().toLowerCase();
    const name = String(payload.name || "").trim();
    const source = String(payload.source || "website").trim();
    const language = String(payload.language || "es").trim().slice(0, 8);
    const userId = payload.user_id || null;
    const cart = payload.cart || null;
    const delivery = cart && cart.delivery ? cart.delivery : {};
    const customer = cart && cart.customer ? cart.customer : {};
    const product = payload.product || null;
    const protectedSource = source === "waitlist" || source === "checkout_waitlist" || source === "product_back_in_stock" || source === "newsletter" || source === "newsletter_section";

    if (protectedSource) {
      if (String(payload.honeypot || "").trim()) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: "Invalid submission." }) };
      }
      if (!validHumanName(name)) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: "Nombre inválido." }) };
      }
      const verificationAction = source === "newsletter" || source === "newsletter_section" ? "newsletter" : "waitlist";
      const verified = await verifyTurnstile(event, String(payload.turnstile_token || "").trim(), verificationAction);
      if (!verified) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ message: "Verificación de seguridad inválida." }) };
      }
    }

    if (!email || !email.includes("@")) {
      return { statusCode: 400, body: JSON.stringify({ message: "Email inválido." }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://tqtnffinhqbyesjdollk.supabase.co";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return { statusCode: 500, body: JSON.stringify({ message: "SUPABASE_SERVICE_ROLE_KEY no está configurada en Netlify." }) };
    }

    if (source === "product_back_in_stock" && product && product.sku) {
      const sku = String(product.sku).trim();
      const productName = String(product.name || sku).trim();
      const waitlistRecord = {
        product_id: product.id || null,
        sku,
        product_name: productName,
        email,
        name: name || null,
        language,
        status: "pending",
        last_requested_at: new Date().toISOString(),
        source: "website",
        metadata: payload
      };
      const existingResponse = await fetch(`${supabaseUrl}/rest/v1/stock_waitlist?email=eq.${encodeURIComponent(email)}&sku=eq.${encodeURIComponent(sku)}&status=eq.pending&select=id`, {
        headers: { "apikey": serviceRoleKey, "authorization": `Bearer ${serviceRoleKey}` }
      });
      const existing = existingResponse.ok ? await existingResponse.json() : [];
      const endpoint = existing.length ? `${supabaseUrl}/rest/v1/stock_waitlist?id=eq.${existing[0].id}` : `${supabaseUrl}/rest/v1/stock_waitlist`;
      const method = existing.length ? "PATCH" : "POST";
      const waitlistResponse = await fetch(endpoint, {
        method,
        headers: { "apikey": serviceRoleKey, "authorization": `Bearer ${serviceRoleKey}`, "content-type": "application/json", "prefer": "return=representation" },
        body: JSON.stringify(waitlistRecord)
      });
      if (!waitlistResponse.ok) return { statusCode: waitlistResponse.status, headers: corsHeaders, body: JSON.stringify({ message: await waitlistResponse.text() }) };
      const brevo = await syncBrevoInternally(event, { email, name, source, language, consent: true, product, cart });
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ message: existing.length ? "Updated" : "Saved", duplicate: Boolean(existing.length), brevo }) };
    }

    const record = {
      source,
      status: source === "checkout_waitlist" ? "checkout_waitlist" : "newsletter",
      user_id: userId,
      email,
      name: name || customer.name || null,
      phone: customer.phone || null,
      address: customer.address || null,
      apt: customer.apt || null,
      city: customer.city || null,
      zip: delivery.zip || null,
      delivery_zone: delivery.zone || null,
      delivery_cost: cart && typeof cart.deliveryCost === "number" ? cart.deliveryCost : null,
      subtotal: cart && typeof cart.subtotal === "number" ? cart.subtotal : null,
      total: cart && typeof cart.total === "number" ? cart.total : null,
      cart: cart || null,
      payload,
      language
    };

    const response = await fetch(`${supabaseUrl}/rest/v1/raices_interests`, {
      method: "POST",
      headers: {
        "apikey": serviceRoleKey,
        "authorization": `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
        "prefer": "return=representation"
      },
      body: JSON.stringify(record)
    });

    if (!response.ok) {
      const text = await response.text();
      return { statusCode: response.status, body: JSON.stringify({ message: text || "Supabase error." }) };
    }

    const data = await response.json().catch(() => []);
    const brevo = await syncBrevoInternally(event, { email, name: name || customer.name || "", source, language, consent: true, cart, product });
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ message: "Saved", data, brevo }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
  }
};
