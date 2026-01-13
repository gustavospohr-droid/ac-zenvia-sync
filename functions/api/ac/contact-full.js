async function acGetText(env, path, timeoutMs) {
  const baseUrl = (env.AC_API_URL || "").replace(/\/$/, "");
  const token = env.AC_API_TOKEN;
  if (!baseUrl || !token) throw new Error("Missing AC_API_URL or AC_API_TOKEN");

  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", "Api-Token": token },
      signal: controller.signal,
    });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
    return { ok: res.ok, status: res.status, url, body };
  } finally {
    clearTimeout(t);
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const u = new URL(request.url);
  const id = u.searchParams.get("id");

  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  if (!id) return json({ error: "Missing id" }, 400);

  try {
    // 1) Rápidos e essenciais
    const fieldValues = await acGetText(env, `/api/3/contacts/${encodeURIComponent(id)}/fieldValues`, 15000);
    const contactLists = await acGetText(env, `/api/3/contacts/${encodeURIComponent(id)}/contactLists`, 15000);

    // 2) Tentar pegar "contact base", mas sem travar o fluxo (pode ser pesado na sua conta)
    let contactBase = { ok: false, status: 0, url: null, body: null, skipped: true };
    try {
      contactBase = await acGetText(env, `/api/3/contacts/${encodeURIComponent(id)}`, 60000);
      contactBase.skipped = false;
    } catch (e) {
      contactBase = { ok: false, status: 0, url: `/api/3/contacts/${id}`, error: String(e), skipped: false };
    }

    return json({
      meta: {
        fieldValuesStatus: fieldValues.status,
        contactListsStatus: contactLists.status,
        contactBaseStatus: contactBase.status || null,
        contactBaseSkipped: contactBase.skipped === true,
      },
      // O que você de fato precisa para sincronizar:
      fieldValues: fieldValues.body,
      contactLists: contactLists.body,
      // Opcional (pode ser grande/lento):
      contactBase: contactBase.body,
    });
  } catch (e) {
    return json({ error: "Failed to load contact-full", detail: String(e) }, 502);
  }
}
