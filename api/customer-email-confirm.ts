function safeStoreSlug(value: unknown) {
    const slug = String(value || '').trim().toLowerCase();
    return /^[a-z0-9][a-z0-9_-]{1,80}$/.test(slug) ? slug : '';
}

function redirect(res: any, location: string) {
    res.statusCode = 302;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Location', location);
    res.end();
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        res.status(405).json({ ok: false, error: 'method_not_allowed' });
        return;
    }

    const token = String(req.query?.token || '').trim();
    const store = safeStoreSlug(req.query?.store);
    if (!token || token.length < 20 || !store) {
        redirect(res, `/s/${store || 'loja'}?emailVerification=invalid`);
        return;
    }

    const supabaseUrl =
        process.env.SUPABASE_URL
        || process.env.VITE_SUPABASE_URL
        || 'https://lgkkfmqzaorrutuoqeax.supabase.co';

    try {
        const response = await fetch(
            `${supabaseUrl}/functions/v1/confirm-customer-email?token=${encodeURIComponent(token)}`,
            {
                method: 'GET',
                headers: { accept: 'text/html' },
                redirect: 'manual',
            },
        );

        if (response.ok) {
            redirect(res, `/s/${encodeURIComponent(store)}?emailVerification=success`);
            return;
        }

        redirect(res, `/s/${encodeURIComponent(store)}?emailVerification=error`);
    } catch {
        redirect(res, `/s/${encodeURIComponent(store)}?emailVerification=error`);
    }
}
