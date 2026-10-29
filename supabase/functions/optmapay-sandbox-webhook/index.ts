import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  parseOptmaMenuPaymentReference,
  verifyOptmaPayWebhook,
} from "../_shared/optmapayWebhook.ts";
import { resolveOptmaPaySecret } from "../_shared/optmapaySecrets.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

const SENSITIVE_KEYS = new Set([
  "cvv", "cvc", "pin", "password", "cardnumber", "card_number", "pan", "fullpan", "full_pan",
]);

function sanitizedPayload(payload: any): any {
  if (Array.isArray(payload)) return payload.map(sanitizedPayload);
  if (!payload || typeof payload !== "object") return payload;
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (SENSITIVE_KEYS.has(normalized) || normalized === "senderdocument" || normalized === "payerdocument") continue;
    safe[key] = sanitizedPayload(value);
  }
  return safe;
}

function eventData(payload: any) {
  return payload?.data && typeof payload.data === "object" ? payload.data : payload;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const rawBody = await req.text();
  const signature = req.headers.get("x-optmapay-signature") || "";
  const timestamp = req.headers.get("x-optmapay-timestamp") || "";
  const eventId = req.headers.get("x-optmapay-event-id") || "";
  const eventHeader = req.headers.get("x-optmapay-event") || "";
  const environment = req.headers.get("x-optmapay-environment") || "";
  const realMoney = req.headers.get("x-optmapay-real-money") || "";

  if (!eventId || !timestamp || !signature) return json({ ok: false, error: "missing_signature_headers" }, 401);
  if (environment !== "sandbox" || realMoney !== "false") return json({ ok: false, error: "sandbox_boundary_rejected" }, 403);

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  if (payload?.environment !== "sandbox" || payload?.realMoney !== false) {
    return json({ ok: false, error: "sandbox_payload_rejected" }, 403);
  }
  if (payload?.id && String(payload.id) !== eventId) {
    return json({ ok: false, error: "event_id_mismatch" }, 400);
  }

  const data = eventData(payload);
  const eventType = String(payload?.event || data?.event || eventHeader || "");
  if (eventHeader && eventType !== eventHeader) return json({ ok: false, error: "event_type_mismatch" }, 400);

  const supported = new Set(["pix.paid", "card.paid", "payment.settled", "receivable.settled"]);
  if (!supported.has(eventType)) return json({ ok: true, ignored: true, reason: "unsupported_event" }, 202);

  const externalReference = String(
    data?.externalReference || data?.external_reference || data?.orderId || data?.order_id || "",
  );
  const reference = parseOptmaMenuPaymentReference(externalReference);
  if (!reference) return json({ ok: true, ignored: true, reason: "unmapped_reference" }, 202);

  if (eventType === "pix.paid" && reference.method !== "pix") {
    return json({ ok: true, ignored: true, reason: "event_method_mismatch" }, 202);
  }
  if (eventType === "card.paid" && !["debit_card", "credit_card"].includes(reference.method)) {
    return json({ ok: true, ignored: true, reason: "event_method_mismatch" }, 202);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const service = createClient(supabaseUrl, serviceKey);

  try {
    const { data: intent, error: intentError } = await service
      .from("online_payment_intents")
      .select("id,store_id,provider_id,order_id,method_code,amount,status,external_payment_id,external_reference,metadata,provider_snapshot")
      .eq("id", reference.intentId)
      .eq("store_id", reference.storeId)
      .maybeSingle();

    if (intentError) throw intentError;
    if (!intent || intent.method_code !== reference.method || intent.external_reference !== externalReference) {
      return json({ ok: true, ignored: true, reason: "intent_not_found" }, 202);
    }

    const { data: provider, error: providerError } = await service
      .from("store_online_payment_providers")
      .select("id,store_id,provider_code,environment,enabled,secret_ref,public_config,metadata")
      .eq("id", intent.provider_id)
      .eq("store_id", intent.store_id)
      .eq("provider_code", "optma_sandbox")
      .eq("environment", "sandbox")
      .maybeSingle();

    if (providerError) throw providerError;
    if (!provider || !provider.enabled) return json({ ok: false, error: "provider_inactive" }, 409);

    const webhookSecretRef = String(
      provider.metadata?.webhook_secret_ref || "OPTMAPAY_SANDBOX_WEBHOOK_SECRET",
    ).trim();
    if (!/^OPTMAPAY_[A-Z0-9_]{3,119}$/.test(webhookSecretRef)) {
      return json({ ok: false, error: "invalid_webhook_secret_ref" }, 500);
    }

    const webhookSecret = await resolveOptmaPaySecret(
      service,
      webhookSecretRef,
      "OPTMAPAY_SANDBOX_WEBHOOK_SECRET",
    );
    if (!webhookSecret.value) return json({ ok: false, error: "webhook_secret_not_configured" }, 500);

    const verification = await verifyOptmaPayWebhook({
      secret: webhookSecret.value,
      signatureHeader: signature,
      timestampHeader: timestamp,
      eventId,
      rawBody,
      toleranceSeconds: 300,
    });
    if (!verification.ok) {
      return json(
        { ok: false, error: verification.reason === "replay" ? "replay_rejected" : "invalid_signature" },
        401,
      );
    }

    if (eventType === "pix.paid") {
      const expectedAccountId = String(provider.public_config?.optmapay_account_id || "").trim();
      const receivedAccountId = String(data?.receiverAccountId || data?.receiver_account_id || "").trim();
      if (expectedAccountId && receivedAccountId !== expectedAccountId) {
        return json({ ok: false, error: "merchant_account_mismatch" }, 409);
      }
    }

    const receivedAmount = Number(
      data?.amount ?? data?.amountGross ?? data?.grossAmount ?? data?.amount_gross ?? data?.gross_amount,
    );
    if (!Number.isFinite(receivedAmount) || Math.abs(receivedAmount - Number(intent.amount)) > 0.005) {
      return json({ ok: false, error: "payment_amount_mismatch" }, 409);
    }

    const idempotencyKey = `optmapay:${eventId}`;
    const eventRow = {
      store_id: intent.store_id,
      provider_id: provider.id,
      intent_id: intent.id,
      external_event_id: eventId,
      event_type: eventType,
      event_status: String(data?.status || (eventType.includes("settled") ? "settled" : "paid")),
      signature_valid: true,
      processed: false,
      idempotency_key: idempotencyKey,
      payload_sanitized: sanitizedPayload(payload),
      processed_at: null,
    };

    const { error: insertEventError } = await service.from("online_payment_events").insert(eventRow);
    if (insertEventError && insertEventError.code !== "23505") throw insertEventError;

    if (insertEventError?.code === "23505") {
      const { data: existing } = await service
        .from("online_payment_events")
        .select("processed")
        .eq("store_id", intent.store_id)
        .eq("provider_id", provider.id)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existing?.processed) return json({ ok: true, duplicate: true, eventId, intentId: intent.id });
    }

    let processing: any = null;

    if (eventType === "payment.settled" || eventType === "receivable.settled") {
      if (reference.method === "pix") return json({ ok: true, ignored: true, reason: "pix_settlement_not_separate" }, 202);
      const settledAt = String(data?.settledAt || data?.settled_at || data?.occurredAt || payload?.createdAt || new Date().toISOString());
      const netAmount = Number(data?.amountNet ?? data?.netAmount ?? data?.amount_net ?? data?.net_amount ?? data?.amount);
      const { data: settlement, error: settlementError } = await service.rpc(
        "apply_online_card_receivable_settlement_internal",
        {
          p_intent_id: intent.id,
          p_provider_event_id: eventId,
          p_settled_at: settledAt,
          p_net_amount: Number.isFinite(netAmount) ? netAmount : null,
        },
      );
      if (settlementError) throw settlementError;
      if (!settlement?.ok) throw new Error(`card_settlement_failed:${settlement?.error || "unknown"}`);
      processing = settlement;
    } else {
      const paidAt = String(data?.paidAt || data?.paid_at || data?.occurredAt || payload?.createdAt || new Date().toISOString());
      const transactionId = String(data?.transactionId || data?.transaction_id || "");

      if (intent.status !== "paid") {
        const { error: updateIntentError } = await service
          .from("online_payment_intents")
          .update({
            status: "paid",
            external_payment_id: transactionId || intent.external_payment_id || null,
            paid_at: paidAt,
            provider_snapshot: sanitizedPayload({ ...(intent.provider_snapshot || {}), ...data }),
            updated_at: new Date().toISOString(),
          })
          .eq("id", intent.id)
          .eq("store_id", intent.store_id);
        if (updateIntentError) throw updateIntentError;
      }

      if (eventType === "pix.paid") {
        const { data: settlement, error: settlementError } = await service.rpc(
          "apply_online_payment_settlement_internal",
          { p_intent_id: intent.id, p_provider_event_id: eventId },
        );
        if (settlementError) throw settlementError;
        if (!settlement?.ok) throw new Error(`settlement_failed:${settlement?.error || "unknown"}`);
        processing = settlement;
      } else {
        const safeData = sanitizedPayload({ ...(intent.provider_snapshot || {}), ...data });
        const { data: cardResult, error: cardError } = await service.rpc(
          "apply_online_card_payment_confirmed_internal",
          { p_intent_id: intent.id, p_provider_event_id: eventId, p_provider_data: safeData },
        );
        if (cardError) throw cardError;
        if (!cardResult?.ok) throw new Error(`card_confirmation_failed:${cardResult?.error || "unknown"}`);
        processing = cardResult;
      }
    }

    const { error: processedError } = await service
      .from("online_payment_events")
      .update({ processed: true, processed_at: new Date().toISOString(), error_message: null })
      .eq("store_id", intent.store_id)
      .eq("provider_id", provider.id)
      .eq("idempotency_key", idempotencyKey);
    if (processedError) throw processedError;

    return json({ ok: true, event: eventType, eventId, intentId: intent.id, processing });
  } catch (error) {
    console.error("optmapay-sandbox-webhook", error instanceof Error ? error.message : String(error));
    return json({ ok: false, error: "webhook_processing_failed" }, 500);
  }
});
