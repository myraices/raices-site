function json(statusCode, body) {
  return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(body) };
}
const localeOf = (value) => String(value || "es").toLowerCase().startsWith("en") ? "en" : "es";

async function getUser(event, supabaseUrl, serviceRoleKey) {
  const raw = event.headers.authorization || event.headers.Authorization || "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : "";
  if (!token) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: serviceRoleKey, authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  return response.json();
}

exports.handler = async function(event) {
  if (!["GET","POST"].includes(event.httpMethod)) return json(405, { message: "Method not allowed" });
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://tqtnffinhqbyesjdollk.supabase.co";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const apiKey = process.env.BREVO_API_KEY;
    if (!serviceRoleKey) return json(500, { message: "SUPABASE_SERVICE_ROLE_KEY no está configurada." });
    if (!apiKey) return json(500, { message: "BREVO_API_KEY no está configurada." });

    const user = await getUser(event, supabaseUrl, serviceRoleKey);
    if (!user?.email) return json(401, { message: "Sesión inválida." });
    const email = String(user.email).trim().toLowerCase();
    const lookup = await fetch(`${supabaseUrl}/rest/v1/marketing_subscribers?email=ilike.${encodeURIComponent(email)}&select=*&limit=1`, { headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` } });
    if (!lookup.ok) return json(500, { message: await lookup.text() });
    const rows = await lookup.json();
    const existing = Array.isArray(rows) ? rows[0] : null;

    if (event.httpMethod === "GET") {
      return json(200, {
        email,
        subscribed: existing?.status === "subscribed",
        status: existing?.status || "not_subscribed",
        preferred_language: existing?.preferred_language || localeOf(user.user_metadata?.preferred_language || user.user_metadata?.language),
        consent_source: existing?.consent_source || null,
        consent_at: existing?.consent_at || null,
        unsubscribed_at: existing?.unsubscribed_at || null,
      });
    }

    const body = JSON.parse(event.body || "{}");
    const subscribe = body.subscribed === true;
    const now = new Date().toISOString();
    const meta = user.user_metadata || {};
    const language = localeOf(body.language || meta.preferred_language || meta.language);
    const name = String(body.name || [meta.first_name, meta.last_name].filter(Boolean).join(" ") || meta.full_name || meta.name || "").trim();
    const listId = Number(process.env.BREVO_LIST_ID || process.env.RAICES_BREVO_LIST_ID || 2);

    if (subscribe) {
      const record = {
        email, user_id: user.id, name: name || existing?.name || null, status: "subscribed", preferred_language: language,
        consent_source: existing?.consent_source || "account_preferences", consent_at: now, unsubscribed_at: null, updated_at: now
      };
      const write = await fetch(existing ? `${supabaseUrl}/rest/v1/marketing_subscribers?id=eq.${existing.id}` : `${supabaseUrl}/rest/v1/marketing_subscribers`, {
        method: existing ? "PATCH" : "POST",
        headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, "content-type": "application/json", prefer: "return=representation" },
        body: JSON.stringify(record)
      });
      if (!write.ok) return json(500, { message: await write.text() });

      const brevo = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}?identifierType=email_id`, {
        method: "PUT", headers: { accept: "application/json", "content-type": "application/json", "api-key": apiKey },
        body: JSON.stringify({ emailBlacklisted: false, listIds: [listId], attributes: { FIRSTNAME: name || undefined, LOCALE: language, SOURCE: existing?.consent_source || "account_preferences", MARKETING_CONSENT: true, MARKETING_CONSENT_AT: now.slice(0,10) } })
      });
      if (brevo.status === 404) {
        const create = await fetch("https://api.brevo.com/v3/contacts", {
          method: "POST", headers: { accept: "application/json", "content-type": "application/json", "api-key": apiKey },
          body: JSON.stringify({ email, updateEnabled: true, listIds: [listId], attributes: { FIRSTNAME: name || undefined, LOCALE: language, SOURCE: "account_preferences", MARKETING_CONSENT: true, MARKETING_CONSENT_AT: now.slice(0,10) } })
        });
        if (!create.ok) return json(502, { message: `Brevo: ${await create.text()}` });
      } else if (!brevo.ok) return json(502, { message: `Brevo: ${await brevo.text()}` });

      await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
        method: "PUT", headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, "content-type": "application/json" },
        body: JSON.stringify({ user_metadata: { ...meta, marketing_consent: true, marketing_consent_at: now, preferred_language: language, language } })
      });
      await fetch(`${supabaseUrl}/rest/v1/marketing_subscribers?email=ilike.${encodeURIComponent(email)}`, { method:"PATCH", headers:{apikey:serviceRoleKey,authorization:`Bearer ${serviceRoleKey}`,"content-type":"application/json"}, body:JSON.stringify({last_synced_brevo_at:now,updated_at:now}) });
      return json(200, { subscribed: true, status: "subscribed", consent_at: now, preferred_language: language });
    }

    if (existing) {
      const write = await fetch(`${supabaseUrl}/rest/v1/marketing_subscribers?id=eq.${existing.id}`, {
        method: "PATCH", headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, "content-type": "application/json" },
        body: JSON.stringify({ status: "unsubscribed", unsubscribed_at: now, updated_at: now })
      });
      if (!write.ok) return json(500, { message: await write.text() });
    }

    const brevo = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}?identifierType=email_id`, {
      method: "PUT", headers: { accept: "application/json", "content-type": "application/json", "api-key": apiKey },
      body: JSON.stringify({ emailBlacklisted: true, unlinkListIds: [listId], attributes: { MARKETING_CONSENT: false } })
    });
    if (!brevo.ok && brevo.status !== 404) return json(502, { message: `Brevo: ${await brevo.text()}` });

    await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
      method: "PUT", headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, "content-type": "application/json" },
      body: JSON.stringify({ user_metadata: { ...meta, marketing_consent: false, preferred_language: language, language } })
    });
    return json(200, { subscribed: false, status: "unsubscribed", unsubscribed_at: now, preferred_language: language });
  } catch (error) {
    console.error("marketing-preferences", error);
    return json(500, { message: error.message || "Unexpected error" });
  }
};
