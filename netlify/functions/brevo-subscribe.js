exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ message: "Method not allowed" }) };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const email = String(payload.email || "").trim().toLowerCase();
    const name = String(payload.name || "").trim();
    const source = String(payload.source || "website").trim();
    const language = String(payload.language || "es").trim().slice(0, 8);
    const consent = Boolean(payload.consent || source === "checkout_waitlist");

    if (!email || !email.includes("@")) {
      return { statusCode: 400, body: JSON.stringify({ message: "Email inválido." }) };
    }
    if (!consent) {
      return { statusCode: 400, body: JSON.stringify({ message: "Consentimiento requerido." }) };
    }

    const apiKey = process.env.BREVO_API_KEY;
    const listId = Number(process.env.BREVO_LIST_ID);

    if (!apiKey || !listId) {
      return { statusCode: 500, body: JSON.stringify({ message: "Brevo no está configurado todavía." }) };
    }

    // Keep attributes minimal so the function works even if custom Brevo
    // attributes like SOURCE or LANGUAGE have not been created yet.
    const attributes = {};
    if (name) attributes.FIRSTNAME = name;

    const response = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": apiKey
      },
      body: JSON.stringify({
        email,
        listIds: [listId],
        updateEnabled: true,
        attributes
      })
    });

    if (!response.ok && response.status !== 204) {
      const text = await response.text();
      return { statusCode: response.status, body: JSON.stringify({ message: text || "Brevo error." }) };
    }

    return { statusCode: 200, body: JSON.stringify({ message: "Subscribed" }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
  }
};
