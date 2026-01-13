export async function onRequest(context) {
  const { request, env } = context;

  const u = new URL(request.url);
  const path = u.searchParams.get("path"); // exemplo: /api/3/contacts/521850
  const timeoutMs = Number(u.searchParams.get("timeoutMs") || "30000"); // default 30s

  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  if (!path || !path.startsWith("/")) {
    return json({ error: "Missing or invalid path. Must start with /" }, 400);
  }

  const baseUrl = (env.AC_API_URL || "").replace(/\/$/, "");
  const token = env.AC_API_TOKEN;

  if (!baseUrl || !token) {
    return json({ error: "Missing AC_API_URL or AC_API_TOKEN env vars" }, 500);
  }

  const fullUrl = `${baseUrl}${path}`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const startedAt = Date.now();

  try {
    const res = await fetch(fullUrl, {
      method: "GET",
      headers: { Accept: "application/json", "Api-Token": token },
      signal: controller.signal,
    });

    const elapsedMs = Date.now() - startedAt;
    const text = await res.text();

    return json({
      ok: res.ok,
      status: res.status,
      elapsedMs,
      url: fullUrl,
      preview: text.slice(0, 800),
    }, res.ok ? 200 : res.status);
  } catch (e) {
    const elapsedMs = Date.now() - startedAt;
    return json({
      ok: false,
      error: "Fetch failed",
      elapsedMs,
      url: fullUrl,
      detail: `${e?.name || "Error"}: ${String(e?.message || e)}`,
      note: "If this is AbortError, the endpoint did not respond within timeoutMs.",
    }, 502);
  } finally {
    clearTimeout(t);
  }
}
