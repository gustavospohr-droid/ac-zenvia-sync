export async function onRequest(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const sig = url.searchParams.get("sig");
  const debug = url.searchParams.get("debug") === "1";
  const expected = env.WEBHOOK_SIG;

  if (!expected) {
    return new Response(
      JSON.stringify({ error: "Missing WEBHOOK_SIG in environment variables" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!sig || sig !== expected) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  const contentType = request.headers.get("content-type") || "";
  let payload = {};

  try {
    if (contentType.includes("application/json")) {
      payload = await request.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      payload = Object.fromEntries(new URLSearchParams(text));
    } else {
      const text = await request.text();
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text };
      }
    }
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Invalid payload", detail: String(e) }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Extrair campos comuns (AC costuma mandar form-urlencoded com chaves "contact[id]")
  const contactId =
    payload["contact[id]"] ||
    payload["contact_id"] ||
    payload["id"] ||
    null;

  const email =
    payload["contact[email]"] ||
    payload["email"] ||
    null;

  const pick = (obj, keys) => {
    const out = {};
    for (const k of keys) if (obj && k in obj) out[k] = obj[k];
    return out;
  };

  if (debug) {
    const keys = Object.keys(payload || {}).slice(0, 200); // limita para não explodir
    return new Response(
      JSON.stringify({
        received: true,
        debug: true,
        contentType,
        keys,
        highlights: {
          contactId,
          email,
          topLevel: pick(payload, ["type", "event", "action", "date_time", "initiated_from"])
        }
      }, null, 2),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ received: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
