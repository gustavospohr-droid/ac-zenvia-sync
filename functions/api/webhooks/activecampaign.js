export async function onRequest(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const sig = url.searchParams.get("sig");
  const debug = url.searchParams.get("debug") === "1";
  const expected = env.WEBHOOK_SIG;

  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  // Segurança
  if (!expected) return json({ error: "Missing WEBHOOK_SIG in environment variables" }, 500);
  if (!sig || sig !== expected) return json({ error: "Unauthorized" }, 401);

  // Webhook só aceita POST
  if (request.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  // Ler payload
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

  // Extrair identificadores comuns do AC
  const contactId =
    payload["contact[id]"] ||
    payload["contact_id"] ||
    payload["id"] ||
    null;

  const email =
    payload["contact[email]"] ||
    payload["email"] ||
    null;

  // Debug: devolve resumo + amostra de chaves
  if (debug) {
    const keys = Object.keys(payload || {});
    return json({
      received: true,
      debug: true,
      contentType,
      contactId,
      email,
      keysCount: keys.length,
      keysSample: keys.slice(0, 60),
      // (Opcional) para depuração inicial; depois podemos remover:
      payloadSample: Object.fromEntries(
        keys.slice(0, 20).map((k) => [k, payload[k]])
      ),
    });
  }

  // Normal: resposta mínima
  return json({ received: true });
}
