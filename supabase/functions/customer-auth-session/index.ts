import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TERMS_VERSION = "2026-02-11";
const PRIVACY_VERSION = "2026-02-11";
const CUSTOMER_COLUMNS = "id,store_id,phone,full_name,nickname,cpf,email,birth_date,loyalty_points,loyalty_tier,current_tier_id,is_whatsapp,contact_preference,marketing_consent,loyalty_opt_in,email_verified,phone_verified_at,status,merged_into_customer_id";

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });
}

function validUuid(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value);
}

function validDeviceHash(value: unknown) {
  return /^[0-9a-f]{64}$/i.test(String(value || ""));
}

function normalizeCustomer(row: any) {
  return {
    id: String(row.id),
    store_id: String(row.store_id),
    phone: String(row.phone || ""),
    full_name: row.full_name ?? null,
    nickname: row.nickname ?? null,
    cpf: row.cpf ?? null,
    email: row.email ?? null,
    birth_date: row.birth_date ?? null,
    loyalty_points: Number(row.loyalty_points ?? 0),
    loyalty_tier: row.loyalty_tier ?? "Bronze",
    current_tier_id: row.current_tier_id ?? null,
    is_whatsapp: Boolean(row.is_whatsapp ?? true),
    contact_preference: row.contact_preference ?? null,
    marketing_consent: Boolean(row.marketing_consent ?? false),
    loyalty_opt_in: Boolean(row.loyalty_opt_in ?? false),
    email_verified: Boolean(row.email_verified ?? false),
    phone_verified: Boolean(row.phone_verified_at),
    status: row.status ?? "active",
  };
}

async function loadCustomer(service: any, customerId: string, storeId: string) {
  const { data, error } = await service
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("id", customerId)
    .eq("store_id", storeId)
    .eq("status", "active")
    .is("merged_into_customer_id", null)
    .maybeSingle();

  return error ? null : data;
}

async function passwordConfigured(service: any, customerId: string) {
  const { data } = await service
    .from("customer_credentials")
    .select("customer_id")
    .eq("customer_id", customerId)
    .not("password_hash", "is", null)
    .maybeSingle();
  return Boolean(data?.customer_id);
}

