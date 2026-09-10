// Handles the save/load API for drills, backed by D1. Everything that
// isn't an /api/ request just falls through to the static site (the
// same index.html that was being served before this file existed).

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function newId() {
  // short, URL-friendly id — good enough for a shareable link, not
  // trying to be cryptographically unguessable
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

async function handleApi(request, env, url) {
  const parts = url.pathname.split("/").filter(Boolean); // ["api","drills", maybe ":id"]

  // POST /api/drills — create a new drill, returns its id
  if (request.method === "POST" && parts.length === 2 && parts[1] === "drills") {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonResponse({ error: "Invalid body" }, 400);
    const id = newId();
    const now = Date.now();
    const title = (body.title || "Untitled Play").slice(0, 200);
    await env.DB.prepare(
      "INSERT INTO drills (id, title, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, title, JSON.stringify(body), now, now).run();
    return jsonResponse({ id, title, created_at: now, updated_at: now });
  }

  // PUT /api/drills/:id — update an existing drill
  if (request.method === "PUT" && parts.length === 3 && parts[1] === "drills") {
    const id = parts[2];
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonResponse({ error: "Invalid body" }, 400);
    const now = Date.now();
    const title = (body.title || "Untitled Play").slice(0, 200);
    const result = await env.DB.prepare(
      "UPDATE drills SET title = ?, data = ?, updated_at = ? WHERE id = ?"
    ).bind(title, JSON.stringify(body), now, id).run();
    if (!result.meta.changes) return jsonResponse({ error: "Not found" }, 404);
    return jsonResponse({ id, title, updated_at: now });
  }

  // GET /api/drills/:id — load a drill
  if (request.method === "GET" && parts.length === 3 && parts[1] === "drills") {
    const id = parts[2];
    const row = await env.DB.prepare("SELECT id, title, data, updated_at FROM drills WHERE id = ?")
      .bind(id).first();
    if (!row) return jsonResponse({ error: "Not found" }, 404);
    return jsonResponse({ id: row.id, title: row.title, updated_at: row.updated_at, ...JSON.parse(row.data) });
  }

  return jsonResponse({ error: "Not found" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        return jsonResponse({ error: "Server error", detail: String(err) }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
