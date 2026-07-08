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
    const userId = payload.user_id || null;
    const cart = payload.cart || null;
    const delivery = cart && cart.delivery ? cart.delivery : {};
    const customer = cart && cart.customer ? cart.customer : {};

    if (!email || !email.includes("@")) {
      return { statusCode: 400, body: JSON.stringify({ message: "Email inválido." }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL || "https://tqtnffinhqbyesjdollk.supabase.co";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return { statusCode: 500, body: JSON.stringify({ message: "SUPABASE_SERVICE_ROLE_KEY no está configurada en Netlify." }) };
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
    return { statusCode: 200, body: JSON.stringify({ message: "Saved", data }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
  }
};
