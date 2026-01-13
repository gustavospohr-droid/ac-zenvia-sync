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
    // 4) Logar payload (não retornar no response)
const safeHeaders = {
  "content-type": request.headers.get("content-type") || "",
  "user-agent": request.headers.get("user-agent") || ""
};

// Se payload veio "achatado" (form-urlencoded), ele pode ficar enorme.
// Vamos logar apenas campos-chave quando existirem.
const pick = (obj, keys) => {
  const out = {};
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
};

// Alguns webhooks do AC chegam como chaves tipo "contact[id]" em form-urlencoded.
// Vamos capturar o que for mais comum.
const highlights = {
  topLevel: pick(payload, ["type", "event", "action", "date_time", "initiated_from"]),
  contactId:
    payload["contact[id]"] ||
    payload["contact[id]".toString()] ||
    payload["contact_id"] ||
    payload["id"] ||
    null,
  email: payload["contact[email]"] || payload["email"] || null
};

console.log("AC_WEBHOOK_RECEIVED", {
  at: new Date().toISOString(),
  url: request.url,
  headers: safeHeaders,
  highlights,
  // ATENÇÃO: Para depuração inicial, vamos logar o payload completo.
  // Se tiver dados sensíveis, depois reduzimos.
  payload
});

return new Response(
  JSON.stringify({ received: true }),
  { status: 200, headers: { "Content-Type": "application/json" } }
);

  // 4) Por enquanto, só confirma recebimento (não integra ainda)
  // No próximo passo vamos chamar ActiveCampaign API e depois Zenvia.
  return new Response(
    JSON.stringify({ received: true, at: new Date().toISOString(), payload }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
