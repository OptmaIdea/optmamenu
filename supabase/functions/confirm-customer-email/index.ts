import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(hash).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function page(title: string, message: string, storeName = "a loja", success = false) {
  return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f5f7f9;font-family:Arial,sans-serif;color:#172033">
<div style="max-width:600px;margin:48px auto;background:white;padding:32px;border-radius:18px;text-align:center">
<div style="font-size:42px">${success ? "✓" : "!"}</div>
<h1>${escapeHtml(title)}</h1><p style="line-height:1.6">${escapeHtml(message)}</p>
<p style="font-size:13px;color:#687386">Sua relação é com ${escapeHtml(storeName)}. A confirmação é processada com tecnologia OptmaMenu.</p>
<p><a href="https://optmamenu.com.br/" style="color:#0a9f76">OptmaMenu</a> · <a href="https://www.optmaidea.com.br/" style="color:#0a9f76">OptmaIdea</a></p>
</div></body></html>`, { status: success ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return page("Solicitação inválida", "Use o link recebido por e-mail.");
  const url = new URL(req.url);
  const token = String(url.searchParams.get("token") || "").trim();
  if (!token || token.length < 20) return page("Link inválido", "O link de confirmação não é válido.");

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) return page("Serviço indisponível", "Não foi possível confirmar o e-mail agora.");

  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const tokenHash = await sha256Hex(token);
  const { data: challenge } = await service
    .from("customer_email_verification_challenges")
    .select("id, store_id, customer_id, email, expires_at, used_at")
    .eq("token_hash", tokenHash).maybeSingle();

  if (!challenge) return page("Link inválido", "Este link de confirmação não existe ou já foi substituído.");
  const { data: store } = await service.from("stores").select("name, slug").eq("id", challenge.store_id).maybeSingle();
  const storeName = String(store?.name || store?.slug || "a loja");

  if (challenge.used_at) return page("Link já utilizado", "Solicite uma nova confirmação na sua conta.", storeName);
  if (new Date(challenge.expires_at).getTime() <= Date.now()) return page("Link expirado", "Solicite uma nova confirmação na sua conta.", storeName);

  const { data: customer } = await service.from("customers")
    .select("id, email").eq("id", challenge.customer_id).eq("store_id", challenge.store_id).maybeSingle();

  if (!customer || String(customer.email || "").trim().toLowerCase() !== String(challenge.email).trim().toLowerCase()) {
    return page("E-mail alterado", "O endereço cadastrado mudou depois que este link foi enviado. Solicite uma nova confirmação.", storeName);
  }

  const now = new Date().toISOString();
  const { error: updateError } = await service.from("customers")
    .update({ email_verified: true, updated_at: now })
    .eq("id", challenge.customer_id).eq("store_id", challenge.store_id);

  if (updateError) return page("Não foi possível confirmar", "Tente novamente ou solicite um novo link.", storeName);

  await service.from("customer_email_verification_challenges")
    .update({ used_at: now, metadata: { verified: true } }).eq("id", challenge.id);

  return page("E-mail confirmado", `Seu e-mail foi confirmado para ${storeName}. Você já pode fechar esta página e voltar à loja.`, storeName, true);
});
