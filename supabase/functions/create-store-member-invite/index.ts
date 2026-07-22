import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type InviteBody = {
  storeId?: string;
  email?: string;
  role?: string;
  permissions?: Record<string, unknown>;
  sensitiveActions?: Record<string, unknown>;
  expiresInDays?: number;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Configuração interna indisponível." }, 500);
  }
  if (!authorization) return json({ error: "Usuário não autenticado." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const publicAuthClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Sessão inválida ou expirada." }, 401);

    const body = (await req.json()) as InviteBody;
    const storeId = body.storeId?.trim();
    const email = body.email?.trim().toLowerCase();
    const role = body.role?.trim();
    const expiresInDays = body.expiresInDays ?? 7;

    if (!storeId || !email || !role) {
      return json({ error: "Loja, e-mail e papel são obrigatórios." }, 400);
    }

    const { data: inviteData, error: inviteError } = await userClient.rpc(
      "create_store_member_invite",
      {
        p_store_id: storeId,
        p_email: email,
        p_role: role,
        p_permissions: body.permissions ?? {},
        p_sensitive_actions: body.sensitiveActions ?? {},
        p_expires_in_days: expiresInDays,
      },
    );

    if (inviteError) return json({ error: inviteError.message }, 400);

    const invite = inviteData as Record<string, unknown>;
    const inviteId = String(invite.invite_id ?? "");
    const targetUserExists = invite.target_user_exists_in_auth === true;
    if (!inviteId) return json({ error: "Convite criado sem identificador válido." }, 500);

    const redirectBase = Deno.env.get("OPTMAMENU_APP_URL") || "https://optmamenu.vercel.app";
    const redirectTo = `${redirectBase.replace(/\/$/, "")}/login?store_invite=${encodeURIComponent(inviteId)}`;
    const emailMode = targetUserExists ? "magic_link" : "invite";

    await adminClient.from("store_member_invites").update({
      email_status: "sending",
      email_error: null,
      email_attempts: 1,
      email_mode: emailMode,
    }).eq("id", inviteId);

    let authUserId: string | null = null;
    let sendError: { message?: string } | null = null;

    if (targetUserExists) {
      const { error } = await publicAuthClient.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
      });
      sendError = error;
    } else {
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: {
          store_invite_id: inviteId,
          store_id: storeId,
          store_role: role,
          invited_by: userData.user.id,
        },
      });
      authUserId = data.user?.id ?? null;
      sendError = error;
    }

    if (sendError) {
      await adminClient.from("store_member_invites").update({
        email_status: "failed",
        email_error: sendError.message ?? "Falha desconhecida no envio.",
        email_mode: emailMode,
        auth_user_id: authUserId,
      }).eq("id", inviteId);

      return json({
        error: "O convite foi registrado, mas o e-mail não pôde ser enviado.",
        invite: { ...invite, email_status: "failed", email_mode: emailMode },
      }, 502);
    }

    const sentAt = new Date().toISOString();
    await adminClient.from("store_member_invites").update({
      email_status: "sent",
      email_sent_at: sentAt,
      email_error: null,
      email_mode: emailMode,
      auth_user_id: authUserId,
    }).eq("id", inviteId);

    return json({
      ...invite,
      email_status: "sent",
      email_sent_at: sentAt,
      email_mode: emailMode,
      auth_user_id: authUserId,
    });
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : "Erro inesperado ao criar convite.",
    }, 500);
  }
});
