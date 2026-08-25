import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ASAAS_BASE = "https://api-sandbox.asaas.com/v3";
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

async function asaasFetch(path: string, key: string, init: RequestInit = {}) {
  const response = await fetch(`${ASAAS_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "OptmaMenu-HML/0.10.0-rc.1",
      access_token: key,
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(`ASAAS_${response.status}:${JSON.stringify(data)}`);
  return data;
}

function paymentStatusFromAsaas(status?: string | null) {
  switch (status) {
    case "RECEIVED":
    case "CONFIRMED":
      return "paid";
    case "REFUNDED":
      return "refunded";
    case "REFUND_REQUESTED":
      return "pending";
    case "OVERDUE":
      return "failed";
    case "DELETED":
      return "cancelled";
    default:
      return "pending";
  }
}

function safeProviderPayload(data: any) {
  if (!data || typeof data !== "object") return {};
  const clone = structuredClone(data);
  delete clone.creditCard;
  delete clone.creditCardHolderInfo;
  delete clone.access_token;
  return clone;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply({ ok: false, error: "method_not_allowed" }, 405, origin);

  try {
    const authHeader = req.headers.get("authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const merchantKey = Deno.env.get("ASAAS_SANDBOX_API_KEY_MERCHANT") || "";
    const buyerKey = Deno.env.get("ASAAS_SANDBOX_API_KEY_BUYER") || "";

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const service = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const storeId = String(body.storeId || "");
    const action = String(body.action || "status");
    if (!storeId) return reply({ ok: false, error: "store_required" }, 400, origin);

    const { data: workspace, error: workspaceError } = await userClient.rpc("get_online_payments_workspace_safe", { p_store_id: storeId });
    if (workspaceError || !workspace?.ok) return reply({ ok: false, error: "access_denied" }, 403, origin);
    const canManage = Boolean(workspace?.permissions?.manage);

    if (action === "status") {
      let merchantBalance: unknown = null;
      let buyerBalance: unknown = null;
      let merchantError: string | null = null;
      let buyerError: string | null = null;
      if (merchantKey) {
        try { merchantBalance = await asaasFetch("/finance/balance", merchantKey); }
        catch (error) { merchantError = String(error); }
      }
      if (buyerKey) {
        try { buyerBalance = await asaasFetch("/finance/balance", buyerKey); }
        catch (error) { buyerError = String(error); }
      }

      const credentialStatus = merchantKey && !merchantError ? "ready" : merchantKey ? "invalid" : "not_configured";
      await service.rpc("mark_online_payment_provider_credential_status_internal", {
        p_store_id: storeId,
        p_provider_code: "asaas",
        p_environment: "sandbox",
        p_status: credentialStatus,
        p_metadata: { checked_at: new Date().toISOString(), merchant_configured: Boolean(merchantKey), buyer_configured: Boolean(buyerKey) },
      });

      return reply({
        ok: true,
        environment: "sandbox",
        baseUrl: ASAAS_BASE,
        merchantConfigured: Boolean(merchantKey),
        buyerConfigured: Boolean(buyerKey),
        merchantBalance,
        buyerBalance,
        merchantError,
        buyerError,
      }, 200, origin);
    }

    if (!canManage) return reply({ ok: false, error: "manage_permission_required" }, 403, origin);
    if (!merchantKey) return reply({ ok: false, error: "merchant_api_key_not_configured" }, 409, origin);

    const { data: provider, error: providerError } = await service
      .from("store_online_payment_providers")
      .select("id,enabled")
      .eq("store_id", storeId)
      .eq("provider_code", "asaas")
      .eq("environment", "sandbox")
      .maybeSingle();
    if (providerError || !provider) return reply({ ok: false, error: "asaas_provider_not_configured" }, 409, origin);

    if (action === "createCustomer") {
      const customer = await asaasFetch("/customers", merchantKey, {
        method: "POST",
        body: JSON.stringify({
          name: body.customer?.name || "Cliente Sandbox OptmaMenu",
          cpfCnpj: body.customer?.cpfCnpj || "24971563792",
          email: body.customer?.email || "sandbox-comprador@optmamenu.invalid",
          mobilePhone: body.customer?.mobilePhone || "11999999999",
          notificationDisabled: true,
          externalReference: body.customer?.externalReference || `optmamenu-sbx-${crypto.randomUUID()}`,
        }),
      });
      return reply({ ok: true, customer: safeProviderPayload(customer) }, 200, origin);
    }

    if (action === "createPixCharge") {
      const amount = Number(body.amount || 0);
      if (!(amount > 0)) return reply({ ok: false, error: "invalid_amount" }, 400, origin);
      const customer = await asaasFetch("/customers", merchantKey, {
        method: "POST",
        body: JSON.stringify({
          name: body.customer?.name || "Cliente Sandbox OptmaMenu",
          cpfCnpj: body.customer?.cpfCnpj || "24971563792",
          email: body.customer?.email || "sandbox-comprador@optmamenu.invalid",
          mobilePhone: body.customer?.mobilePhone || "11999999999",
          notificationDisabled: true,
          externalReference: `optmamenu:${storeId}:customer:${crypto.randomUUID()}`,
        }),
      });
      const externalReference = `optmamenu:${storeId}:${crypto.randomUUID()}`;
      const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const payment = await asaasFetch("/payments", merchantKey, {
        method: "POST",
        body: JSON.stringify({ customer: customer.id, billingType: "PIX", value: amount, dueDate, description: body.description || "Pagamento Sandbox OptmaMenu", externalReference }),
      });
      const qr = await asaasFetch(`/payments/${payment.id}/pixQrCode`, merchantKey);
      const { data: intent, error: intentError } = await service.from("online_payment_intents").insert({
        store_id: storeId,
        order_id: body.orderId || null,
        provider_id: provider.id,
        method_code: "pix",
        amount,
        status: paymentStatusFromAsaas(payment.status),
        external_customer_id: customer.id,
        external_payment_id: payment.id,
        external_reference: externalReference,
        checkout_url: payment.invoiceUrl || null,
        pix_payload: qr.payload || null,
        pix_qr_code_url: qr.encodedImage ? `data:image/png;base64,${qr.encodedImage}` : null,
        provider_snapshot: safeProviderPayload(payment),
        metadata: { sandbox: true, asaas_qr_expiration: qr.expirationDate || null },
        created_by: null,
      }).select("id,status,external_payment_id,amount,method_code,created_at").single();
      if (intentError) throw intentError;
      return reply({ ok: true, intent, payment: safeProviderPayload(payment), qr: { payload: qr.payload, encodedImage: qr.encodedImage, expirationDate: qr.expirationDate } }, 200, origin);
    }

    if (action === "payPix") {
      if (!buyerKey) return reply({ ok: false, error: "buyer_api_key_not_configured" }, 409, origin);
      const payload = String(body.payload || "");
      const amount = Number(body.amount || 0);
      if (!payload || !(amount > 0)) return reply({ ok: false, error: "pix_payload_and_amount_required" }, 400, origin);
      const result = await asaasFetch("/pix/qrCodes/pay", buyerKey, {
        method: "POST",
        body: JSON.stringify({ qrCode: { payload }, value: amount, description: "Pagamento Sandbox OptmaMenu" }),
      });
      return reply({ ok: true, result: safeProviderPayload(result) }, 200, origin);
    }

    if (action === "createPaymentLink") {
      const amount = Number(body.amount || 0);
      if (!(amount > 0)) return reply({ ok: false, error: "invalid_amount" }, 400, origin);
      const link = await asaasFetch("/paymentLinks", merchantKey, {
        method: "POST",
        body: JSON.stringify({
          name: body.name || "Checkout Sandbox OptmaMenu",
          description: body.description || "Link fictício de homologação OptmaMenu",
          value: amount,
          billingType: body.billingType || "UNDEFINED",
          chargeType: "DETACHED",
          dueDateLimitDays: 3,
        }),
      });
      const { data: intent, error: intentError } = await service.from("online_payment_intents").insert({
        store_id: storeId,
        provider_id: provider.id,
        method_code: "payment_link",
        amount,
        status: "pending",
        external_payment_id: link.id || null,
        external_reference: `optmamenu:${storeId}:payment-link:${crypto.randomUUID()}`,
        checkout_url: link.url || null,
        provider_snapshot: safeProviderPayload(link),
        metadata: { sandbox: true },
      }).select("id,status,external_payment_id,amount,method_code,checkout_url,created_at").single();
      if (intentError) throw intentError;
      return reply({ ok: true, intent, link: safeProviderPayload(link) }, 200, origin);
    }

    return reply({ ok: false, error: "unsupported_action" }, 400, origin);
  } catch (error) {
    console.error("asaas-sandbox-adapter", error);
    return reply({ ok: false, error: "adapter_error", detail: String(error).slice(0, 600) }, 500, req.headers.get("origin"));
  }
});
