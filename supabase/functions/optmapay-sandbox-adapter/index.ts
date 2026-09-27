import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildOptmaMenuPixReference } from "../_shared/optmapayWebhook.ts";
import { resolveOptmaPaySecret } from "../_shared/optmapaySecrets.ts";

const DEFAULT_OPTMAPAY_BASE = "https://optmapay.optmaidea.com.br";
const jsonHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function reply(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), { status, headers: { ...jsonHeaders, ...cors(origin) } });
}

function cleanBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

async function optmaPayFetch(
  baseUrl: string,
  path: string,
  apiKey: string,
  accountId: string,
  init: RequestInit = {},
) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "x-optmapay-account-id": accountId,
      ...(init.headers || {}),
    },
  });

  const raw = await response.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = { raw }; }

  const environment = response.headers.get("x-optmapay-environment");
  const realMoney = response.headers.get("x-optmapay-real-money");
  if (environment && environment !== "sandbox") throw new Error("OPTMAPAY_ENVIRONMENT_MISMATCH");
  if (realMoney && realMoney !== "false") throw new Error("OPTMAPAY_REAL_MONEY_REJECTED");
  if (!response.ok) {
    const code = data?.error?.code || data?.error || `HTTP_${response.status}`;
    throw new Error(`OPTMAPAY_${response.status}:${String(code)}`);
  }

  if (data?.environment && data.environment !== "sandbox") throw new Error("OPTMAPAY_ENVIRONMENT_MISMATCH");
  if (data?.realMoney === true) throw new Error("OPTMAPAY_REAL_MONEY_REJECTED");
  return data;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply({ ok: false, error: "method_not_allowed" }, 405, origin);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const baseUrl = cleanBaseUrl(Deno.env.get("OPTMAPAY_SANDBOX_BASE_URL") || DEFAULT_OPTMAPAY_BASE);
    const authHeader = req.headers.get("authorization") || "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const service = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const storeId = String(body?.storeId || "");
    const action = String(body?.action || "status");

    if (!storeId) return reply({ ok: false, error: "store_required" }, 400, origin);

    const { data: workspace, error: workspaceError } = await userClient.rpc(
      "get_online_payments_workspace_safe",
      { p_store_id: storeId },
    );
    if (workspaceError || !workspace?.ok) {
      return reply({ ok: false, error: "access_denied" }, 403, origin);
    }

    const { data: provider, error: providerError } = await service
      .from("store_online_payment_providers")
      .select("id,store_id,provider_code,environment,enabled,secret_ref,public_config,metadata")
      .eq("store_id", storeId)
      .eq("provider_code", "optma_sandbox")
      .eq("environment", "sandbox")
      .maybeSingle();

    if (providerError || !provider) {
      return reply({ ok: false, error: "optmapay_provider_not_configured" }, 409, origin);
    }

    const accountId = String(
      provider.public_config?.optmapay_account_id ||
      Deno.env.get("OPTMAPAY_SANDBOX_ACCOUNT_ID") ||
      "",
    ).trim();
    const apiSecret = await resolveOptmaPaySecret(
      service,
      provider.secret_ref,
      "OPTMAPAY_SANDBOX_API_KEY",
    );

    async function loadAccount() {
      if (!accountId) throw new Error("OPTMAPAY_ACCOUNT_NOT_CONFIGURED");
      if (!apiSecret.value) throw new Error("OPTMAPAY_API_KEY_NOT_CONFIGURED");
      const data = await optmaPayFetch(baseUrl, "/api/sandbox/v1/account", apiSecret.value, accountId);
      const account = data?.account || {};
      if (String(account.id || "") !== accountId) throw new Error("OPTMAPAY_ACCOUNT_MISMATCH");
      return account;
    }

    if (action === "status") {
      let account: any = null;
      let connectionError: string | null = null;
      try {
        const loaded = await loadAccount();
        account = {
          id: loaded.id,
          name: loaded.name,
          type: loaded.type,
          pixKey: loaded.pixKey,
        };
      } catch (error) {
        connectionError = error instanceof Error ? error.message : "OPTMAPAY_CONNECTION_FAILED";
      }

      const credentialStatus = account ? "ready" : apiSecret.value ? "invalid" : "not_configured";
      await service.rpc("mark_online_payment_provider_credential_status_internal", {
        p_store_id: storeId,
        p_provider_code: "optma_sandbox",
        p_environment: "sandbox",
        p_status: credentialStatus,
        p_metadata: {
          checked_at: new Date().toISOString(),
          adapter: "optmapay_external",
          api_key_secret_ref: apiSecret.name,
          credential_storage: apiSecret.source,
          account_configured: Boolean(accountId),
        },
      });

      return reply({
        ok: true,
        environment: "sandbox",
        realMoney: false,
        baseUrl,
        configured: Boolean(accountId && apiSecret.value),
        credentialStatus,
        account,
        error: connectionError,
      }, 200, origin);
    }

    if (!workspace?.permissions?.manage) {
      return reply({ ok: false, error: "manage_permission_required" }, 403, origin);
    }
    if (!provider.enabled) {
      return reply({ ok: false, error: "optmapay_provider_inactive" }, 409, origin);
    }

    if (action === "createPixIntent") {
      const amount = Number(body?.amount || 0);
      if (!(amount > 0) || !Number.isFinite(amount)) {
        return reply({ ok: false, error: "invalid_amount" }, 400, origin);
      }

      const roundedAmount = Math.round(amount * 100) / 100;
      const account = await loadAccount();
      const pixKey = String(account?.pixKey || "").trim();
      if (!pixKey) return reply({ ok: false, error: "merchant_pix_key_not_configured" }, 409, origin);

      const intentId = crypto.randomUUID();
      const externalReference = buildOptmaMenuPixReference(storeId, intentId);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const description = String(body?.description || "Pagamento OptmaMenu").slice(0, 120);
      const payload = new URL("OPTMAPAY://PIX/v1");
      payload.searchParams.set("to", pixKey);
      payload.searchParams.set("amount", roundedAmount.toFixed(2));
      payload.searchParams.set("ref", externalReference);
      payload.searchParams.set("desc", description);
      payload.searchParams.set("env", "sandbox");
      payload.searchParams.set("ts", String(Math.floor(expiresAt.getTime() / 1000)));

      const { data: intent, error: intentError } = await service
        .from("online_payment_intents")
        .insert({
          id: intentId,
          store_id: storeId,
          order_id: body?.orderId || null,
          provider_id: provider.id,
          method_code: "pix",
          amount: roundedAmount,
          status: "pending",
          external_reference: externalReference,
          pix_payload: payload.toString(),
          provider_snapshot: {
            account_id: account.id,
            account_name: account.name,
            pix_key: pixKey,
            environment: "sandbox",
            realMoney: false,
          },
          metadata: {
            sandbox: true,
            provider_contract: "optmapay_sandbox_v1",
            checkout_mode: "embedded",
            idempotency_key: externalReference,
          },
          expires_at: expiresAt.toISOString(),
          created_by: null,
        })
        .select("id,store_id,order_id,provider_id,method_code,amount,status,external_reference,pix_payload,expires_at,created_at")
        .single();

      if (intentError) throw intentError;
      return reply({ ok: true, intent, environment: "sandbox", realMoney: false }, 200, origin);
    }

    return reply({ ok: false, error: "unsupported_action" }, 400, origin);
  } catch (error) {
    console.error("optmapay-sandbox-adapter", error instanceof Error ? error.message : String(error));
    return reply({ ok: false, error: "adapter_error" }, 500, req.headers.get("origin"));
  }
});
