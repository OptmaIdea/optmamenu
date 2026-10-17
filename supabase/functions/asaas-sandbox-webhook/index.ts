import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function safePayload(value: any) {
  if (!value || typeof value !== "object") return {};
  const clone = structuredClone(value);
  delete clone.creditCard;
  delete clone.creditCardHolderInfo;
  delete clone.access_token;
  return clone;
}

function mapStatus(eventType: string, paymentStatus?: string | null) {
  if (eventType === "PAYMENT_RECEIVED" || paymentStatus === "RECEIVED") return "paid";
  // Para cartão, CONFIRMED significa concluído, mas o saldo ainda não está disponível.
  if (eventType === "PAYMENT_CONFIRMED" || paymentStatus === "CONFIRMED" || paymentStatus === "AUTHORIZED") return "authorized";
  if (eventType.includes("PARTIALLY_REFUNDED")) return "partially_refunded";
  if (eventType.includes("REFUNDED") || paymentStatus === "REFUNDED") return "refunded";
  if (eventType.includes("DELETED") || paymentStatus === "DELETED") return "cancelled";
  if (eventType.includes("OVERDUE") || paymentStatus === "OVERDUE") return "failed";
  if (eventType === "PAYMENT_CREATED" || paymentStatus === "PENDING") return "pending";
  return null;
}

function resolveStatus(currentStatus: string | null | undefined, nextStatus: string | null) {
  if (!nextStatus) return currentStatus || "pending";
  if (["refunded", "partially_refunded", "cancelled"].includes(currentStatus || "")) return currentStatus!;
  if (currentStatus === "paid" && ["pending", "authorized"].includes(nextStatus)) return currentStatus;
  return nextStatus;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  const expectedToken = Deno.env.get("ASAAS_SANDBOX_WEBHOOK_TOKEN") || "";
  const receivedToken = req.headers.get("asaas-access-token") || "";
  if (!expectedToken || receivedToken !== expectedToken) return json({ ok: false, error: "invalid_webhook_token" }, 401);

  try {
    const payload = await req.json();
    const eventType = String(payload?.event || "UNKNOWN");
    const payment = payload?.payment || {};
    const paymentId = payment?.id ? String(payment.id) : null;
    const externalReference = payment?.externalReference ? String(payment.externalReference) : "";
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let intent: any = null;
    if (paymentId) {
      const { data } = await service.from("online_payment_intents").select("id,store_id,provider_id,status,order_id").eq("external_payment_id", paymentId).maybeSingle();
      intent = data;
    }

    let storeId: string | null = intent?.store_id || null;
    if (!storeId && externalReference.startsWith("optmamenu:")) {
      const parts = externalReference.split(":");
      if (parts.length >= 2) storeId = parts[1] || null;
    }
    if (!storeId) return json({ ok: true, ignored: true, reason: "unmapped_payment" }, 202);

    let providerId: string | null = intent?.provider_id || null;
    if (!providerId) {
      const { data: provider } = await service.from("store_online_payment_providers").select("id").eq("store_id", storeId).eq("provider_code", "asaas").eq("environment", "sandbox").maybeSingle();
      providerId = provider?.id || null;
    }
    if (!providerId) return json({ ok: true, ignored: true, reason: "provider_not_configured" }, 202);

    const eventMoment = payment?.confirmedDate || payment?.paymentDate || payment?.clientPaymentDate || payment?.dateCreated || payload?.dateCreated || "";
    const idempotencyKey = `asaas:${eventType}:${paymentId || externalReference || "unknown"}:${eventMoment}`;
    const requestedStatus = mapStatus(eventType, payment?.status);
    const mappedStatus = resolveStatus(intent?.status, requestedStatus);

    const { error: eventError } = await service.from("online_payment_events").upsert({
      store_id: storeId,
      provider_id: providerId,
      intent_id: intent?.id || null,
      external_event_id: payload?.id || null,
      event_type: eventType,
      event_status: payment?.status || requestedStatus || mappedStatus,
      signature_valid: true,
      // O evento só é marcado como processado após a liquidação idempotente.
      processed: false,
      idempotency_key: idempotencyKey,
      payload_sanitized: safePayload(payload),
      processed_at: null,
    }, { onConflict: "store_id,provider_id,idempotency_key", ignoreDuplicates: true });
    if (eventError) throw eventError;

    if (intent?.id) {
      const patch: Record<string, unknown> = { provider_snapshot: safePayload(payment), updated_at: new Date().toISOString() };
      if (requestedStatus) patch.status = mappedStatus;
      if (mappedStatus === "paid" && intent.status !== "paid") patch.paid_at = new Date().toISOString();
      const { error: intentError } = await service
        .from("online_payment_intents")
        .update(patch)
        .eq("id", intent.id)
        .eq("store_id", storeId);
      if (intentError) throw intentError;

      // Apenas PAYMENT_RECEIVED (saldo disponível) pode liquidar pedido e livro caixa.
      if (requestedStatus === "paid") {
        const { data: settlement, error: settlementError } = await service.rpc("apply_online_payment_settlement_internal", {
          p_intent_id: intent.id,
          p_provider_event_id: payload?.id ? String(payload.id) : null,
        });
        if (settlementError) throw settlementError;
        if (!settlement?.ok) {
          throw new Error("online_payment_settlement:" + (settlement?.error || "failed"));
        }
      }

      const { error: processedError } = await service
        .from("online_payment_events")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq("store_id", storeId)
        .eq("provider_id", providerId)
        .eq("idempotency_key", idempotencyKey);
      if (processedError) throw processedError;
    }

    return json({ ok: true, event: eventType, mappedStatus, intentId: intent?.id || null });
  } catch (error) {
    console.error("asaas-sandbox-webhook", error);
    return json({ ok: false, error: "webhook_processing_failed" }, 500);
  }
});
