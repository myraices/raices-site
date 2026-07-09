exports.handler = async function(event) {
  const corsHeaders = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ message: "Method not allowed" }) };

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function money(value) {
    const n = Number(value || 0);
    return `$${n.toFixed(2)}`;
  }

  function cartItems(cart) {
    if (!cart || !Array.isArray(cart.items)) return [];
    return cart.items.map((item) => ({
      name: item.name || item.title || item.productName || item.sku || "Producto Raíces",
      qty: item.qty || item.quantity || 1,
      variant: item.variant || item.option || item.selectedOption || "",
      price: Number(item.price || item.unitPrice || 0)
    }));
  }

  function summarizeCart(cart) {
    const items = cartItems(cart);
    if (!items.length) return "";
    return items.slice(0, 5).map((i) => `${i.qty}x ${i.name}${i.variant ? ` (${i.variant})` : ""}`).join(" · ").slice(0, 250);
  }

  function waitlistEmailHtml({ language, name, cart }) {
    const isEs = String(language || "es").toLowerCase().startsWith("es");
    const firstName = name ? escapeHtml(name.split(" ")[0]) : "";
    const items = cartItems(cart);
    const lines = items.map((item) => `<li><strong>${escapeHtml(item.name)}</strong>${item.variant ? ` — ${escapeHtml(item.variant)}` : ""}<br/>Cantidad: ${escapeHtml(item.qty)}${item.price ? ` · ${money(item.price)}` : ""}</li>`).join("");
    const subtotal = cart && typeof cart.subtotal === "number" ? cart.subtotal : null;
    const deliveryCost = cart && typeof cart.deliveryCost === "number" ? cart.deliveryCost : null;
    const total = cart && typeof cart.total === "number" ? cart.total : null;
    const zone = cart && cart.delivery && cart.delivery.zone ? cart.delivery.zone : "";
    const title = isEs ? "Tu interés quedó registrado" : "Your request was saved";
    const intro = isEs
      ? `Gracias${firstName ? `, ${firstName}` : ""}. Recibimos tu solicitud para avisarte cuando abramos pedidos.`
      : `Thank you${firstName ? `, ${firstName}` : ""}. We received your request to notify you when ordering opens.`;
    const bodyText = isEs
      ? "En cuanto estemos listos con empaques y apertura oficial, recibirás un correo con prioridad para completar tu compra."
      : "As soon as packaging and our official opening are ready, you will receive priority access to complete your purchase.";
    const cartBlock = lines ? `
      <div style="margin-top:22px;padding:18px;border:1px solid #e1d6c6;border-radius:18px;background:#fffaf2">
        <p style="margin:0 0 10px;font-weight:700;color:#20351f">${isEs ? "Tu selección" : "Your selection"}</p>
        <ul style="padding-left:20px;margin:0;color:#44503f;line-height:1.6">${lines}</ul>
        ${subtotal !== null ? `<p style="margin:14px 0 0;color:#44503f">Subtotal: <strong>${money(subtotal)}</strong></p>` : ""}
        ${deliveryCost !== null ? `<p style="margin:4px 0;color:#44503f">Delivery: <strong>${money(deliveryCost)}</strong>${zone ? ` · ${escapeHtml(zone)}` : ""}</p>` : ""}
        ${total !== null ? `<p style="margin:8px 0 0;font-size:18px;color:#20351f">Total estimado: <strong>${money(total)}</strong></p>` : ""}
      </div>` : "";

    return `<!doctype html><html><body style="margin:0;background:#f4ecdf;font-family:Arial,Helvetica,sans-serif;color:#20351f">
      <div style="max-width:640px;margin:0 auto;padding:32px 18px">
        <div style="background:#fffaf2;border:1px solid #e1d6c6;border-radius:28px;padding:34px">
          <p style="margin:0 0 12px;text-transform:uppercase;letter-spacing:.18em;font-size:12px;color:#a66c32;font-weight:700">Raíces</p>
          <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:38px;line-height:1;color:#20351f">${title}</h1>
          <p style="font-size:16px;line-height:1.7;color:#44503f;margin:0 0 12px">${intro}</p>
          <p style="font-size:16px;line-height:1.7;color:#44503f;margin:0">${bodyText}</p>
          ${cartBlock}
          <div style="margin-top:26px;padding-top:20px;border-top:1px solid #e1d6c6;color:#6a715f;font-size:13px;line-height:1.6">
            <p style="margin:0">Hecho con amor · Katy, Texas</p>
            <p style="margin:6px 0 0">myraices.com</p>
          </div>
        </div>
      </div>
    </body></html>`;
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const email = String(payload.email || "").trim().toLowerCase();
    const name = String(payload.name || "").trim();
    const source = String(payload.source || "website").trim();
    const language = String(payload.language || "es").trim().slice(0, 8);
    const consent = Boolean(payload.consent || source === "waitlist" || source === "checkout_waitlist" || source === "signup");
    const cart = payload.cart || null;
    const delivery = cart && cart.delivery ? cart.delivery : {};
    const customer = cart && cart.customer ? cart.customer : {};
    const normalizedSource = source === "newsletter_section" ? "newsletter" : (source === "checkout_waitlist" ? "waitlist" : source);

    if (!email || !email.includes("@")) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: "Email inválido." }) };
    }
    if (!consent) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: "Consentimiento requerido." }) };
    }

    const apiKey = process.env.BREVO_API_KEY;
    const listId = Number(process.env.BREVO_LIST_ID || process.env.RAICES_BREVO_LIST_ID || 2);
    const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.RAICES_FROM_EMAIL || "info@myraices.com";
    const senderName = process.env.BREVO_SENDER_NAME || "Raíces";

    if (!apiKey) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: "BREVO_API_KEY no está configurada en Netlify." }) };
    }

    const attributes = {
      SOURCE: normalizedSource,
      CUSTOMER: false,
      WAITLIST: normalizedSource === "waitlist"
    };
    if (name) attributes.FIRSTNAME = name;
    if (language) attributes._DETECTED_LANGUAGE = language;
    if (customer.city || delivery.city) attributes.CITY = String(customer.city || delivery.city).slice(0, 100);
    if (delivery.zip || customer.zip) attributes.ZIP = String(delivery.zip || customer.zip).slice(0, 20);
    const lastCart = summarizeCart(cart);
    if (lastCart) attributes.LAST_CART = lastCart;

    const contactResponse = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: { "accept": "application/json", "content-type": "application/json", "api-key": apiKey },
      body: JSON.stringify({ email, listIds: [listId], updateEnabled: true, attributes })
    });

    if (!contactResponse.ok && contactResponse.status !== 204) {
      const text = await contactResponse.text();
      return { statusCode: contactResponse.status, headers: corsHeaders, body: JSON.stringify({ message: text || "Brevo contact error." }) };
    }

    let emailSent = false;
    let emailWarning = null;
    if (normalizedSource === "waitlist") {
      try {
        const subject = String(language || "es").toLowerCase().startsWith("es") ? "Recibimos tu interés en Raíces" : "We received your Raíces request";
        const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "accept": "application/json", "content-type": "application/json", "api-key": apiKey },
          body: JSON.stringify({ sender: { name: senderName, email: senderEmail }, to: [{ email, name: name || email }], subject, htmlContent: waitlistEmailHtml({ language, name, cart }) })
        });
        if (!emailResponse.ok) emailWarning = await emailResponse.text();
        else emailSent = true;
      } catch (err) {
        emailWarning = err.message;
      }
    }

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ message: "Brevo synced", listId, emailSent, emailWarning }) };
  } catch (error) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ message: error.message }) };
  }
};
