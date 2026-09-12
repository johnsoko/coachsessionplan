// Handles the save/load API for drills, backed by D1 + Clerk auth.
// Everything that isn't an /api/ request just falls through to the
// static site (the same index.html that was being served before this
// file existed).

import { createClerkClient } from "@clerk/backend";

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

// returns the signed-in Clerk userId, or null if not signed in
async function getUserId(request, env) {
  if (!env.CLERK_SECRET_KEY || !env.CLERK_PUBLISHABLE_KEY) return null;
  const clerkClient = createClerkClient({
    secretKey: env.CLERK_SECRET_KEY,
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
  });
  const requestState = await clerkClient.authenticateRequest(request, {
    authorizedParties: [
      "https://coachsessionplan.com",
      "https://www.coachsessionplan.com",
      "https://coachsessionplan.johnsoko.workers.dev",
    ],
  });
  if (!requestState.isSignedIn) return null;
  return requestState.toAuth().userId;
}

async function handleApi(request, env, url) {
  const parts = url.pathname.split("/").filter(Boolean); // ["api","drills", maybe ":id"]

  // GET /api/drill-library — list every library drill the signed-in user
  // owns, for the Drill Library page. Includes surface/scenes directly so
  // the grid can render thumbnails in one request instead of a separate
  // fetch per card (that N+1 pattern got slower as the library grew, and
  // the resulting network/CPU contention was likely also behind choppy
  // playback on the detail page).
  if (request.method === "GET" && parts.length === 2 && parts[1] === "drill-library") {
    const userId = await getUserId(request, env);
    if (!userId) return jsonResponse({ error: "Sign in required" }, 401);
    const { results } = await env.DB.prepare(
      `SELECT id, title, created_at, updated_at,
              json_extract(data, '$.notes') as notes,
              json_extract(data, '$.description') as description,
              json_extract(data, '$.dimensions') as dimensions,
              json_extract(data, '$.tags') as tags,
              json_extract(data, '$.creatorName') as creator_name,
              json_extract(data, '$.surface') as surface,
              json_extract(data, '$.scenes') as scenes
       FROM drill_library WHERE user_id = ? ORDER BY updated_at DESC`
    ).bind(userId).all();
    return jsonResponse({ drills: results });
  }

  // GET /api/drill-library/:id — full detail for a single library drill
  // (surface/scenes for the preview, plus notes/tags/creator).
  if (request.method === "GET" && parts.length === 3 && parts[1] === "drill-library") {
    const id = parts[2];
    const row = await env.DB.prepare("SELECT id, title, created_at, updated_at, data FROM drill_library WHERE id = ?")
      .bind(id).first();
    if (!row) return jsonResponse({ error: "Not found" }, 404);
    return jsonResponse({ id: row.id, title: row.title, created_at: row.created_at, updated_at: row.updated_at, ...JSON.parse(row.data) });
  }

  // POST /api/drill-library — create a new library drill from a phase's
  // saved data. Requires sign-in. Returns the new id.
  if (request.method === "POST" && parts.length === 2 && parts[1] === "drill-library") {
    const userId = await getUserId(request, env);
    if (!userId) return jsonResponse({ error: "Sign in required" }, 401);
    const body = await request.json();
    const id = newId();
    const now = Date.now();
    await env.DB.prepare(
      "INSERT INTO drill_library (id, user_id, title, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(id, userId, body.title || "Untitled Drill", JSON.stringify(body.data || {}), now, now).run();
    return jsonResponse({ id });
  }

  // PUT /api/drill-library/:id — update an existing library drill (keeps
  // it in sync with its source phase on later saves). Requires sign-in
  // and ownership.
  if (request.method === "PUT" && parts.length === 3 && parts[1] === "drill-library") {
    const userId = await getUserId(request, env);
    if (!userId) return jsonResponse({ error: "Sign in required" }, 401);
    const id = parts[2];
    const existing = await env.DB.prepare("SELECT user_id FROM drill_library WHERE id = ?").bind(id).first();
    if (!existing) return jsonResponse({ error: "Not found" }, 404);
    if (existing.user_id && existing.user_id !== userId) {
      return jsonResponse({ error: "You don't own this drill" }, 403);
    }
    const body = await request.json();
    await env.DB.prepare(
      "UPDATE drill_library SET title = ?, data = ?, updated_at = ? WHERE id = ?"
    ).bind(body.title || "Untitled Drill", JSON.stringify(body.data || {}), Date.now(), id).run();
    return jsonResponse({ ok: true });
  }

  // DELETE /api/drill-library/:id — removes a drill from the library only.
  // Practice plans that reference it via a phase's libraryDrillId are
  // completely unaffected — each phase carries its own full drill data
  // (surface/scenes) independently, it's never fetched from the library
  // at use time, so there's nothing in any saved practice plan to break.
  if (request.method === "DELETE" && parts.length === 3 && parts[1] === "drill-library") {
    const userId = await getUserId(request, env);
    if (!userId) return jsonResponse({ error: "Sign in required" }, 401);
    const id = parts[2];
    const existing = await env.DB.prepare("SELECT user_id FROM drill_library WHERE id = ?").bind(id).first();
    if (!existing) return jsonResponse({ error: "Not found" }, 404);
    if (existing.user_id && existing.user_id !== userId) {
      return jsonResponse({ error: "You don't own this drill" }, 403);
    }
    await env.DB.prepare("DELETE FROM drill_library WHERE id = ?").bind(id).run();
    return jsonResponse({ ok: true });
  }

  // GET /api/drills — list every practice plan the signed-in user owns,
  // for the dashboard. Requires sign-in.
  if (request.method === "GET" && parts.length === 2 && parts[1] === "drills") {
    const userId = await getUserId(request, env);
    if (!userId) return jsonResponse({ error: "Sign in required" }, 401);
    const { results } = await env.DB.prepare(
      `SELECT id, title, created_at, updated_at,
              json_extract(data, '$.practiceDate') as practice_date,
              json_extract(data, '$.duration') as duration,
              json_extract(data, '$.tags') as tags
       FROM drills WHERE user_id = ? ORDER BY updated_at DESC`
    ).bind(userId).all();
    return jsonResponse({ drills: results });
  }

  // POST /api/drills — create a new drill, returns its id. Requires sign-in.
  if (request.method === "POST" && parts.length === 2 && parts[1] === "drills") {
    const userId = await getUserId(request, env);
    if (!userId) return jsonResponse({ error: "Sign in required" }, 401);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonResponse({ error: "Invalid body" }, 400);
    const id = newId();
    const now = Date.now();
    const title = (body.title || "Untitled Play").slice(0, 200);
    await env.DB.prepare(
      "INSERT INTO drills (id, title, data, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(id, title, JSON.stringify(body), userId, now, now).run();
    return jsonResponse({ id, title, created_at: now, updated_at: now });
  }

  // PUT /api/drills/:id — update an existing drill. Requires sign-in AND ownership.
  if (request.method === "PUT" && parts.length === 3 && parts[1] === "drills") {
    const userId = await getUserId(request, env);
    if (!userId) return jsonResponse({ error: "Sign in required" }, 401);
    const id = parts[2];
    const existing = await env.DB.prepare("SELECT user_id FROM drills WHERE id = ?").bind(id).first();
    if (!existing) return jsonResponse({ error: "Not found" }, 404);
    if (existing.user_id && existing.user_id !== userId) {
      return jsonResponse({ error: "You don't own this drill" }, 403);
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonResponse({ error: "Invalid body" }, 400);
    const now = Date.now();
    const title = (body.title || "Untitled Play").slice(0, 200);
    await env.DB.prepare(
      "UPDATE drills SET title = ?, data = ?, user_id = ?, updated_at = ? WHERE id = ?"
    ).bind(title, JSON.stringify(body), userId, now, id).run();
    return jsonResponse({ id, title, updated_at: now });
  }

  // GET /api/drills/:id — load a drill. Public — anyone with the link can view.
  if (request.method === "GET" && parts.length === 3 && parts[1] === "drills") {
    const id = parts[2];
    const row = await env.DB.prepare("SELECT id, title, data, updated_at FROM drills WHERE id = ?")
      .bind(id).first();
    if (!row) return jsonResponse({ error: "Not found" }, 404);
    return jsonResponse({ id: row.id, title: row.title, updated_at: row.updated_at, ...JSON.parse(row.data) });
  }

  // DELETE /api/drills/:id — requires sign-in AND ownership.
  if (request.method === "DELETE" && parts.length === 3 && parts[1] === "drills") {
    const userId = await getUserId(request, env);
    if (!userId) return jsonResponse({ error: "Sign in required" }, 401);
    const id = parts[2];
    const existing = await env.DB.prepare("SELECT user_id FROM drills WHERE id = ?").bind(id).first();
    if (!existing) return jsonResponse({ error: "Not found" }, 404);
    if (existing.user_id && existing.user_id !== userId) {
      return jsonResponse({ error: "You don't own this drill" }, 403);
    }
    await env.DB.prepare("DELETE FROM drills WHERE id = ?").bind(id).run();
    return jsonResponse({ ok: true });
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
