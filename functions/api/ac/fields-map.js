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
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  const u = new URL(request.url);
  const limit = Math.min(Number(u.searchParams.get("limit") || "200"), 200);
  const offset = Number(u.searchParams.get("offset") || "0");

  try {
    const res = await acGet(env, `/api/3/fields?limit=${limit}&offset=${offset}`);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch fields", status: res.status, body: res.body }, null, 2), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const fields = res.body.fields || [];
    const map = {};
    for (const f of fields) {
      // id -> title (e também "perstag" quando existir)
      map[String(f.id)] = { title: f.title, perstag: f.perstag || null, type: f.type || null };
    }

    return new Response(JSON.stringify({ count: fields.length, offset, limit, map }, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Failed to load fields-map", detail: String(e) }, null, 2), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
