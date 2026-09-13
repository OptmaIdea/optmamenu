import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const gatewayBaseUrl = "https://optmasmsgate.optmaidea.com.br";
const purposes = new Set(["login", "registration", "password_reset", "profile_change", "phone_change", "sensitive_action", "account_delete"]);

function headers(origin: string | null) {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function reply(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(origin) });
  if (req.method !== "POST") return reply({ ok: false, error: "method_not_allowed" }, 405, origin);

  const serviceUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceSecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const smsSecret = Deno.env.get("OPTMASMSGATE_API_KEY") || "";
  if (!serviceUrl || !serviceSecret) return reply({ ok: false, error: "server_configuration_error" }, 503, origin);
  if (!smsSecret) return reply({ ok: false, error: "sms_gateway_not_configured" }, 503, origin);

  const input = await req.json().catch(() => null) as Record<string, unknown> | null;
  const phone = String(input?.phone || "").trim();
  const storeId = String(input?.storeId || "").trim();
  const purpose = String(input?.purpose || "login").trim().toLowerCase();
  if (!phone || !/^[0-9a-f-]{36}$/i.test(storeId) || !purposes.has(purpose)) {
    return reply({ ok: false, error: "invalid_request" }, 400, origin);
  }

  const service = createClient(serviceUrl, serviceSecret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: issued, error: issueError } = await service.rpc("issue_customer_otp_for_sms_safe", {
    p_phone: phone,
    p_store_id: storeId,
    p_purpose: purpose,
  });
  if (issueError) return reply({ ok: false, error: "otp_issue_failed" }, 500, origin);
  if (!issued?.ok) {
    const code = String(issued?.error || "otp_issue_rejected");
    const status = code === "rate_limited" || code === "daily_limit_reached" ? 429 : 400;
    return reply({ ok: false, error: code, retryAfterSeconds: issued?.retry_after_seconds || null }, status, origin);
  }

  const otpId = String(issued.otp_id || "");
  const destination = String(issued.phone_number || "");
  const code = String(issued.otp || "");
  const providerRequestId = crypto.randomUUID();
  const providerResponse = await fetch(`${gatewayBaseUrl}/api/v1/sms/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": smsSecret,
      "Idempotency-Key": `optmamenu-otp-${otpId}`,
      "x-request-id": providerRequestId,
    },
    body: JSON.stringify({
      phoneNumber: destination,
      message: `OptmaMenu: codigo ${code}. Valido por 5 min. Nao compartilhe este codigo.`,
      expiresInSeconds: 300,
    }),
  }).catch(() => null);

  let providerData: any = null;
  if (providerResponse) {
    providerData = await providerResponse.json().catch(() => null);
  }
  const queued = Boolean(providerResponse?.ok);
  const messageId = queued ? String(providerData?.data?.id || "") || null : null;
  const providerError = queued ? null : String(providerData?.error || "provider_unreachable");

  await service.rpc("mark_customer_otp_sms_delivery_safe", {
    p_otp_id: otpId,
    p_status: queued ? "queued" : "failed",
    p_provider_message_id: messageId,
    p_provider_request_id: providerRequestId,
    p_error_code: providerError,
  });

  if (!queued) return reply({ ok: false, error: providerError === "rate_limit_exceeded" ? "sms_rate_limited" : "sms_delivery_unavailable" }, providerResponse?.status === 429 ? 429 : 502, origin);
  return reply({ ok: true, status: "queued", messageId, expiresAt: issued.expires_at }, 200, origin);
});
