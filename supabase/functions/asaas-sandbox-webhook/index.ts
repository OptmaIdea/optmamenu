// Asaas Sandbox retired. Acknowledge late webhooks, but never process them.
Deno.serve((request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }
  return new Response(JSON.stringify({ ok: true, ignored: true, reason: "legacy_provider_retired" }), {
    status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
});
