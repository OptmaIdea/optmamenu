import { createHash, randomBytes } from 'node:crypto';

function json(res: any, status: number, body: unknown) {
    res.status(status).setHeader('Cache-Control', 'no-store').json(body);
}

function escapeHtml(value: unknown) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function senderEmail(value: string) {
    const match = value.match(/<([^>]+)>/);
    return String(match?.[1] || value).trim();
}

async function callRpc(
    supabaseUrl: string,
    anonKey: string,
    authorization: string,
    rpc: string,
    body: Record<string, unknown>,
) {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpc}`, {
        method: 'POST',
        headers: {
            apikey: anonKey,
            Authorization: authorization,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    const text = await response.text();
    let payload: any = null;
    try {
        payload = text ? JSON.parse(text) : null;
    } catch {
        payload = null;
    }

    return { response, payload };
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return json(res, 405, { ok: false, error: 'method_not_allowed' });
    }

    const authorization = String(req.headers.authorization || '');
    if (!authorization.toLowerCase().startsWith('bearer ')) {
        return json(res, 401, { ok: false, error: 'access_denied' });
    }

    const supabaseUrl =
        process.env.SUPABASE_URL
        || process.env.VITE_SUPABASE_URL
        || 'https://lgkkfmqzaorrutuoqeax.supabase.co';
    const anonKey =
        process.env.SUPABASE_ANON_KEY
        || process.env.VITE_SUPABASE_ANON_KEY
        || '';

    const resendApiKey =
        process.env.RESEND_API_KEY
        || process.env.RESEND_KEY
        || '';
    const brevoApiKey =
        process.env.BREVO_API_KEY
        || process.env.SENDINBLUE_API_KEY
        || '';
    const emailFrom =
        process.env.CUSTOMER_EMAIL_FROM
        || process.env.RESEND_FROM_EMAIL
        || process.env.BREVO_SENDER_EMAIL
        || process.env.EMAIL_FROM
        || '';

    if (!supabaseUrl || !anonKey) {
        return json(res, 503, {
            ok: false,
            error: 'vercel_supabase_not_configured',
            anonKeyDetected: Boolean(anonKey),
        });
    }

    if ((!resendApiKey && !brevoApiKey) || !emailFrom) {
        return json(res, 503, {
            ok: false,
            error: 'email_provider_not_configured',
            providerKeyDetected: Boolean(resendApiKey || brevoApiKey),
            senderDetected: Boolean(emailFrom),
            runtime: 'vercel',
        });
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const challenge = await callRpc(
        supabaseUrl,
        anonKey,
        authorization,
        'create_customer_self_email_verification_challenge_safe',
        { p_token_hash: tokenHash },
    );

    const challengeData = challenge.payload;
    if (!challenge.response.ok || !challengeData?.ok) {
        const error = String(challengeData?.error || 'challenge_create_failed');
        const status =
            error === 'access_denied' ? 401
                : error === 'rate_limited' ? 429
                    : error === 'valid_email_required' ? 400
                        : 502;
        return json(res, status, { ok: false, error });
    }

    if (challengeData.already_verified) {
        return json(res, 200, {
            ok: true,
            alreadyVerified: true,
            email: challengeData.email,
        });
    }

    const challengeId = String(challengeData.challenge_id || '');
    const email = String(challengeData.email || '').trim().toLowerCase();
    const fullName = String(challengeData.full_name || 'Cliente').trim();
    const storeName = String(challengeData.store_name || 'Loja').trim();
    const expiresAt = String(challengeData.expires_at || '');
    if (!challengeId || !email) {
        return json(res, 502, { ok: false, error: 'challenge_invalid_payload' });
    }

    const confirmUrl =
        `${supabaseUrl}/functions/v1/confirm-customer-email?token=${encodeURIComponent(token)}`;
    const safeSenderName = storeName
        .replace(/[<>\r\n"]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60) || 'Loja';
    const sender = emailFrom.includes('<')
        ? emailFrom
        : `${safeSenderName} <${emailFrom}>`;
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

    const provider = resendApiKey ? 'resend' : 'brevo';
    const providerResponse = resendApiKey
        ? await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ from: sender, to: [email], subject, html }),
        })
        : await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'api-key': brevoApiKey,
                'Content-Type': 'application/json',
                accept: 'application/json',
            },
            body: JSON.stringify({
                sender: { name: safeSenderName, email: senderEmail(emailFrom) },
                to: [{ email, name: fullName }],
                subject,
                htmlContent: html,
            }),
        });

    const providerText = await providerResponse.text();
    let providerData: any = {};
    try {
        providerData = providerText ? JSON.parse(providerText) : {};
    } catch {
        providerData = {};
    }

    const messageId = String(providerData?.id || providerData?.messageId || '');

    await callRpc(
        supabaseUrl,
        anonKey,
        authorization,
        'mark_customer_self_email_verification_delivery_safe',
        {
            p_challenge_id: challengeId,
            p_provider_message_id: messageId || null,
            p_provider: provider,
            p_failed: !providerResponse.ok,
        },
    ).catch(() => undefined);

    if (!providerResponse.ok) {
        return json(res, 502, {
            ok: false,
            error: 'email_delivery_failed',
            provider,
        });
    }

    return json(res, 200, {
        ok: true,
        email,
        storeName,
        expiresAt,
        provider,
        runtime: 'vercel',
    });
}
