// Deno / Supabase Edge Function
//
// IMPORTANT SECURITY BOUNDARY
// ---------------------------
// This endpoint used to sign a customer JWT from caller-supplied customer_id/store_id
// without proving password/OTP ownership. It is intentionally fail-closed until the
// customer authentication flow issues a server-side proof after password + OTP.
//
// Do not re-enable signing here by trusting IDs received from the browser.

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
      'cache-control': 'no-store',
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return json({}, 200);
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  return json(
    {
      error: 'customer_auth_not_ready',
      message:
        'A emissão de sessão do cliente está desabilitada até que senha e OTP sejam validados no servidor.',
    },
    503,
  );
});
