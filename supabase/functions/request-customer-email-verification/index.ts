import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors(origin) },
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((b) => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(hash).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply({ ok: false, error: "method_not_allowed" }, 405, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
  const emailFrom = Deno.env.get("CUSTOMER_EMAIL_FROM") || "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return reply({ ok: false, error: "server_configuration_error" }, 503, origin);
  }
  if (!resendApiKey || !emailFrom) {
    return reply({ ok: false, error: "email_provider_not_configured" }, 503, origin);
  }

  const authorization = req.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return reply({ ok: false, error: "access_denied" }, 401, origin);
  }

  const customerClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profileData, error: profileError } = await customerClient.rpc("get_customer_self_profile_safe");
  if (profileError || !profileData?.ok || !profileData?.customer) {
    return reply({ ok: false, error: "access_denied" }, 401, origin);
  }

  const customer = profileData.customer as Record<string, unknown>;
  const customerId = String(customer.id || "");
  const storeId = String(customer.store_id || "");
  const email = String(customer.email || "").trim().toLowerCase();
  const fullName = String(customer.full_name || customer.nickname || "Cliente").trim();

  if (!customerId || !storeId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return reply({ ok: false, error: "valid_email_required" }, 400, origin);
  }
  if (customer.email_verified === true) {
    return reply({ ok: true, alreadyVerified: true, email }, 200, origin);
  }

  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const [{ count: recentCount }, { count: hourlyCount }] = await Promise.all([
    service.from("customer_email_verification_challenges")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId).eq("customer_id", customerId).gte("requested_at", oneMinuteAgo),
    service.from("customer_email_verification_challenges")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId).eq("customer_id", customerId).gte("requested_at", oneHourAgo),
  ]);

  if ((recentCount || 0) >= 1 || (hourlyCount || 0) >= 5) {
    return reply({ ok: false, error: "rate_limited" }, 429, origin);
  }

  const { data: store, error: storeError } = await service
    .from("stores").select("name, slug, logo_url").eq("id", storeId).maybeSingle();
  if (storeError || !store) return reply({ ok: false, error: "store_not_found" }, 404, origin);

  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const token = base64Url(random);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();

  await service.from("customer_email_verification_challenges")
    .update({ used_at: new Date().toISOString(), metadata: { superseded: true } })
    .eq("store_id", storeId).eq("customer_id", customerId).is("used_at", null);

  const { data: challenge, error: insertError } = await service
    .from("customer_email_verification_challenges")
    .insert({
      store_id: storeId,
      customer_id: customerId,
      email,
      token_hash: tokenHash,
      expires_at: expiresAt,
      metadata: { source: "customer_account_portal" },
    })
    .select("id").single();

  if (insertError || !challenge) return reply({ ok: false, error: "challenge_create_failed" }, 500, origin);

  const confirmUrl = `${supabaseUrl}/functions/v1/confirm-customer-email?token=${encodeURIComponent(token)}`;
  const storeName = String(store.name || store.slug || "Loja");
  const safeSenderName = storeName.replace(/[<>\r\n"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "Loja";
  const sender = emailFrom.includes("<") ? emailFrom : `${safeSenderName} <${emailFrom}>`;
  const subject = `Confirme seu e-mail para ${storeName}`;
  const html = `<!doctype html>
<html><body style="margin:0;background:#f5f7f9;font-family:Arial,sans-serif;color:#172033">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:18px;padding:32px">
    <h1 style="font-size:24px;margin:0 0 16px">${escapeHtml(storeName)} precisa confirmar seu e-mail</h1>
    <p>Olá, ${escapeHtml(fullName)}.</p>
    <p>Você cadastrou <strong>${escapeHtml(email)}</strong> na sua conta da ${escapeHtml(storeName)}. Confirme que este endereço pertence a você.</p>
    <p style="margin:28px 0"><a href="${confirmUrl}" style="background:#0a9f76;color:#fff;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:700">Confirmar meu e-mail</a></p>
    <p style="font-size:13px;color:#687386">Este link é válido por 30 minutos. Se você não solicitou esta confirmação, ignore esta mensagem.</p>
    <hr style="border:0;border-top:1px solid #e8ecef;margin:28px 0">
    <p style="font-size:12px;color:#7a8493">Mensagem enviada em nome de ${escapeHtml(storeName)} com tecnologia <a href="https://optmamenu.com.br/" style="color:#0a9f76">OptmaMenu</a>, da <a href="https://www.optmaidea.com.br/" style="color:#0a9f76">OptmaIdea</a>.</p>
  </div>
</body></html>`;

  const providerResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: sender, to: [email], subject, html }),
  });

  const providerText = await providerResponse.text();
  let providerData: Record<string, unknown> = {};
  try { providerData = providerText ? JSON.parse(providerText) : {}; } catch { providerData = {}; }

  if (!providerResponse.ok) {
    await service.from("customer_email_verification_challenges")
      .update({ used_at: new Date().toISOString(), metadata: { delivery_failed: true } })
      .eq("id", challenge.id);
    console.error("customer_email_verification_delivery_failed", { status: providerResponse.status });
    return reply({ ok: false, error: "email_delivery_failed" }, 502, origin);
  }

  const messageId = String(providerData.id || "");
  await service.from("customer_email_verification_challenges")
    .update({ provider_message_id: messageId || null })
    .eq("id", challenge.id);

  return reply({ ok: true, email, expiresAt, storeName }, 200, origin);
});
