function json(statusCode, body) {
  return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(body) };
}

const localeOf = (value) => String(value || "es").toLowerCase().startsWith("en") ? "en" : "es";

async function syncBrevo(event, payload) {
  const secret = String(process.env.TURNSTILE_SECRET_KEY || "").trim();
  const configuredBase = String(process.env.URL || process.env.DEPLOY_PRIME_URL || "").replace(/\/$/, "");
  const host = String(event.headers.host || "").trim();
  const protocol = String(event.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const baseUrl = configuredBase || (host ? `${protocol}://${host}` : "");
  if (!secret || !baseUrl) return { ok: false, skipped: true };
  const response = await fetch(`${baseUrl}/.netlify/functions/brevo-subscribe`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-raices-internal-secret": secret },
    body: JSON.stringify(payload)
  });
  return { ok: response.ok, status: response.status, body: await response.json().catch(() => ({})) };
}

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://tqtnffinhqbyesjdollk.supabase.co";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) return json(500, { message: "SUPABASE_SERVICE_ROLE_KEY no está configurada." });

    const raw = event.headers.authorization || event.headers.Authorization || "";
    const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : "";
    if (!token) return json(401, { message: "Sesión requerida." });

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: serviceRoleKey, authorization: `Bearer ${token}` } });
    if (!userResponse.ok) return json(401, { message: "Sesión inválida." });
    const user = await userResponse.json();
    if (!user?.email) return json(400, { message: "Usuario sin email." });

    const payload = JSON.parse(event.body || "{}");
    const reason = payload.reason === "confirmed_user" ? "confirmed_user" : "profile_update";
    const email = String(user.email).trim().toLowerCase();
    const meta = user.user_metadata || {};
    const language = localeOf(payload.language || meta.preferred_language || meta.language);
    const name = String(payload.name || meta.full_name || meta.name || meta.first_name || "").trim();
    const metadataConsent = meta.marketing_consent === true;
    const metadataConsentAt = String(meta.marketing_consent_at || "").trim();

    const lookup = await fetch(`${supabaseUrl}/rest/v1/marketing_subscribers?email=ilike.${encodeURIComponent(email)}&select=*&limit=1`, {
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` }
    });
    if (!lookup.ok) return json(500, { message: await lookup.text() });
    const rows = await lookup.json();
    const existing = Array.isArray(rows) ? rows[0] : null;

    const explicitConsentIsNewer = Boolean(
      metadataConsent && metadataConsentAt &&
      (!existing?.unsubscribed_at || new Date(metadataConsentAt) > new Date(existing.unsubscribed_at))
    );
    const maySubscribe = existing?.status === "subscribed" || (reason === "confirmed_user" && explicitConsentIsNewer);
    if (!maySubscribe) return json(200, { message: "Marketing sync skipped: no active consent.", subscribed: false });

    const now = new Date().toISOString();
    const record = {
      email,
      user_id: user.id,
      name: name || existing?.name || null,
      preferred_language: language,
      status: "subscribed",
      consent_source: existing?.consent_source || "signup",
      consent_at: existing?.status === "subscribed" ? existing.consent_at : (metadataConsentAt || now),
      unsubscribed_at: null,
      updated_at: now
    };
    const endpoint = existing ? `${supabaseUrl}/rest/v1/marketing_subscribers?id=eq.${existing.id}` : `${supabaseUrl}/rest/v1/marketing_subscribers`;
    const write = await fetch(endpoint, {
      method: existing ? "PATCH" : "POST",
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify(record)
    });
    if (!write.ok) return json(500, { message: await write.text() });

    const brevo = await syncBrevo(event, {
      email, name, source: reason, consent: true, marketingConsent: true, language,
      accountCreatedAt: meta.account_created_at || user.created_at || "",
      emailVerified: Boolean(user.email_confirmed_at),
      marketingConsentAt: record.consent_at,
      totalOrders: Number(payload.totalOrders || 0),
      firstOrderCompleted: Number(payload.totalOrders || 0) > 0,
      firstOrderDate: payload.firstOrderDate || ""
    });

    await fetch(`${supabaseUrl}/rest/v1/marketing_subscribers?email=ilike.${encodeURIComponent(email)}`, {
      method: "PATCH",
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, "content-type": "application/json" },
      body: JSON.stringify({ last_synced_brevo_at: brevo.ok ? now : existing?.last_synced_brevo_at || null, updated_at: now })
    });

    return json(200, { message: "Marketing profile synced", subscribed: true, brevo });
  } catch (error) {
    console.error("marketing-profile-sync", error);
    return json(500, { message: error.message || "Unexpected error" });
  }
};
