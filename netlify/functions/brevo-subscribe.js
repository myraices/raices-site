
exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ message: "Method not allowed" }) };
  }

  try {
    const { email } = JSON.parse(event.body || "{}");

    if (!email || !email.includes("@")) {
      return { statusCode: 400, body: JSON.stringify({ message: "Email inválido." }) };
    }

    const apiKey = process.env.BREVO_API_KEY;
    const listId = Number(process.env.BREVO_LIST_ID);

    if (!apiKey || !listId) {
      return { statusCode: 500, body: JSON.stringify({ message: "Brevo no está configurado todavía." }) };
    }

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
        attributes: { SOURCE: "myraices.com" }
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
