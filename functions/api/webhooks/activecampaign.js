export async function onRequest(context) {
  const { request, env } = context;

  // 1) Segurança simples por querystring (ActiveCampaign não assina webhook nativamente)
  const url = new URL(request.url);
  const sig = url.searchParams.get("sig");
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

  // 2) Aceitar apenas POST (webhooks)
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  // 3) Ler payload (AC pode mandar x-www-form-urlencoded ou JSON)
  const contentType = request.headers.get("content-type") || "";
  let payload = {};

  try {
    if (contentType.includes("application/json")) {
      payload = await request.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      payload = Object.fromEntries(new URLSearchParams(text));
    } else {
      // fallback
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

  // 4) Por enquanto, só confirma recebimento (não integra ainda)
  // No próximo passo vamos chamar ActiveCampaign API e depois Zenvia.
  return new Response(
    JSON.stringify({ received: true, at: new Date().toISOString(), payload }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
