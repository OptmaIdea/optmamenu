import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const DEFAULT_GATEWAY_BASE_URL = "https://optmasmsgate.optmaidea.com.br";
const ALLOWED_PURPOSES = new Set([
  "login",
  "registration",
  "password_reset",
  "profile_change",
  "phone_change",
  "sensitive_action",
  "account_delete",
]);

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function reply(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...cors(origin),
    },
  });
}

function smsSafeLabel(value: unknown) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ._-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 32);

  return normalized || "OptmaMenu";
}

function messageForOtp(otp: string, senderLabel: string) {
  return `${senderLabel}: codigo ${otp}. Valido por 5 min. Nao compartilhe este codigo.`;
}

function toGatewayE164(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  const normalized = `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply({ ok: false, error: "method_not_allowed" }, 405, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const gatewayBaseUrl = (Deno.env.get("OPTMASMSGATE_BASE_URL") || DEFAULT_GATEWAY_BASE_URL).replace(/\/$/, "");
  const gatewayApiKey = Deno.env.get("OPTMASMSGATE_API_KEY") || "";

  if (!supabaseUrl || !serviceRoleKey) {
    return reply({ ok: false, error: "server_configuration_error" }, 503, origin);
  }
  if (!gatewayApiKey) {
    return reply({ ok: false, error: "sms_gateway_not_configured" }, 503, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply({ ok: false, error: "invalid_json" }, 400, origin);
  }

  const phone = String(body.phone || "").trim();
  const storeId = String(body.storeId || "").trim();
  const purpose = String(body.purpose || "login").trim().toLowerCase();
  const deviceTokenHash = String(body.deviceTokenHash || "").trim().toLowerCase();
  const deviceTokenHash = String(body.deviceTokenHash || "").trim().toLowerCase();

  if (!phone || !/^[0-9a-f-]{36}$/i.test(storeId) || !ALLOWED_PURPOSES.has(purpose)) {
    return reply({ ok: false, error: "invalid_request" }, 400, origin);
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // A exclusão de conta é uma ação autenticada. O endpoint de SMS continua
  // público para login/cadastro, mas não aceita disparar OTP de exclusão apenas
  // com conhecimento do telefone.
  if (purpose === "account_delete") {
    const bearer = req.headers.get("authorization") || "";
    const accessToken = bearer.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken || !/^[0-9a-f]{64}$/i.test(deviceTokenHash)) {
      return reply({ ok: false, error: "access_denied" }, 401, origin);
    }

    const { data: userData, error: userError } = await service.auth.getUser(accessToken);
    const authUserId = userData?.user?.id;
    if (userError || !authUserId) {
      return reply({ ok: false, error: "access_denied" }, 401, origin);
    }

    const { data: identity } = await service
      .from("customer_auth_identities")
      .select("customer_id,store_id")
      .eq("auth_user_id", authUserId)
      .eq("store_id", storeId)
      .is("revoked_at", null)
      .maybeSingle();

    if (!identity) {
      return reply({ ok: false, error: "access_denied" }, 401, origin);
    }

    const { data: customer } = await service
      .from("customers")
      .select("phone,phone_e164,status,merged_into_customer_id")
      .eq("id", identity.customer_id)
      .eq("store_id", storeId)
      .maybeSingle();

    const requestedDigitsRaw = phone.replace(/\D/g, "");
    const requestedDigits = requestedDigitsRaw.startsWith("55")
      ? requestedDigitsRaw
      : `55${requestedDigitsRaw}`;
    const customerDigits = String(customer?.phone_e164 || customer?.phone || "").replace(/\D/g, "");

    if (
      !customer
      || customer.status !== "active"
      || customer.merged_into_customer_id
      || !requestedDigits
      || requestedDigits !== customerDigits
    ) {
      return reply({ ok: false, error: "access_denied" }, 401, origin);
    }

    const { data: deviceState, error: deviceError } = await service.rpc(
      "customer_touch_trusted_device_service_safe",
      {
        p_customer_id: identity.customer_id,
        p_store_id: storeId,
        p_device_token_hash: deviceTokenHash,
      },
    );

    if (deviceError || !deviceState?.ok) {
      return reply(
        { ok: false, error: "reauth_required", reason: deviceState?.reason || "device_not_trusted" },
        401,
        origin,
      );
    }
  }

  let senderLabel = "OptmaMenu";
  try {
    const { data: storeData, error: storeError } = await service
      .from("stores")
      .select("name, slug, config")
      .eq("id", storeId)
      .maybeSingle();

    if (storeError) throw storeError;

    const visualTitle = storeData?.config && typeof storeData.config === "object"
      ? String((storeData.config as Record<string, unknown>).visual_title || "").trim()
      : "";

    senderLabel = smsSafeLabel(visualTitle || storeData?.name || storeData?.slug || "OptmaMenu");
  } catch (error) {
    console.warn("customer_otp_store_label_fallback", {
      error: error instanceof Error ? error.name : "unknown_error",
      storeId,
    });
  }

  let issued: any = null;
  try {
    const { data, error } = await service.rpc("issue_customer_otp_for_sms_safe", {
      p_phone: phone,
      p_store_id: storeId,
      p_purpose: purpose,
    });
    if (error) throw error;
    issued = data;
  } catch (error) {
    console.error("customer_otp_issue_failed", {
      error: error instanceof Error ? error.name : "unknown_error",
      storeId,
      purpose,
    });
    return reply({ ok: false, error: "otp_issue_failed" }, 500, origin);
  }

  if (!issued?.ok) {
    const error = String(issued?.error || "otp_issue_rejected");
    if (error === "rate_limited" || error === "daily_limit_reached") {
      return reply({ ok: false, error, retryAfterSeconds: Number(issued?.retry_after_seconds || 600) }, 429, origin);
    }
    if (error === "invalid_phone" || error === "invalid_purpose" || error === "invalid_request") {
      return reply({ ok: false, error }, 400, origin);
    }
    if (error === "phone_already_registered" || error === "customer_not_found") {
      // Conflito de fluxo, não falha de transporte: 200 evita FunctionsHttpError
      // e permite ao frontend mostrar a orientação sem ruído 409 no console.
      return reply({
        ok: false,
        error,
        message: String(issued?.message || ""),
        smsSent: false,
      }, 200, origin);
    }
    return reply({ ok: false, error: "otp_issue_rejected" }, 409, origin);
  }

  const otpId = String(issued.otp_id || "");
  const phoneNumber = toGatewayE164(issued.phone_number);
  const otp = String(issued.otp || "");
  const expiresAt = String(issued.expires_at || "");
  if (!otpId || !phoneNumber || !/^\d{6}$/.test(otp)) {
    return reply({ ok: false, error: "otp_issue_invalid_payload" }, 500, origin);
  }

  const providerRequestId = crypto.randomUUID();
  const idempotencyKey = `optmamenu-otp-${otpId}`;
  const smsBody = messageForOtp(otp, senderLabel);

  let providerStatus = "failed";
  let providerMessageId: string | null = null;
  let providerErrorCode: string | null = null;
  let responseStatus = 502;

  try {
    const providerResponse = await fetch(`${gatewayBaseUrl}/api/v1/sms/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": gatewayApiKey,
        "Idempotency-Key": idempotencyKey,
        "x-request-id": providerRequestId,
        "User-Agent": "OptmaMenu-Supabase-OTP/1.0",
      },
      body: JSON.stringify({
        phoneNumber,
        message: smsBody,
        expiresInSeconds: 300,
      }),
    });

    const providerText = await providerResponse.text();
    let providerData: any = null;
    try {
      providerData = providerText ? JSON.parse(providerText) : null;
    } catch {
      providerData = null;
    }

    if (providerResponse.ok) {
      providerStatus = "queued";
      providerMessageId = String(providerData?.data?.id || "") || null;
      responseStatus = 200;
    } else {
      providerErrorCode = String(providerData?.error || `http_${providerResponse.status}`);
      responseStatus = providerResponse.status === 429 ? 429 : 502;
    }
  } catch (error) {
    providerErrorCode = "provider_unreachable";
    console.error("optmasmsgate_request_failed", {
      error: error instanceof Error ? error.name : "unknown_error",
      storeId,
      purpose,
      otpId,
    });
  }

  try {
    await service.rpc("mark_customer_otp_sms_delivery_safe", {
      p_otp_id: otpId,
      p_status: providerStatus,
      p_provider_message_id: providerMessageId,
      p_provider_request_id: providerRequestId,
      p_error_code: providerErrorCode,
    });
  } catch (error) {
    console.error("customer_otp_delivery_audit_failed", {
      error: error instanceof Error ? error.name : "unknown_error",
      otpId,
    });
  }

  if (providerStatus !== "queued") {
    return reply({ ok: false, error: providerErrorCode === "rate_limit_exceeded" ? "sms_rate_limited" : "sms_delivery_unavailable" }, responseStatus, origin);
  }

  return reply({ ok: true, expiresAt, status: "queued", messageId: providerMessageId, senderLabel }, 200, origin);
});
