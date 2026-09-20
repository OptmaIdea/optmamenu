import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function senderEmail(value: string) {
  let normalized = String(value || "").trim();
  normalized = normalized.replace(/^["'`]+|["'`]+$/g, "").trim();
  normalized = normalized
    .replace(/^(CUSTOMER_EMAIL_FROM|RESEND_FROM_EMAIL|BREVO_SENDER_EMAIL|EMAIL_FROM)\s*=\s*/i, "")
    .trim();

  const angleMatch = normalized.match(/<\s*([^<>\s]+@[^<>\s]+)\s*>/);
  if (angleMatch?.[1]) return angleMatch[1].trim();

  const plainMatch = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return plainMatch?.[0]?.trim() || "";
}

function normalizeSecret(value: string) {
  const trimmed = String(value || "").trim();
  const unwrapped = trimmed.replace(/^["'`]+|["'`]+$/g, "").trim();
  const withoutAssignment = unwrapped.replace(/^BREVO_API_KEY\s*=\s*/i, "").trim();
  return withoutAssignment.replace(/\s+/g, "");
}

async function sendConfirmedEmail(params: {
  email: string;
  fullName: string;
  storeName: string;
  storeLogoUrl?: string;
}) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY") || Deno.env.get("RESEND_KEY") || "";
  const brevoApiKey = normalizeSecret(
    Deno.env.get("BREVO_API_KEY") || Deno.env.get("SENDINBLUE_API_KEY") || "",
  );
  const emailFromRaw = String(
    Deno.env.get("CUSTOMER_EMAIL_FROM")
      || Deno.env.get("RESEND_FROM_EMAIL")
      || Deno.env.get("BREVO_SENDER_EMAIL")
      || Deno.env.get("EMAIL_FROM")
      || "",
  );
  const emailFrom = senderEmail(emailFromRaw);

  if ((!resendApiKey && !brevoApiKey) || !emailFrom) {
    return {
      sent: false,
      reason: !emailFrom ? "invalid_sender_configuration" : "provider_not_configured",
    };
  }

  const safeSenderName = params.storeName
    .replace(/[<>\r\n"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60) || "Loja";
  const sender = `${safeSenderName} <${emailFrom}>`;
  const brand = params.storeLogoUrl && /^https:\/\//i.test(params.storeLogoUrl)
    ? `<img src="${escapeHtml(params.storeLogoUrl)}" alt="${escapeHtml(params.storeName)}" style="display:block;max-width:160px;max-height:72px;margin:0 auto 18px;object-fit:contain">`
    : `<div style="font-size:22px;font-weight:800;text-align:center;margin-bottom:18px;color:#172033">${escapeHtml(params.storeName)}</div>`;

  const subject = `E-mail confirmado em ${params.storeName}`;
  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;background:#f3f6f8;font-family:Arial,Helvetica,sans-serif;color:#172033">
  <div style="max-width:620px;margin:32px auto;padding:0 16px">
    <div style="background:#fff;border-radius:20px;padding:32px;box-shadow:0 8px 30px rgba(23,32,51,.08)">
      ${brand}
      <div style="display:inline-block;background:#eef8f4;color:#0a7d61;font-size:12px;font-weight:700;padding:7px 10px;border-radius:999px;margin-bottom:16px">CONFIRMAÇÃO DE SEGURANÇA</div>
      <h1 style="font-size:24px;line-height:1.25;margin:0 0 16px">Seu e-mail foi confirmado</h1>
      <p style="font-size:15px;line-height:1.7;margin:0 0 12px">Olá, ${escapeHtml(params.fullName)}.</p>
      <p style="font-size:15px;line-height:1.7;margin:0 0 12px">O endereço <strong>${escapeHtml(params.email)}</strong> foi confirmado com sucesso na sua conta da <strong>${escapeHtml(params.storeName)}</strong>.</p>
      <p style="font-size:14px;line-height:1.7;color:#5f6978;margin:18px 0 0">Esta mensagem é transacional e registra uma alteração de segurança da sua conta. Ela não representa autorização para marketing.</p>
      <div style="background:#f7f9fb;border-radius:14px;padding:16px;margin-top:22px">
        <p style="font-size:12px;line-height:1.6;color:#5f6978;margin:0">Se você não realizou esta confirmação, entre em contato diretamente com ${escapeHtml(params.storeName)}.</p>
      </div>
      <hr style="border:0;border-top:1px solid #e8ecef;margin:24px 0 16px">
      <p style="font-size:11px;line-height:1.6;color:#8a93a1;margin:0;text-align:center">Mensagem enviada em nome de ${escapeHtml(params.storeName)} com tecnologia OptmaMenu, da OptmaIdea.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const response = resendApiKey
      ? await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: sender,
            to: [params.email],
            subject,
            html,
          }),
        })
      : await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": brevoApiKey,
            "Content-Type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            sender: { name: safeSenderName, email: emailFrom },
            to: [{ email: params.email, name: params.fullName }],
            subject,
            htmlContent: html,
          }),
        });

    if (!response.ok) {
      const provider = resendApiKey ? "resend" : "brevo";
      let providerCode: string | null = null;
      let providerMessage: string | null = null;

      try {
        const raw = await response.text();
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            providerCode = typeof parsed?.code === "string" ? parsed.code : null;
            providerMessage = typeof parsed?.message === "string"
              ? parsed.message.slice(0, 240)
              : raw.slice(0, 240);
          } catch {
            providerMessage = raw.slice(0, 240);
          }
        }
      } catch {
        // Diagnóstico é best-effort; nunca interfere na confirmação.
      }

      console.error("customer_email_confirmed_notification_failed", {
        provider,
        status: response.status,
        code: providerCode,
        message: providerMessage,
      });

      return {
        sent: false,
        reason: "delivery_failed",
        provider,
        providerStatus: response.status,
        providerCode,
        providerMessage,
      };
    }

    return {
      sent: true,
      provider: resendApiKey ? "resend" : "brevo",
      providerStatus: response.status,
    };
  } catch (error) {
    console.error("customer_email_confirmed_notification_error", error);
    return { sent: false, reason: "delivery_error" };
  }
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(hash).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const PUBLIC_APP_ORIGIN = (Deno.env.get("OPTMAMENU_APP_URL") || "https://optmamenu.optmaidea.com.br").replace(/\/$/, "");

