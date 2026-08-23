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
  inviteAlias?: string;
  permissions?: Record<string, unknown>;
  sensitiveActions?: Record<string, unknown>;
  expiresInDays?: number;
};

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  stock_operator: "Operador de estoque",
  cashier: "Caixa",
  sales: "Vendas",
  viewer: "Visualizador",
  staff: "Equipe",
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
    const { data: actorData, error: actorError } = await userClient.auth.getUser();
    if (actorError || !actorData.user) {
      return json({ error: "Sessão inválida ou expirada." }, 401);
    }

    const body = (await req.json()) as InviteBody;
    const storeId = body.storeId?.trim();
    const email = body.email?.trim().toLowerCase();
    const role = body.role?.trim();
    const inviteAlias = body.inviteAlias?.trim();
    const expiresInDays = body.expiresInDays ?? 7;

    if (!storeId || !email || !role || !inviteAlias) {
      return json({ error: "Loja, e-mail, nome de uso e cargo são obrigatórios." }, 400);
    }

    const { data: storeData } = await adminClient
      .from("stores")
      .select("name")
      .eq("id", storeId)
      .maybeSingle();

    const storeName = storeData?.name?.trim() || "uma loja no OptmaMenu";
    const roleLabel = roleLabels[role] ?? role;

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

    const { data: inviteRow } = await adminClient
      .from("store_member_invites")
      .select("metadata")
      .eq("id", inviteId)
      .maybeSingle();

    const currentMetadata =
      inviteRow?.metadata && typeof inviteRow.metadata === "object"
        ? inviteRow.metadata as Record<string, unknown>
        : {};
    const targetUserId =
      typeof currentMetadata.target_user_id === "string"
        ? currentMetadata.target_user_id
        : null;

    const emailMode = targetUserExists ? "magic_link" : "invite";
    const appUrl = Deno.env.get("OPTMAMENU_APP_URL") || "https://optmamenu.com.br";
    const redirectTo = `${appUrl.replace(/\/$/, "")}/activate-invite?store_invite=${encodeURIComponent(inviteId)}&store_id=${encodeURIComponent(storeId)}&mode=${encodeURIComponent(emailMode)}`;

    const authMetadata = {
      invite_name: inviteAlias,
      invite_alias: inviteAlias,
      invite_store_name: storeName,
      invite_role: role,
      invite_role_label: roleLabel,
      store_invite_id: inviteId,
      store_id: storeId,
      invite_mode: emailMode,
    };

    await adminClient
      .from("store_member_invites")
      .update({
        metadata: {
          ...currentMetadata,
          invite_alias: inviteAlias,
          invite_name: inviteAlias,
          invite_store_name: storeName,
          invite_role: role,
          invite_role_label: roleLabel,
        },
        email_status: "sending",
        email_error: null,
        email_attempts: 1,
        email_mode: emailMode,
      })
      .eq("id", inviteId);

    let authUserId: string | null = targetUserId;
    let sendError: { message?: string } | null = null;

    if (targetUserExists) {
      if (targetUserId) {
        const { data: existingUserData } = await adminClient.auth.admin.getUserById(targetUserId);
        const existingMetadata = existingUserData.user?.user_metadata ?? {};
        await adminClient.auth.admin.updateUserById(targetUserId, {
          user_metadata: { ...existingMetadata, ...authMetadata },
        });
      }

      const { error } = await publicAuthClient.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
      });
      sendError = error;
    } else {
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: authMetadata,
      });
      authUserId = data.user?.id ?? null;
      sendError = error;
    }

    if (sendError) {
      await adminClient
        .from("store_member_invites")
        .update({
          email_status: "failed",
          email_error: sendError.message ?? "Falha desconhecida no envio.",
          email_mode: emailMode,
          auth_user_id: authUserId,
        })
        .eq("id", inviteId);

      return json({ error: "O convite foi registrado, mas o e-mail não pôde ser enviado." }, 502);
    }

    const sentAt = new Date().toISOString();
    await adminClient
      .from("store_member_invites")
      .update({
        email_status: "sent",
        email_sent_at: sentAt,
        email_error: null,
        email_mode: emailMode,
        auth_user_id: authUserId,
      })
      .eq("id", inviteId);

    return json({
      ...invite,
      invite_alias: inviteAlias,
      store_name: storeName,
      role_label: roleLabel,
      email_status: "sent",
      email_sent_at: sentAt,
      email_mode: emailMode,
      auth_user_id: authUserId,
    });
  } catch (error) {
    console.error("Erro inesperado em create-store-member-invite:", error);
    return json(
      { error: error instanceof Error ? error.message : "Erro inesperado ao criar convite." },
      500,
    );
  }
});