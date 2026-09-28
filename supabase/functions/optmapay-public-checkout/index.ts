import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildOptmaMenuPixReference } from "../_shared/optmapayWebhook.ts";
import { resolveOptmaPaySecret } from "../_shared/optmapaySecrets.ts";

const DEFAULT_OPTMAPAY_BASE = "https://optmapay.optmaidea.com.br";

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "content-type, x-client-info, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function reply(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors(origin) },
  });
}

function cleanBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function safeIntent(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    amount: Number(row.amount || 0),
    externalReference: row.external_reference || null,
    pixPayload: row.pix_payload || null,
    expiresAt: row.expires_at || null,
    paidAt: row.paid_at || null,
  };
}

async function fetchMerchantAccount(
  service: any,
  provider: any,
  baseUrl: string,
) {
  const accountId = String(provider?.public_config?.optmapay_account_id || "").trim();
  if (!accountId) throw new Error("merchant_account_not_configured");

  const apiSecret = await resolveOptmaPaySecret(
    service,
    provider?.secret_ref,
    "OPTMAPAY_SANDBOX_API_KEY",
  );
  if (!apiSecret.value) throw new Error("api_key_not_configured");

  const response = await fetch(`${baseUrl}/api/sandbox/v1/account`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiSecret.value}`,
      "x-optmapay-account-id": accountId,
    },
  });

  const raw = await response.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }

  if (!response.ok) throw new Error("optmapay_account_check_failed");
  if (response.headers.get("x-optmapay-environment") && response.headers.get("x-optmapay-environment") !== "sandbox") {
    throw new Error("sandbox_boundary_rejected");
  }
  if (response.headers.get("x-optmapay-real-money") && response.headers.get("x-optmapay-real-money") !== "false") {
    throw new Error("real_money_rejected");
  }
  if (data?.environment !== "sandbox" || data?.realMoney === true) {
    throw new Error("sandbox_boundary_rejected");
  }

  const account = data?.account || {};
  if (String(account.id || "") !== accountId) throw new Error("merchant_account_mismatch");
  if (!String(account.pixKey || "").trim()) throw new Error("merchant_pix_key_missing");

  return {
    id: accountId,
    name: String(account.name || "OptmaMenu"),
    pixKey: String(account.pixKey).trim(),
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply({ ok: false, error: "method_not_allowed" }, 405, origin);

  try {
    const body = await req.json();
    const action = String(body?.action || "status");
    const publicOrderToken = String(body?.publicOrderToken || "").trim();

    if (publicOrderToken.length < 24) {
      return reply({ ok: false, error: "invalid_token" }, 400, origin);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const baseUrl = cleanBaseUrl(Deno.env.get("OPTMAPAY_SANDBOX_BASE_URL") || DEFAULT_OPTMAPAY_BASE);
    const service = createClient(supabaseUrl, serviceKey);

    const { data: order, error: orderError } = await service
      .from("orders")
      .select("id,store_id,order_code,total,status,payment_status,payment_method_code,expires_at,public_order_token")
      .eq("public_order_token", publicOrderToken)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return reply({ ok: false, error: "order_not_found" }, 404, origin);

    const { data: method } = await service
      .from("store_payment_methods")
      .select("id,code,base_code,name,active,public_enabled,requires_proof,metadata")
      .eq("store_id", order.store_id)
      .eq("code", order.payment_method_code)
      .maybeSingle();

    const isApiPix = Boolean(
      method?.active &&
      method?.public_enabled &&
      !method?.requires_proof &&
      (method?.base_code || method?.code) === "pix" &&
      method?.metadata?.checkout?.confirmation_mode === "api" &&
      method?.metadata?.checkout?.integration_enabled === true &&
      method?.metadata?.checkout?.provider_code === "optma_sandbox",
    );

    const { data: provider } = await service
      .from("store_online_payment_providers")
      .select("id,enabled,credential_status,capabilities,public_config,secret_ref,metadata")
      .eq("store_id", order.store_id)
      .eq("provider_code", "optma_sandbox")
      .eq("environment", "sandbox")
      .maybeSingle();

    let { data: intent } = await service
      .from("online_payment_intents")
      .select("id,status,amount,external_reference,pix_payload,expires_at,paid_at,created_at")
      .eq("store_id", order.store_id)
      .eq("order_id", order.id)
      .eq("provider_id", provider?.id || "00000000-0000-0000-0000-000000000000")
      .eq("method_code", "pix")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (
      intent &&
      ["created", "pending", "authorized"].includes(intent.status) &&
      intent.expires_at &&
      new Date(intent.expires_at).getTime() <= Date.now()
    ) {
      await service
        .from("online_payment_intents")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", intent.id)
        .in("status", ["created", "pending", "authorized"]);
      intent = { ...intent, status: "expired" };
    }

    const eligible = Boolean(
      isApiPix &&
      provider?.enabled &&
      provider?.credential_status === "ready" &&
      provider?.capabilities?.pix === true &&
      order.status !== "cancelled" &&
      order.status !== "expired" &&
      order.status !== "completed",
    );

    if (action === "status") {
      return reply({
        ok: true,
        eligible,
        orderCode: order.order_code,
        orderStatus: order.status,
        paymentStatus: order.payment_status,
        paymentMethodCode: order.payment_method_code,
        providerReady: Boolean(provider?.enabled && provider?.credential_status === "ready"),
        environment: "sandbox",
        realMoney: false,
        intent: safeIntent(intent),
      }, 200, origin);
    }

    if (action !== "create") {
      return reply({ ok: false, error: "unsupported_action" }, 400, origin);
    }

    if (!eligible) {
      return reply({ ok: false, error: "payment_not_eligible" }, 409, origin);
    }

    if (order.payment_status === "paid") {
      return reply({
        ok: true,
        eligible: true,
        alreadyPaid: true,
        orderCode: order.order_code,
        paymentStatus: order.payment_status,
        environment: "sandbox",
        realMoney: false,
        intent: safeIntent(intent),
      }, 200, origin);
    }

    const merchant = await fetchMerchantAccount(service, provider, baseUrl);
    const candidateIntentId = crypto.randomUUID();
    const externalReference = buildOptmaMenuPixReference(order.store_id, candidateIntentId);

    const orderExpiryMs = order.expires_at ? new Date(order.expires_at).getTime() : Number.POSITIVE_INFINITY;
    const expiresAtMs = Math.min(Date.now() + 10 * 60 * 1000, orderExpiryMs);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      return reply({ ok: false, error: "order_expired" }, 409, origin);
    }
    const expiresAt = new Date(expiresAtMs);

    const payload = new URL("OPTMAPAY://PIX/v1");
    payload.searchParams.set("to", merchant.pixKey);
    payload.searchParams.set("amount", Number(order.total).toFixed(2));
    payload.searchParams.set("ref", externalReference);
    payload.searchParams.set("desc", `Pedido ${order.order_code}`);
    payload.searchParams.set("env", "sandbox");
    payload.searchParams.set("ts", String(Math.floor(expiresAt.getTime() / 1000)));

    const { data: result, error: rpcError } = await service.rpc(
      "create_or_reuse_optmapay_public_pix_intent_internal",
      {
        p_public_order_token: publicOrderToken,
        p_candidate_intent_id: candidateIntentId,
        p_external_reference: externalReference,
        p_pix_payload: payload.toString(),
        p_expires_at: expiresAt.toISOString(),
        p_merchant_account_id: merchant.id,
      },
    );

    if (rpcError) throw rpcError;
    if (!result?.ok) return reply(result, 409, origin);

    const returnedIntent = result.intent
      ? {
          id: result.intent.id,
          status: result.intent.status,
          amount: Number(result.intent.amount || 0),
          externalReference: result.intent.external_reference || null,
          pixPayload: result.intent.pix_payload || null,
          expiresAt: result.intent.expires_at || null,
          paidAt: result.intent.paid_at || null,
        }
      : null;

    return reply({
      ok: true,
      eligible: true,
      reused: Boolean(result.reused),
      alreadyPaid: Boolean(result.already_paid),
      orderCode: result.order_code || order.order_code,
      paymentStatus: result.already_paid ? "paid" : order.payment_status,
      environment: "sandbox",
      realMoney: false,
      intent: returnedIntent,
    }, 200, origin);
  } catch (error) {
    console.error("optmapay-public-checkout", error instanceof Error ? error.message : "unexpected_error");
    return reply({ ok: false, error: "payment_service_unavailable" }, 503, req.headers.get("origin"));
  }
});
