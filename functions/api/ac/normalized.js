async function acGet(env, path, timeoutMs = 20000) {
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
    return { ok: res.ok, status: res.status, body, url };
  } finally {
    clearTimeout(t);
  }
}

function buildFieldsMap(fieldsBody) {
  const map = {};
  const fields = fieldsBody.fields || [];
  for (const f of fields) {
    map[String(f.id)] = {
      title: (f.title || "").trim(),
      perstag: f.perstag || null,
      type: f.type || null,
    };
  }
  return map;
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
    // 1) Pegar listas e fieldValues (rápidos)
    const [fieldValuesRes, contactListsRes, fieldsRes] = await Promise.all([
      acGet(env, `/api/3/contacts/${encodeURIComponent(id)}/fieldValues`, 20000),
      acGet(env, `/api/3/contacts/${encodeURIComponent(id)}/contactLists`, 20000),
      acGet(env, `/api/3/fields?limit=200&offset=0`, 20000),
    ]);

    if (!fieldValuesRes.ok) return json({ error: "fieldValues failed", status: fieldValuesRes.status, body: fieldValuesRes.body }, 502);
    if (!contactListsRes.ok) return json({ error: "contactLists failed", status: contactListsRes.status, body: contactListsRes.body }, 502);
    if (!fieldsRes.ok) return json({ error: "fields failed", status: fieldsRes.status, body: fieldsRes.body }, 502);

    const fieldsMap = buildFieldsMap(fieldsRes.body);

    // 2) Normalizar custom fields por PERSTAG (fallback: title)
    const fieldValues = fieldValuesRes.body.fieldValues || [];
    const customFields = {};
    const customFieldsByTitle = {};

    for (const fv of fieldValues) {
      const fieldId = String(fv.field);
      const def = fieldsMap[fieldId] || {};
      const perstag = def.perstag || null;
      const title = def.title || fieldId;
      const value = fv.value;

      if (perstag) customFields[perstag] = value;
      customFieldsByTitle[title] = value;
    }

    // 3) Normalizar listas
    const contactLists = contactListsRes.body.contactLists || [];
    const lists = contactLists.map((cl) => ({
      listId: String(cl.list),
      status: String(cl.status), // 1 = subscribed, 2 = unsubscribed (AC convention)
      updated: cl.updated_timestamp || cl.udate || null,
    }));

    return json({
      contactId: String(id),
      lists,
      customFields,
      customFieldsByTitle,
      meta: {
        fieldValuesCount: fieldValues.length,
        listsCount: lists.length,
      },
    });
  } catch (e) {
    return json({ error: "Failed to normalize contact", detail: String(e) }, 502);
  }
}
