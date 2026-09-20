// Cloudflare Pages Function
// Handles POST /api/submit — stores one poll response in KV.
//
// Setup required in Cloudflare dashboard (Pages project > Settings > Functions):
//   1. Create a KV namespace (e.g. "youth-ai-poll-responses")
//   2. Bind it to this project with variable name: POLL_RESPONSES
//
// This mirrors the senior-ai-poll project's submit.js exactly, so the same
// KV binding name and submission-key pattern can be reused if you'd rather
// share a Cloudflare account setup than create a second one from scratch.

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    // Basic shape check -- don't trust the client blindly.
    if (typeof body !== "object" || body === null) {
      return new Response(JSON.stringify({ error: "Invalid submission" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const id = `submission:${Date.now()}-${crypto.randomUUID()}`;

    await env.POLL_RESPONSES.put(id, JSON.stringify(body));

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Could not save submission" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Reject any method other than POST.
export async function onRequestGet() {
  return new Response("Method not allowed", { status: 405 });
}
