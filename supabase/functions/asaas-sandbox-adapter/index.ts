// Asaas Sandbox retired — no external calls, secrets or database access.
Deno.serve((request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }
  return new Response(JSON.stringify({
    ok: false, error: "legacy_provider_retired", provider: "asaas"
  }), { status: 410, headers: {
    "Content-Type": "application/json", "Cache-Control": "no-store"
  } });
});
