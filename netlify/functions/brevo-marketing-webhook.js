function json(statusCode, body) {
  return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(body) };
}

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") return json(405, { message: "Method not allowed" });
  try {
    const expected = String(process.env.BREVO_MARKETING_WEBHOOK_SECRET || "").trim();
    const supplied = String(event.queryStringParameters?.key || event.headers["x-raices-webhook-secret"] || "").trim();
    if (!expected || supplied !== expected) return json(401, { message: "Unauthorized webhook" });

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://tqtnffinhqbyesjdollk.supabase.co";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) return json(500, { message: "SUPABASE_SERVICE_ROLE_KEY no está configurada." });

    const payload = JSON.parse(event.body || "{}");
    const email = String(payload.email || payload.contact?.email || "").trim().toLowerCase();
    const eventName = String(payload.event || payload.type || "").trim().toLowerCase();
    if (!email || !email.includes("@")) return json(200, { ignored: true, reason: "No email" });

    const unsubscribeEvents = new Set(["unsubscribed", "unsubscribe", "spam", "complaint"]);
    if (!unsubscribeEvents.has(eventName)) return json(200, { ignored: true, event: eventName });

    const now = new Date().toISOString();
    const response = await fetch(`${supabaseUrl}/rest/v1/marketing_subscribers?email=ilike.${encodeURIComponent(email)}`, {
      method: "PATCH",
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify({ status: "unsubscribed", unsubscribed_at: now, updated_at: now })
    });
    if (!response.ok) return json(500, { message: await response.text() });
    const rows = await response.json().catch(() => []);
    return json(200, { updated: Array.isArray(rows) ? rows.length : 0, event: eventName });
  } catch (error) {
    console.error("brevo-marketing-webhook", error);
    return json(500, { message: error.message || "Unexpected error" });
  }
};
