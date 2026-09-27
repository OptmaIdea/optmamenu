import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  parseOptmaMenuPixReference,
  verifyOptmaPayWebhook,
} from "../_shared/optmapayWebhook.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function sanitizedPayload(payload: any) {
  if (!payload || typeof payload !== "object") return {};
  const clone = structuredClone(payload);
  if (clone?.data && typeof clone.data === "object") {
    delete clone.data.senderDocument;
    delete clone.data.payerDocument;
  }
  return clone;
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

  if (!eventId || !timestamp || !signature) {
    return json({ ok: false, error: "missing_signature_headers" }, 401);
  }
  if (environment !== "sandbox" || realMoney !== "false") {
    return json({ ok: false, error: "sandbox_boundary_rejected" }, 403);
  }

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

  const eventType = String(payload?.event || eventHeader || "");
  if (eventHeader && eventType !== eventHeader) {
    return json({ ok: false, error: "event_type_mismatch" }, 400);
  }
  if (eventType !== "pix.paid") {
    return json({ ok: true, ignored: true, reason: "unsupported_event" }, 202);
  }

  const externalReference = String(
    payload?.data?.externalReference ||
    payload?.data?.orderId ||
    "",
  );
  const reference = parseOptmaMenuPixReference(externalReference);
  if (!reference) return json({ ok: true, ignored: true, reason: "unmapped_reference" }, 202);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const service = createClient(supabaseUrl, serviceKey);

  try {
    const { data: intent, error: intentError } = await service
      .from("online_payment_intents")
      .select("id,store_id,provider_id,order_id,method_code,amount,status,external_reference,metadata")
      .eq("id", reference.intentId)
      .eq("store_id", reference.storeId)
      .maybeSingle();

    if (intentError) throw intentError;
    if (!intent || intent.method_code !== "pix" || intent.external_reference !== externalReference) {
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
    if (!provider || !provider.enabled) {
      return json({ ok: false, error: "provider_inactive" }, 409);
    }

    const webhookSecretRef = String(
      provider.metadata?.webhook_secret_ref ||
      "OPTMAPAY_SANDBOX_WEBHOOK_SECRET",
    ).trim();
    if (!/^[A-Z][A-Z0-9_]{2,127}$/.test(webhookSecretRef)) {
      return json({ ok: false, error: "invalid_webhook_secret_ref" }, 500);
    }

    const webhookSecret = Deno.env.get(webhookSecretRef) || "";
    if (!webhookSecret) {
      return json({ ok: false, error: "webhook_secret_not_configured" }, 500);
    }

    const verification = await verifyOptmaPayWebhook({
      secret: webhookSecret,
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

    const expectedAccountId = String(provider.public_config?.optmapay_account_id || "").trim();
    const receivedAccountId = String(payload?.data?.receiverAccountId || "").trim();
    if (expectedAccountId && receivedAccountId !== expectedAccountId) {
      return json({ ok: false, error: "merchant_account_mismatch" }, 409);
    }

    const receivedAmount = Number(payload?.data?.amount);
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
      event_status: String(payload?.data?.status || "paid"),
      signature_valid: true,
      processed: false,
      idempotency_key: idempotencyKey,
      payload_sanitized: sanitizedPayload(payload),
      processed_at: null,
    };

    const { error: insertEventError } = await service
      .from("online_payment_events")
      .insert(eventRow);

    if (insertEventError && insertEventError.code !== "23505") throw insertEventError;

    if (insertEventError?.code === "23505") {
      const { data: existing } = await service
        .from("online_payment_events")
        .select("processed")
        .eq("store_id", intent.store_id)
        .eq("provider_id", provider.id)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existing?.processed) {
        return json({ ok: true, duplicate: true, eventId, intentId: intent.id });
      }
    }

    const paidAt = String(payload?.data?.paidAt || payload?.createdAt || new Date().toISOString());
    const transactionId = String(payload?.data?.transactionId || "");

    if (intent.status !== "paid") {
      const { error: updateIntentError } = await service
        .from("online_payment_intents")
        .update({
          status: "paid",
          external_payment_id: transactionId || null,
          paid_at: paidAt,
          provider_snapshot: sanitizedPayload(payload?.data || {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", intent.id)
        .eq("store_id", intent.store_id);
      if (updateIntentError) throw updateIntentError;
    }

    const { data: settlement, error: settlementError } = await service.rpc(
      "apply_online_payment_settlement_internal",
      {
        p_intent_id: intent.id,
        p_provider_event_id: eventId,
      },
    );
    if (settlementError) throw settlementError;
    if (!settlement?.ok) throw new Error(`settlement_failed:${settlement?.error || "unknown"}`);

    const { error: processedError } = await service
      .from("online_payment_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("store_id", intent.store_id)
      .eq("provider_id", provider.id)
      .eq("idempotency_key", idempotencyKey);
    if (processedError) throw processedError;

    return json({
      ok: true,
      event: eventType,
      eventId,
      intentId: intent.id,
      settlement,
    });
  } catch (error) {
    console.error("optmapay-sandbox-webhook", error instanceof Error ? error.message : String(error));
    return json({ ok: false, error: "webhook_processing_failed" }, 500);
  }
});
