export async function onRequest(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const baseUrl = env.AC_API_URL;
  const token = env.AC_API_TOKEN;

  if (!baseUrl || !token) {
    return new Response(
      JSON.stringify({ error: "Missing AC_API_URL or AC_API_TOKEN env vars" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const acUrl = `${baseUrl.replace(/\/$/, "")}/api/3/contacts/${encodeURIComponent(id)}`;

  const res = await fetch(acUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Api-Token": token,
    },
  });

  const text = await res.text();

  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