async function getBearerIdentity(service: any, req: Request) {
  const bearer = req.headers.get("authorization") || "";
  const token = bearer.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const { data: userData, error: userError } = await service.auth.getUser(token);
  const authUserId = userData?.user?.id;
  if (userError || !authUserId) return null;

  const { data: identity } = await service
    .from("customer_auth_identities")
    .select("customer_id,store_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  return identity || null;
}

async function issueSessionProof(service: any, customerId: string, storeId: string) {
  const syntheticEmail = `customer-${customerId}@auth.optmamenu.com.br`;
  let authUserId: string | null = null;

  const { data: existingIdentity } = await service
    .from("customer_auth_identities")
    .select("auth_user_id")
    .eq("customer_id", customerId)
    .maybeSingle();

  if (existingIdentity?.auth_user_id) {
    authUserId = String(existingIdentity.auth_user_id);
  } else {
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
      user_metadata: { portal: "customer", customer_id: customerId, store_id: storeId },
      app_metadata: { portal: "customer" },
    });
    if (createError || !created.user?.id) {
      console.error("customer_auth_user_create_failed", { customerId, code: createError?.code });
      return null;
    }
    authUserId = created.user.id;

    const { error: identityError } = await service.from("customer_auth_identities").insert({
      customer_id: customerId,
      store_id: storeId,
      auth_user_id: authUserId,
      last_issued_at: new Date().toISOString(),
    });
    if (identityError) {
      await service.auth.admin.deleteUser(authUserId).catch(() => undefined);
      console.error("customer_auth_identity_link_failed", { customerId, code: identityError.code });
      return null;
    }
  }

  const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: syntheticEmail,
  });
  const tokenHash = linkData?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    console.error("customer_session_link_failed", { customerId, code: linkError?.code });
    return null;
  }

  await service
    .from("customer_auth_identities")
    .update({ last_issued_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("customer_id", customerId);

  return String(tokenHash);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: "server_configuration_error" }, 503, origin);

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const input = await req.json().catch(() => null) as Record<string, any> | null;
  if (!input) return json({ ok: false, error: "invalid_json" }, 400, origin);

  const action = String(input.action || "otp").toLowerCase();
  const deviceTokenHash = String(input.deviceTokenHash || "").trim().toLowerCase();

  if (action === "me") {
    const identity = await getBearerIdentity(service, req);
    if (!identity) return json({ ok: false, error: "unauthorized" }, 401, origin);
    if (!validDeviceHash(deviceTokenHash)) return json({ ok: false, error: "reauth_required", reason: "device_not_trusted" }, 401, origin);

    const { data: deviceState, error: deviceError } = await service.rpc("customer_touch_trusted_device_service_safe", {
      p_customer_id: identity.customer_id,
      p_store_id: identity.store_id,
      p_device_token_hash: deviceTokenHash,
    });
    if (deviceError || !deviceState?.ok) {
      return json({ ok: false, error: "reauth_required", reason: deviceState?.reason || "device_not_trusted" }, 401, origin);
    }

    const customer = await loadCustomer(service, String(identity.customer_id), String(identity.store_id));
    if (!customer) return json({ ok: false, error: "customer_not_found" }, 404, origin);

    return json({
      ok: true,
      customer: normalizeCustomer(customer),
      passwordConfigured: await passwordConfigured(service, String(identity.customer_id)),
    }, 200, origin);
  }

  if (action === "set_password") {
    const identity = await getBearerIdentity(service, req);
    if (!identity) return json({ ok: false, error: "unauthorized" }, 401, origin);
    if (!validDeviceHash(deviceTokenHash)) return json({ ok: false, error: "reauth_required" }, 401, origin);

    const { data: deviceState } = await service.rpc("customer_touch_trusted_device_service_safe", {
      p_customer_id: identity.customer_id,
      p_store_id: identity.store_id,
      p_device_token_hash: deviceTokenHash,
    });
    if (!deviceState?.ok) return json({ ok: false, error: "reauth_required", reason: deviceState?.reason }, 401, origin);

    const password = String(input.password || "");
    const { data: result, error } = await service.rpc("customer_set_password_service_safe", {
      p_customer_id: identity.customer_id,
      p_store_id: identity.store_id,
      p_password: password,
    });
    if (error) return json({ ok: false, error: "password_update_failed" }, 500, origin);
    if (!result?.ok) return json({ ok: false, error: result?.error || "password_update_failed" }, 400, origin);
    return json({ ok: true }, 200, origin);
  }

  if (action === "password_login") {
    const phone = String(input.phone || "").trim();
    const password = String(input.password || "");
    const storeId = String(input.storeId || "").trim();
    if (!phone || !password || !validUuid(storeId) || !validDeviceHash(deviceTokenHash)) {
      return json({ ok: false, error: "invalid_credentials" }, 401, origin);
    }

    const { data: verified, error: verifyError } = await service.rpc("customer_verify_password_service_safe", {
      p_phone: phone,
      p_password: password,
      p_store_id: storeId,
      p_device_token_hash: deviceTokenHash,
    });
    if (verifyError) return json({ ok: false, error: "login_unavailable" }, 503, origin);
    if (!verified?.ok) {
      if (verified?.error === "locked") {
        return json({ ok: false, error: "locked", retryAfterSeconds: Number(verified?.retry_after_seconds || 900) }, 423, origin);
      }
      return json({ ok: false, error: "invalid_credentials" }, 401, origin);
    }

    const customerId = String(verified.customer_id || "");
    if (!customerId) return json({ ok: false, error: "invalid_credentials" }, 401, origin);

    if (verified.otp_required) {
      return json({
        ok: true,
        otpRequired: true,
        reason: verified.reason || "new_device",
      }, 200, origin);
    }

    const customer = await loadCustomer(service, customerId, storeId);
    if (!customer) return json({ ok: false, error: "invalid_credentials" }, 401, origin);

    const tokenHash = await issueSessionProof(service, customerId, storeId);
    if (!tokenHash) return json({ ok: false, error: "session_issue_failed" }, 500, origin);

    return json({
      ok: true,
      otpRequired: false,
      tokenHash,
      verificationType: "magiclink",
      customer: normalizeCustomer(customer),
      passwordConfigured: true,
    }, 200, origin);
  }

  if (action !== "otp") return json({ ok: false, error: "unsupported_action" }, 400, origin);

  const phone = String(input.phone || "").trim();
  const otp = String(input.otp || "").trim();
  const storeId = String(input.storeId || "").trim();
  const purpose = String(input.purpose || "login").trim().toLowerCase();
  if (!phone || !/^\d{6}$/.test(otp.replace(/\D/g, "")) || !validUuid(storeId)) {
    return json({ ok: false, error: "invalid_request" }, 400, origin);
  }

  const { data: verified, error: verifyError } = await service.rpc("verify_customer_otp_sms_safe", {
    p_phone: phone,
    p_otp: otp,
    p_store_id: storeId,
    p_purpose: purpose,
  });
  if (verifyError) return json({ ok: false, error: "otp_verification_failed" }, 500, origin);
  if (!verified?.isValid) {
    return json({ ok: false, error: verified?.locked ? "otp_locked" : "invalid_or_expired_otp" }, verified?.locked ? 423 : 401, origin);
  }

  let customerId = verified?.customer?.id ? String(verified.customer.id) : "";

  if (customerId && purpose === "registration") {
    return json({ ok: false, error: "customer_already_exists" }, 409, origin);
  }

  if (!customerId) {
    if (purpose !== "registration") return json({ ok: false, error: "customer_not_found" }, 404, origin);
    const registration = input.registration || {};
    if (registration.termsAccepted !== true) return json({ ok: false, error: "terms_required" }, 400, origin);
    if (!registration.password) return json({ ok: false, error: "password_required" }, 400, origin);

    const { data: registered, error: registerError } = await service.rpc("register_public_customer_safe", {
      p_store_id: storeId,
      p_phone: phone,
      p_full_name: registration.fullName || null,
      p_nickname: registration.nickname || null,
      p_email: registration.email || null,
      p_birth_date: registration.birthDate || null,
      p_terms_accepted: true,
      p_terms_version: TERMS_VERSION,
      p_privacy_version: PRIVACY_VERSION,
      p_loyalty_opt_in: Boolean(registration.loyaltyOptIn),
      p_marketing_whatsapp_consent: Boolean(registration.marketingConsent),
      p_source: "public_store_otp",
    });
    if (registerError || !registered?.ok || !registered?.customer_id) {
      return json({ ok: false, error: String(registered?.error || "registration_failed") }, 409, origin);
    }
    customerId = String(registered.customer_id);

    const { data: passwordResult, error: passwordError } = await service.rpc("customer_set_password_service_safe", {
      p_customer_id: customerId,
      p_store_id: storeId,
      p_password: String(registration.password),
    });
    if (passwordError || !passwordResult?.ok) {
      return json({ ok: false, error: String(passwordResult?.error || "password_setup_failed") }, 400, origin);
    }

    await service
      .from("customers")
      .update({
        phone_verified_at: new Date().toISOString(),
        identity_verified_at: new Date().toISOString(),
      })
      .eq("id", customerId)
      .eq("store_id", storeId);
  }

  if (validDeviceHash(deviceTokenHash)) {
    const { data: trustResult, error: trustError } = await service.rpc("customer_trust_device_service_safe", {
      p_customer_id: customerId,
      p_store_id: storeId,
      p_device_token_hash: deviceTokenHash,
    });
    if (trustError || !trustResult?.ok) {
      console.error("customer_trust_device_failed", { customerId, storeId });
      return json({ ok: false, error: "device_trust_failed" }, 500, origin);
    }
  }

  const customer = await loadCustomer(service, customerId, storeId);
  if (!customer) return json({ ok: false, error: "customer_not_found" }, 404, origin);

  const tokenHash = await issueSessionProof(service, customerId, storeId);
  if (!tokenHash) return json({ ok: false, error: "session_issue_failed" }, 500, origin);

  return json({
    ok: true,
    tokenHash,
    verificationType: "magiclink",
    customer: normalizeCustomer(customer),
    passwordConfigured: await passwordConfigured(service, customerId),
  }, 200, origin);
});
