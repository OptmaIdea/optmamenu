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
async function notifyPasswordChanged(service: any, storeId: string, phone: string) {
  try {
    const { data: normalized } = await service.rpc("normalize_br_customer_phone", { p_phone: phone });
    if (!normalized?.valid) return;
    const { data: person } = await service.from("customers")
      .select("email,email_verified,full_name,nickname").eq("store_id",storeId)
      .eq("phone_match_key",normalized.match_key).eq("status","active").maybeSingle();
    if (!person?.email_verified || !person.email) return;
    const { data: shop } = await service.from("stores")
      .select("name,slug").eq("id",storeId).maybeSingle();
    const name = String(shop?.name || shop?.slug || "Loja").slice(0,60);
    const key = normalizeSecret(Deno.env.get("BREVO_API_KEY") || Deno.env.get("SENDINBLUE_API_KEY"));
    if (!key) return;
    const from = senderEmail(Deno.env.get("CUSTOMER_EMAIL_FROM") || Deno.env.get("BREVO_SENDER_EMAIL")) || "naoresponda@auth.optmamenu.com.br";
    const html = '<html lang="pt-BR"><body style="margin:0;background:#f3f6f8;font-family:Arial,sans-serif;color:#172033"><div style="max-width:600px;margin:32px auto;background:white;border-radius:20px;padding:32px">'
      + '<p style="font-size:22px;font-weight:800;color:#047857">' + escapeHtml(name) + '</p>'
      + '<p style="font-size:12px;font-weight:700;color:#047857">AVISO DE SEGURANÇA</p><h1>Sua senha foi alterada</h1>'
      + '<p>Olá, ' + escapeHtml(person.full_name || person.nickname || "Cliente") + '.</p>'
      + '<p>Confirmamos que a senha da sua conta foi alterada. Outros dispositivos podem exigir nova autenticação.</p>'
      + '<p style="background:#fff7ed;border-radius:12px;padding:16px">Não foi você? Entre em contato com a loja imediatamente.</p>'
      + '<hr style="border:0;border-top:1px solid #e8ecef;margin:24px 0"><p style="font-size:12px;color:#7a8493">Mensagem automática de segurança, sem finalidade publicitária. Tecnologia OptmaMenu.</p></div></body></html>';
    const result = await fetch("https://api.brevo.com/v3/smtp/email",{
      method:"POST",headers:{"api-key":key,"Content-Type":"application/json","accept":"application/json"},
      body:JSON.stringify({sender:{name,email:from},to:[{email:person.email}],subject:"Aviso de segurança: senha alterada — "+name,htmlContent:html})
    });
    if (!result.ok) console.warn("customer_password_changed_email_rejected",{status:result.status});
  } catch (e) {
    console.warn("customer_password_changed_email_failed",{reason:e instanceof Error ? e.name : "unknown"});
  }
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
    if (data?.ok) {
      await notifyPasswordChanged(service, storeId, phone);
      return response({ ok: true, sessionsRevoked: true }, 200, origin);
    }
    return response({ ok: false, error: data?.error === "otp_locked" ? "otp_locked" : (data?.error === "weak_password" ? "weak_password" : "invalid_or_expired_otp") }, 200, origin);
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
      // Never identify a registered/verified account by a different response.
      return response(genericConfirmation, 200, origin);
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
  const { data: brandInfo } = await service.from("stores").select("logo_url").eq("id", storeId).maybeSingle();
  const logoUrl = String(brandInfo?.logo_url || "");
  const brand = /^https:\/\//.test(logoUrl)
    ? '<img src="' + escapeHtml(logoUrl) + '" alt="' + escapeHtml(storeName) + '" style="display:block;max-width:160px;max-height:72px;margin:0 auto 18px">'
    : '<div style="font-size:23px;font-weight:800;margin-bottom:18px">' + escapeHtml(storeName) + '</div>';
  const html = '<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f3f6f8;font-family:Arial,Helvetica,sans-serif;color:#172033"><div style="max-width:620px;margin:32px auto;padding:0 16px"><div style="background:white;border-radius:20px;padding:32px">'
    + brand + '<div style="display:inline-block;background:#eef8f4;color:#0a7d61;font-size:12px;font-weight:700;padding:8px;border-radius:10px">SEGURANÇA DA CONTA</div>'
    + '<h1 style="font-size:24px;margin:18px 0">Recupere sua senha</h1><p>Olá, ' + escapeHtml(fullname) + '.</p><p>Use este código para redefinir a senha da sua conta:</p>'
    + '<p style="background:#eef8f4;border-radius:14px;padding:20px;text-align:center;font-size:32px;letter-spacing:6px;font-weight:800;color:#047857">' + otp + '</p>'
    + '<p>Este código expira em <strong>5 minutos</strong>, é de uso único e não deve ser compartilhado.</p>'
    + '<p style="background:#f7f9fb;border-radius:12px;padding:16px">Se você não solicitou a recuperação, ignore esta mensagem. Sua senha atual não será alterada.</p>'
    + '<p style="font-size:12px;color:#7a8493">Mensagem automática de segurança da loja, sem publicidade.</p><hr style="border:0;border-top:1px solid #e8ecef;margin:22px 0">'
    + '<p style="text-align:center;color:#8a93a1;font-size:11px">Enviado em nome de ' + escapeHtml(storeName) + ' com tecnologia OptmaMenu.</p></div></div></body></html>';

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

  // Delivery failures are server-observable, but do not enumerate registered accounts.
  return response(genericConfirmation, 200, origin);
});
