import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function response(payload: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}
function escapeHtml(v: unknown) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function normalizeSecret(v: unknown) {
  return String(v || "").trim().replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^BREVO_API_KEY\s*=\s*/i, "").replace(/\s+/g, "");
}
function senderEmail(v: unknown) {
  const raw = String(v || "");
  return raw.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1]
    || raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
}
const genericConfirmation = {
  ok: true,
  message: "Se houver uma conta ativa com e-mail confirmado, enviaremos um código válido por 5 minutos.",
};

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return response({ ok: true }, 200, origin);
  if (req.method !== "POST") return response({ ok: false, error: "method_not_allowed" }, 405, origin);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  if (!serviceKey || !supabaseUrl) {
    return response({ ok: false, error: "server_configuration_error" }, 503, origin);
  }
  let input: Record<string, unknown>;
  try { input = await req.json(); }
  catch { return response({ ok: false, error: "invalid_request" }, 400, origin); }

  const storeId = String(input.storeId || "");
  const phone = String(input.phone || "").trim();
  const action = String(input.action || "");
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(storeId) || phone.length < 8 || phone.length > 32) {
    return response({ ok: false, error: "invalid_request" }, 400, origin);
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (action === "complete") {
    const otp = String(input.otp || "").replace(/\D/g, "");
    const newPassword = String(input.newPassword || "");
    if (!/^\d{6}$/.test(otp)) {
      return response({ ok: false, error: "invalid_or_expired_otp" }, 200, origin);
    }
    if (newPassword.length < 8 || newPassword.length > 72 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return response({ ok: false, error: "weak_password" }, 200, origin);
    }
    const { data, error } = await service.rpc("customer_reset_password_with_otp_service_safe", {
      p_store_id: storeId,
      p_phone: phone,
      p_otp: otp,
      p_new_password: newPassword,
    });
    if (error) {
      console.error("customer_password_recovery_failed", { code: error.code || "db_error" });
      return response({ ok: false, error: "recovery_unavailable" }, 503, origin);
    }
    return response(data?.ok
      ? { ok: true, sessionsRevoked: true }
      : { ok: false, error: data?.error === "otp_locked" ? "otp_locked" : (data?.error === "weak_password" ? "weak_password" : "invalid_or_expired_otp") }, 200, origin);
  }

  if (action !== "request_email") {
    return response({ ok: false, error: "invalid_request" }, 400, origin);
  }

  // Always reply generically to avoid distinguishing registered addresses.
  const { data: normalized, error: normalizeError } = await service.rpc("normalize_br_customer_phone", { p_phone: phone });
  if (normalizeError || !normalized?.valid || !normalized?.match_key) return response(genericConfirmation, 200, origin);

  const { data: customer } = await service.from("customers")
    .select("id,email,email_verified,full_name,nickname")
    .eq("store_id", storeId).eq("phone_match_key", normalized.match_key)
    .eq("status", "active").is("merged_into_customer_id", null).maybeSingle();

  if (!customer?.email_verified || !customer.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
    return response(genericConfirmation, 200, origin);
  }

  const brevoKey = normalizeSecret(Deno.env.get("BREVO_API_KEY") || Deno.env.get("SENDINBLUE_API_KEY"));
  const sender = senderEmail(
    Deno.env.get("CUSTOMER_EMAIL_FROM") || Deno.env.get("BREVO_SENDER_EMAIL")
      || Deno.env.get("EMAIL_FROM"),
  ) || "naoresponda@auth.optmamenu.com.br";
  if (!brevoKey) {
    console.error("customer_password_recovery_mail_provider_unavailable");
    return response({ ok: false, error: "email_unavailable" }, 503, origin);
  }

  const { data: store } = await service.from("stores").select("name,slug")
    .eq("id", storeId).eq("public_store_enabled", true).maybeSingle();
  if (!store) return response(genericConfirmation, 200, origin);

  const { data: issued, error: issueError } = await service.rpc("issue_customer_otp_for_sms_safe", {
    p_phone: phone, p_store_id: storeId, p_purpose: "password_reset",
  });
  if (issueError) {
    console.error("customer_password_recovery_issue_failed", { code: issueError.code || "db_error" });
    return response({ ok: false, error: "recovery_unavailable" }, 503, origin);
  }
  if (!issued?.ok) {
    if (issued?.error === "rate_limited" || issued?.error === "daily_limit_reached") {
      return response({ ok: false, error: "rate_limited" }, 429, origin);
    }
    return response(genericConfirmation, 200, origin);
  }

  const otpId = String(issued.otp_id || "");
  const otp = String(issued.otp || "");
  if (!/^[0-9a-f-]{36}$/i.test(otpId) || !/^\d{6}$/.test(otp)) {
    return response({ ok: false, error: "recovery_unavailable" }, 503, origin);
  }

  const storeName = String(store.name || store.slug || "Loja").slice(0, 70);
  const fullname = String(customer.full_name || customer.nickname || "Cliente").slice(0, 120);
  const subject = `Código para recuperar sua senha — ${storeName}`;
  const html = `<!doctype html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;max-width:600px;margin:28px auto;padding:18px;color:#17324a">
    <h2>${escapeHtml(storeName)} — recuperação de senha</h2>
    <p>Olá, ${escapeHtml(fullname)}.</p>
    <p>Recebemos um pedido de recuperação da senha da sua conta.</p>
    <p style="font-size:30px;letter-spacing:6px;font-weight:bold">${otp}</p>
    <p>Este código expira em <strong>5 minutos</strong> e só pode ser usado uma vez. Não compartilhe.</p>
    <p>Se você não solicitou a recuperação, ignore esta mensagem. Sua senha não será alterada.</p>
    <p style="font-size:12px;color:#5e6c79">Mensagem transacional de segurança, sem finalidade publicitária.</p>
  </body></html>`;

  let sent = false;
  let messageId: string | null = null;
  try {
    const mail = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": brevoKey, "Content-Type": "application/json", "accept": "application/json" },
      body: JSON.stringify({
        sender: { name: storeName, email: sender },
        to: [{ email: customer.email, name: fullname }],
        subject,
        htmlContent: html,
      }),
    });
    const replyBody = await mail.json().catch(() => ({}));
    sent = mail.ok;
    messageId = typeof replyBody?.messageId === "string" ? replyBody.messageId : null;
    if (!sent) console.error("customer_password_recovery_mail_rejected", { status: mail.status });
  } catch {
    console.error("customer_password_recovery_mail_unreachable");
  }

  // The code must never remain redeemable if the email provider rejected it.
  const { data: original } = await service.from("customer_otps")
    .select("metadata").eq("id", otpId).maybeSingle();
  await service.from("customer_otps").update({
    metadata: {
      ...(original?.metadata || {}),
      transport: "brevo",
      delivery_status: sent ? "accepted_by_provider" : "failed",
      provider_message_id: messageId,
      delivery_recorded_at: new Date().toISOString(),
    },
    ...(!sent ? { used: true, consumed_at: new Date().toISOString() } : {}),
  }).eq("id", otpId);

  return response(sent ? genericConfirmation : { ok: false, error: "email_unavailable" }, sent ? 200 : 503, origin);
});
