async function acGet(env, path, timeoutMs = 20000) {
  const baseUrl = (env.AC_API_URL || "").replace(/\/$/, "");
  const token = env.AC_API_TOKEN;

  if (!baseUrl || !token) {
    throw new Error("Missing AC_API_URL or AC_API_TOKEN");
  }

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
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }

    return { ok: res.ok, status: res.status, url, body };
  } finally {
    clearTimeout(t);
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  const u = new URL(request.url);
  const id = u.searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Chamadas em sequência para reduzir chance de timeout
  try {
    const contact = await acGet(env, `/api/3/contacts/${encodeURIComponent(id)}`);
    const fieldValues = await acGet(env, `/api/3/contacts/${encodeURIComponent(id)}/fieldValues`);
    const contactLists = await acGet(env, `/api/3/contacts/${encodeURIComponent(id)}/contactLists`);

    return new Response(
      JSON.stringify(
        {
          contact: contact.body,
          fieldValues: fieldValues.body,
          contactLists: contactLists.body,
          meta: {
            contactStatus: contact.status,
            fieldValuesStatus: fieldValues.status,
            contactListsStatus: contactLists.status,
          },
        },
        null,
        2
      ),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify(
        {
          error: "Failed to load contact-full",
          detail: String(e),
          hint: "If you still get AbortError, we can increase timeout or fetch only one resource at a time.",
        },
        null,
        2
      ),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
