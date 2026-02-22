// Deno / Supabase Edge Function
import { SignJWT } from "npm:jose@5.9.6";

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
        },
    });
}

function getSecret(): Uint8Array {
    const secret = Deno.env.get("CUSTOMER_JWT_SECRET");
    if (!secret) throw new Error("CUSTOMER_JWT_SECRET not set");
    return new TextEncoder().encode(secret);
}

Deno.serve(async (req: Request) => {
    try {
        if (req.method === "OPTIONS") {
            return json({}, 200);
        }

        if (req.method !== "POST") {
            return json({ error: "Method not allowed" }, 405);
        }

        const { customer_id, store_id, expires_in_seconds } = await req.json();

        if (!customer_id || !store_id) {
            return json({ error: "customer_id e store_id são obrigatórios" }, 400);
        }

        const now = Math.floor(Date.now() / 1000);
        const exp = now + (Number(expires_in_seconds) || 60 * 60 * 24 * 7);

        const token = await new SignJWT({
            role: "customer",
            store_id,
            customer_id,
        })
            .setProtectedHeader({ alg: "HS256", typ: "JWT" })
            .setSubject(String(customer_id))
            .setIssuedAt(now)
            .setExpirationTime(exp)
            .sign(getSecret());

        return json({ token, exp });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return json({ error: msg }, 500);
    }
});