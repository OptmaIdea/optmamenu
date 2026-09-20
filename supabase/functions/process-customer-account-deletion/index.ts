import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin) },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const bearer = req.headers.get("authorization") || "";
  const token = bearer.replace(/^Bearer\s+/i, "").trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: "server_configuration_error" }, 503, origin);
  }
  if (!token) {
    return json({ ok: false, error: "access_denied" }, 401, origin);
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await service.auth.getUser(token);
  const authUserId = userData?.user?.id;
  if (userError || !authUserId) {
    return json({ ok: false, error: "access_denied" }, 401, origin);
  }

  const { data: identity, error: identityError } = await service
    .from("customer_auth_identities")
    .select("customer_id,store_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (identityError || !identity?.customer_id || !identity?.store_id) {
    return json({ ok: false, error: "customer_identity_not_found" }, 404, origin);
  }

  const { data: requestRow, error: requestError } = await service
    .from("customer_account_deletion_audit")
    .select("id,status,requested_at")
    .eq("store_id", identity.store_id)
    .eq("customer_id_snapshot", identity.customer_id)
    .in("status", ["pending", "processing"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (requestError) {
    console.error("customer_delete_request_lookup_failed", {
      customerId: identity.customer_id,
      code: requestError.code,
    });
    return json({ ok: false, error: "request_lookup_failed" }, 500, origin);
  }

  if (!requestRow?.id) {
    return json({ ok: false, error: "deletion_request_not_found" }, 409, origin);
  }

  const { data: deletionData, error: deletionError } = await service.rpc(
    "delete_customer_account_service_safe",
    {
      p_customer_id: identity.customer_id,
      p_store_id: identity.store_id,
      p_source: "customer_portal",
    },
  );

  if (deletionError) {
    console.error("customer_account_delete_failed", {
      customerId: identity.customer_id,
      code: deletionError.code,
    });
    return json({ ok: false, error: "deletion_failed" }, 500, origin);
  }

  const deletion = deletionData as {
    ok?: boolean;
    error?: string;
    active_order_count?: number;
    audit_id?: string;
    auth_user_ids?: string[];
    executed_at?: string;
  } | null;

  if (!deletion?.ok) {
    if (deletion?.error === "active_orders_exist") {
      return json({
        ok: false,
        error: "active_orders_exist",
        activeOrderCount: Number(deletion.active_order_count || 0),
      }, 409, origin);
    }
    return json({ ok: false, error: deletion?.error || "deletion_failed" }, 409, origin);
  }

  const authUserIds = Array.isArray(deletion.auth_user_ids)
    ? deletion.auth_user_ids.filter((value) => typeof value === "string" && value.length > 0)
    : [];

  let revoked = 0;
  const revokeFailures: string[] = [];
  for (const userId of authUserIds) {
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) {
      revokeFailures.push(userId);
      console.error("customer_auth_identity_delete_failed", { userId, code: error.code });
    } else {
      revoked += 1;
    }
  }

  if (deletion.audit_id) {
    const { data: auditRow } = await service
      .from("customer_account_deletion_audit")
      .select("execution_summary,metadata")
      .eq("id", deletion.audit_id)
      .maybeSingle();

    await service
      .from("customer_account_deletion_audit")
      .update({
        execution_summary: {
          ...(auditRow?.execution_summary || {}),
          auth_users_revoked: revoked,
          auth_user_revoke_failures: revokeFailures.length,
        },
        metadata: {
          ...(auditRow?.metadata || {}),
          auth_revocation_finished_at: new Date().toISOString(),
        },
      })
      .eq("id", deletion.audit_id);
  }

  return json({
    ok: true,
    status: "executed",
    auditId: deletion.audit_id || requestRow.id,
    executedAt: deletion.executed_at || new Date().toISOString(),
    requiresLogout: true,
    authUsersRevoked: revoked,
    authUserRevokeFailures: revokeFailures.length,
  }, 200, origin);
});
