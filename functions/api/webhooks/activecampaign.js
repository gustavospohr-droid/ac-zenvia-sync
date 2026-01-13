export async function onRequest(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const sig = url.searchParams.get("sig");
  const debug = url.searchParams.get("debug") === "1";
  const expected = env.WEBHOOK_SIG;

  const json = (obj, status = 200, extraHeaders = {}) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json", ...extraHeaders },
    });

  if (!expected) return json({ error: "Missing WEBHOOK_SIG in environment variables" }, 500);
  if (!sig || sig !== expected) return json({ error: "Unauthorized" }, 401);
  if (request.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

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
    return json({ error: "Invalid payload", detail: String(e) }, 400);
  }

  const keysCount = Object.keys(payload || {}).length;

  const contactId =
    payload["contact[id]"] ||
    payload["contact_id"] ||
    payload["id"] ||
    "";

  const email =
    payload["contact[email]"] ||
    payload["email"] ||
    "";

  // Header curto (limite prático: mantenha bem pequeno)
  const debugHeader = debug
    ? `contactId=${String(contactId).slice(0, 40)};email=${String(email).slice(0, 60)};keys=${keysCount}`
    : "";

  const extra = debug ? { "x-ac-debug": debugHeader } : {};

  return json({ received: true }, 200, extra);
}
