const ALLOWED_ACTIONS = new Set(["signup", "password_reset", "waitlist"]);

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "method_not_allowed" });
  }

  const secret = String(process.env.TURNSTILE_SECRET_KEY || "").trim();
  if (!secret) {
    console.error("TURNSTILE_SECRET_KEY is not configured.");
    return json(500, { ok: false, error: "server_not_configured" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  const token = String(payload.token || "").trim();
  const action = String(payload.action || "").trim();
  if (!token || !ALLOWED_ACTIONS.has(action)) {
    return json(400, { ok: false, error: "missing_or_invalid_fields" });
  }

  const params = new URLSearchParams();
  params.set("secret", secret);
  params.set("response", token);
  const clientIp = event.headers["x-nf-client-connection-ip"] || event.headers["x-forwarded-for"];
  if (clientIp) params.set("remoteip", String(clientIp).split(",")[0].trim());

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const result = await response.json();
    const actionMatches = !result.action || result.action === action;

    if (!result.success || !actionMatches) {
      console.warn("Turnstile verification rejected", {
        action,
        returnedAction: result.action,
        errors: result["error-codes"] || [],
      });
      return json(403, {
        ok: false,
        error: "verification_failed",
        codes: result["error-codes"] || [],
      });
    }

    return json(200, { ok: true });
  } catch (error) {
    console.error("Turnstile verification error", error);
    return json(502, { ok: false, error: "verification_unavailable" });
  }
};
