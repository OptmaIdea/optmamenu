import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { resolveOptmaPaySecret } from "../_shared/optmapaySecrets.ts";

const jsonHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };

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
    headers: { ...jsonHeaders, ...cors(origin) },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply({ ok: false, error: "method_not_allowed" }, 405, origin);

  try {
    const authHeader = req.headers.get("authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const service = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const action = String(body?.action || "status");
    const storeId = String(body?.storeId || "").trim();

    if (!storeId) return reply({ ok: false, error: "store_required" }, 400, origin);

    const { data: workspace, error: workspaceError } = await userClient.rpc(
      "get_online_payments_workspace_safe",
      { p_store_id: storeId },
    );

    if (workspaceError || !workspace?.ok) {
      return reply({ ok: false, error: "access_denied" }, 403, origin);
    }

    if (!workspace?.permissions?.credentials) {
      return reply({ ok: false, error: "credentials_permission_required" }, 403, origin);
    }

    const { data: provider, error: providerError } = await service
      .from("store_online_payment_providers")
      .select("id,credential_status,secret_ref,public_config,metadata")
      .eq("store_id", storeId)
      .eq("provider_code", "optma_sandbox")
      .eq("environment", "sandbox")
      .maybeSingle();

    if (providerError) {
      return reply({ ok: false, error: "provider_lookup_failed" }, 500, origin);
    }

    const webhookUrl = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/optmapay-sandbox-webhook`;

    if (action === "status") {
      const apiSecret = await resolveOptmaPaySecret(
        service,
        provider?.secret_ref,
        "OPTMAPAY_SANDBOX_API_KEY",
      );
      const webhookSecret = await resolveOptmaPaySecret(
        service,
        provider?.metadata?.webhook_secret_ref,
        "OPTMAPAY_SANDBOX_WEBHOOK_SECRET",
      );

      return reply({
        ok: true,
        accountId: provider?.public_config?.optmapay_account_id || null,
        settlementFinancialAccountId: provider?.public_config?.settlement_financial_account_id || null,
        apiKeyConfigured: Boolean(apiSecret.value),
        webhookSecretConfigured: Boolean(webhookSecret.value),
        credentialStatus: provider?.credential_status || "not_configured",
        webhookUrl,
        storage: provider?.metadata?.credential_storage || (apiSecret.source === "supabase_vault" ? "supabase_vault" : apiSecret.source),
      }, 200, origin);
    }

    if (action !== "save") {
      return reply({ ok: false, error: "unsupported_action" }, 400, origin);
    }

    const accountId = String(body?.accountId || "").trim();
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : null;
    const webhookSecret = typeof body?.webhookSecret === "string" ? body.webhookSecret.trim() : null;
    const settlementFinancialAccountId = body?.settlementFinancialAccountId
      ? String(body.settlementFinancialAccountId)
      : null;

    if (!/^[0-9a-fA-F-]{36}$/.test(accountId)) {
      return reply({ ok: false, error: "invalid_account_id" }, 400, origin);
    }

    const { data, error } = await service.rpc(
      "configure_optmapay_sandbox_credentials_internal",
      {
        p_store_id: storeId,
        p_account_id: accountId,
        p_api_key: apiKey || null,
        p_webhook_secret: webhookSecret || null,
        p_settlement_financial_account_id: settlementFinancialAccountId,
      },
    );

    if (error) {
      console.error("optmapay-credentials:configure", error.code || "rpc_error");
      return reply({ ok: false, error: "credential_save_failed" }, 500, origin);
    }
    if (!data?.ok) return reply(data, 400, origin);

    return reply({
      ok: true,
      accountId: data.account_id,
      settlementFinancialAccountId: data.settlement_financial_account_id,
      apiKeyConfigured: Boolean(data.api_key_configured),
      webhookSecretConfigured: Boolean(data.webhook_secret_configured),
      credentialStatus: data.credential_status,
      webhookUrl,
      storage: "supabase_vault",
    }, 200, origin);
  } catch (error) {
    console.error("optmapay-credentials", error instanceof Error ? error.message : "unexpected_error");
    return reply({ ok: false, error: "internal_error" }, 500, origin);
  }
});
