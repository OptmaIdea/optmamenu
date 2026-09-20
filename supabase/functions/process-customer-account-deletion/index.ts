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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const bearer = req.headers.get("authorization") || "";
  const token = bearer.replace(/^Bearer\s+/i, "").trim();

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ ok: false, error: "server_configuration_error" }, 503, origin);
  }
  if (!token) {
    return json({ ok: false, error: "access_denied" }, 401, origin);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: bearer } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await service.auth.getUser(token);
  const authUserId = userData?.user?.id;
  if (userError || !authUserId) {
    return json({ ok: false, error: "access_denied" }, 401, origin);
  }

  const adminRetry = String(body.mode || "") === "admin_retry";
  let targetCustomerId = "";
  let targetStoreId = "";
  let requestSource = "customer_portal";
  let requiresLogout = true;

  if (adminRetry) {
    targetCustomerId = String(body.customerId || "").trim();
    targetStoreId = String(body.storeId || "").trim();

    if (!isUuid(targetCustomerId) || !isUuid(targetStoreId)) {
      return json({ ok: false, error: "invalid_request" }, 400, origin);
    }

    const [{ data: isOwner, error: ownerError }, { data: canManage, error: permissionError }] = await Promise.all([
      userClient.rpc("app_is_store_owner", { p_store_id: targetStoreId }),
      userClient.rpc("user_has_store_permission", {
        p_store_id: targetStoreId,
        p_permission_code: "customers.manage",
      }),
    ]);

    if (ownerError || permissionError || (!isOwner && !canManage)) {
      return json({ ok: false, error: "access_denied" }, 403, origin);
    }

    requestSource = "admin_retry";
    requiresLogout = false;
  } else {
    const { data: identity, error: identityError } = await service
      .from("customer_auth_identities")
      .select("customer_id,store_id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (identityError || !identity?.customer_id || !identity?.store_id) {
      return json({ ok: false, error: "customer_identity_not_found" }, 404, origin);
    }

    targetCustomerId = String(identity.customer_id);
    targetStoreId = String(identity.store_id);
  }

  const { data: requestRow, error: requestError } = await service
    .from("customer_account_deletion_audit")
    .select("id,status,requested_at")
    .eq("store_id", targetStoreId)
    .eq("customer_id_snapshot", targetCustomerId)
    .in("status", ["pending", "processing"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (requestError) {
    console.error("customer_delete_request_lookup_failed", {
      customerId: targetCustomerId,
      code: requestError.code,
      adminRetry,
    });
    return json({ ok: false, error: "request_lookup_failed" }, 500, origin);
  }

  if (!requestRow?.id) {
    return json({ ok: false, error: "deletion_request_not_found" }, 409, origin);
  }

  const { data: deletionData, error: deletionError } = await service.rpc(
    "delete_customer_account_service_safe",
    {
      p_customer_id: targetCustomerId,
      p_store_id: targetStoreId,
      p_source: requestSource,
    },
  );

  if (deletionError) {
    console.error("customer_account_delete_failed", {
      customerId: targetCustomerId,
      code: deletionError.code,
      adminRetry,
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
          ...(adminRetry ? { admin_retry_at: new Date().toISOString(), admin_actor_user_id: authUserId } : {}),
        },
      })
      .eq("id", deletion.audit_id);
  }

  return json({
    ok: true,
    status: "executed",
    auditId: deletion.audit_id || requestRow.id,
    executedAt: deletion.executed_at || new Date().toISOString(),
    requiresLogout,
    authUsersRevoked: revoked,
    authUserRevokeFailures: revokeFailures.length,
  }, 200, origin);
});
