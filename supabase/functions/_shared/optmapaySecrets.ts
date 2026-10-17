export async function resolveOptmaPaySecret(
  service: any,
  secretRef: string | null | undefined,
  fallbackName: string,
) {
  const name = String(secretRef || fallbackName).trim();

  if (!/^OPTMAPAY_[A-Z0-9_]{3,119}$/.test(name)) {
    return { name, value: "" };
  }

  try {
    const { data, error } = await service.rpc("get_online_payment_vault_secret_internal", {
      p_secret_name: name,
    });

    if (!error && typeof data === "string" && data.trim()) {
      return { name, value: data.trim(), source: "supabase_vault" as const };
    }
  } catch {
    // Fallback para secret de runtime durante transição/recuperação.
  }

  const runtimeValue = Deno.env.get(name) || "";
  return {
    name,
    value: runtimeValue,
    source: runtimeValue ? "runtime_env" as const : "missing" as const,
  };
}