function redirectResult(
  result: "success" | "invalid" | "used" | "expired" | "error",
  storeSlug?: string | null,
) {
  const base = storeSlug
    ? `${PUBLIC_APP_ORIGIN}/s/${encodeURIComponent(storeSlug)}`
    : PUBLIC_APP_ORIGIN;
  const target = new URL(base);
  // Não use o parâmetro legado "emailVerification": versões antigas da loja
  // tentavam restaurar/login de sessão ao recebê-lo. O resultado novo é apenas
  // informativo e nunca deve autenticar o cliente automaticamente.
  target.searchParams.set("emailVerificationResult", result);

  return new Response(null, {
    status: 303,
    headers: {
      Location: target.toString(),
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return redirectResult("invalid");
  const url = new URL(req.url);

  const token = String(url.searchParams.get("token") || "").trim();
  if (!token || token.length < 20) return redirectResult("invalid");

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) return redirectResult("error");

  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const tokenHash = await sha256Hex(token);
  const { data: challenge } = await service
    .from("customer_email_verification_challenges")
    .select("id, store_id, customer_id, email, expires_at, used_at")
    .eq("token_hash", tokenHash).maybeSingle();

  if (!challenge) return redirectResult("invalid");
  const { data: store } = await service.from("stores").select("name, slug, logo_url").eq("id", challenge.store_id).maybeSingle();
  const storeName = String(store?.name || store?.slug || "a loja");
  const storeSlug = String(store?.slug || "").trim() || null;

  if (challenge.used_at) return redirectResult("used", storeSlug);
  if (new Date(challenge.expires_at).getTime() <= Date.now()) return redirectResult("expired", storeSlug);

  const { data: customer } = await service.from("customers")
    .select("id, email, full_name, nickname").eq("id", challenge.customer_id).eq("store_id", challenge.store_id).maybeSingle();

  if (!customer || String(customer.email || "").trim().toLowerCase() !== String(challenge.email).trim().toLowerCase()) {
    return redirectResult("invalid", storeSlug);
  }

  const now = new Date().toISOString();
  const { error: updateError } = await service.from("customers")
    .update({ email_verified: true, updated_at: now })
    .eq("id", challenge.customer_id).eq("store_id", challenge.store_id);

  if (updateError) return redirectResult("error", storeSlug);

  // Confirmação concluída primeiro; o e-mail abaixo é apenas um aviso transacional
  // best-effort e nunca desfaz a verificação se o provedor estiver indisponível.
  const notificationResult = await sendConfirmedEmail({
    email: String(customer.email || challenge.email).trim(),
    fullName: String(customer.full_name || customer.nickname || "Cliente").trim(),
    storeName,
    storeLogoUrl: String(store?.logo_url || "").trim(),
  });

  await service.from("customer_email_verification_challenges")
    .update({
      used_at: now,
      metadata: {
        verified: true,
        confirmed_notification: notificationResult,
      },
    })
    .eq("id", challenge.id);

  return redirectResult("success", storeSlug);
});
