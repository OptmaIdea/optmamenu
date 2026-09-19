import { createHash, randomBytes } from 'node:crypto';

function json(res: any, status: number, body: unknown) {
    res.status(status);
    res.setHeader('Cache-Control', 'no-store');
    return res.json(body);
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

function normalizeSecret(value: string) {
    const trimmed = String(value || '').trim();
    const unwrapped = trimmed.replace(/^["'`]+|["'`]+$/g, '').trim();
    const withoutAssignment = unwrapped.replace(/^BREVO_API_KEY\s*=\s*/i, '').trim();
    return withoutAssignment.replace(/\s+/g, '');
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

// Runtime secrets are injected by the deployment environment; changing them requires a new deployment.
export default async function handler(req: any, res: any) {
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
    const brevoApiKey = normalizeSecret(
        process.env.BREVO_API_KEY
        || process.env.SENDINBLUE_API_KEY
        || '',
    );
    const emailFrom = String(
        process.env.CUSTOMER_EMAIL_FROM
        || process.env.RESEND_FROM_EMAIL
        || process.env.BREVO_SENDER_EMAIL
        || process.env.EMAIL_FROM
        || '',
    ).trim().replace(/^["'`]+|["'`]+$/g, '').trim();

    if (req.method === 'GET') {
        let providerReachable: boolean | null = null;
        let providerStatus: number | null = null;

        if (brevoApiKey) {
            try {
                const probe = await fetch('https://api.brevo.com/v3/account', {
                    method: 'GET',
                    headers: {
                        'api-key': brevoApiKey,
                        accept: 'application/json',
                    },
                });
                providerReachable = probe.ok;
                providerStatus = probe.status;
            } catch {
                providerReachable = false;
            }
        }

        return json(res, 200, {
            ok: true,
            runtime: 'vercel',
            provider: brevoApiKey ? 'brevo' : resendApiKey ? 'resend' : null,
            providerConfigured: Boolean(resendApiKey || brevoApiKey),
            providerReachable,
            providerStatus,
            senderConfigured: Boolean(emailFrom),
            supabaseConfigured: Boolean(supabaseUrl && anonKey),
        });
    }

    if (req.method !== 'POST') {
        return json(res, 405, { ok: false, error: 'method_not_allowed' });
    }

    const authorization = String(req.headers.authorization || '');
    if (!authorization.toLowerCase().startsWith('bearer ')) {
        return json(res, 401, { ok: false, error: 'access_denied' });
    }

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
    const storeSlug = String(challengeData.store_slug || '').trim();
    const rawLogoUrl = String(challengeData.store_logo_url || '').trim();
    const storeLogoUrl = /^https:\/\//i.test(rawLogoUrl) ? rawLogoUrl : '';
    const expiresAt = String(challengeData.expires_at || '');
    if (!challengeId || !email) {
        return json(res, 502, { ok: false, error: 'challenge_invalid_payload' });
    }

    const forwardedProto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https';
    const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    const publicOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : '';
    const confirmUrl = publicOrigin && storeSlug
        ? `${publicOrigin}/api/customer-email-confirm?token=${encodeURIComponent(token)}&store=${encodeURIComponent(storeSlug)}`
        : `${supabaseUrl}/functions/v1/confirm-customer-email?token=${encodeURIComponent(token)}`;
    const safeSenderName = storeName
        .replace(/[<>\r\n"]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60) || 'Loja';
    const sender = emailFrom.includes('<')
        ? emailFrom
        : `${safeSenderName} <${emailFrom}>`;
    const subject = `Confirme seu e-mail para ${storeName}`;
    const brand = storeLogoUrl
        ? `<img src="${escapeHtml(storeLogoUrl)}" alt="${escapeHtml(storeName)}" style="display:block;max-width:160px;max-height:72px;margin:0 auto 18px;object-fit:contain">`
        : `<div style="font-size:22px;font-weight:800;text-align:center;margin-bottom:18px;color:#172033">${escapeHtml(storeName)}</div>`;
    const html = `<!doctype html>
<html>
<body style="margin:0;background:#f3f6f8;font-family:Arial,Helvetica,sans-serif;color:#172033">
  <div style="max-width:620px;margin:32px auto;padding:0 16px">
    <div style="background:#fff;border-radius:20px;padding:32px;box-shadow:0 8px 30px rgba(23,32,51,.08)">
      ${brand}
      <div style="display:inline-block;background:#eef8f4;color:#0a7d61;font-size:12px;font-weight:700;padding:7px 10px;border-radius:999px;margin-bottom:16px">E-MAIL AUTOMÁTICO DA LOJA</div>
      <h1 style="font-size:24px;line-height:1.25;margin:0 0 16px">${escapeHtml(storeName)} precisa confirmar seu e-mail</h1>
      <p style="font-size:15px;line-height:1.7;margin:0 0 12px">Olá, ${escapeHtml(fullName)}.</p>
      <p style="font-size:15px;line-height:1.7;margin:0 0 12px">O endereço <strong>${escapeHtml(email)}</strong> foi informado na sua conta da <strong>${escapeHtml(storeName)}</strong>. Para proteger seu cadastro e habilitar recursos como fidelidade e comunicações autorizadas, confirme que este e-mail pertence a você.</p>
      <p style="margin:28px 0"><a href="${confirmUrl}" style="display:inline-block;background:#0a9f76;color:#fff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:700">Confirmar meu e-mail</a></p>
      <p style="font-size:13px;line-height:1.6;color:#687386;margin:0 0 18px">Este link é válido por 30 minutos. Se você não solicitou esta confirmação, ignore esta mensagem.</p>
      <div style="background:#f7f9fb;border-radius:14px;padding:16px;margin-top:22px">
        <p style="font-size:12px;line-height:1.6;color:#5f6978;margin:0 0 8px"><strong>Sobre seus dados</strong></p>
        <p style="font-size:12px;line-height:1.6;color:#5f6978;margin:0">Seus dados são tratados no contexto da sua relação com ${escapeHtml(storeName)} para identificação da conta, segurança, pedidos, atendimento e funcionalidades que você escolher utilizar. O OptmaMenu/OptmaIdea atua como plataforma tecnológica de apoio à loja e não usa este e-mail para marketing próprio sem uma autorização específica.</p>
      </div>
      <p style="font-size:12px;line-height:1.6;color:#7a8493;margin:20px 0 0">Esta é uma mensagem automática. Não responda a este endereço. Em caso de dúvida, fale diretamente com ${escapeHtml(storeName)}.</p>
      <hr style="border:0;border-top:1px solid #e8ecef;margin:24px 0 16px">
      <p style="font-size:11px;line-height:1.6;color:#8a93a1;margin:0;text-align:center">Enviado em nome de ${escapeHtml(storeName)}${storeSlug ? ` (${escapeHtml(storeSlug)})` : ''} com tecnologia <a href="https://optmamenu.com.br/" style="color:#0a9f76">OptmaMenu</a>, da <a href="https://www.optmaidea.com.br/" style="color:#0a9f76">OptmaIdea</a>.</p>
    </div>
  </div>
</body>
</html>`;

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

    const providerCode = String(providerData?.code || providerData?.error || '').slice(0, 120);
    const providerMessage = String(providerData?.message || providerData?.detail || '').slice(0, 300);
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
        console.error('[CUSTOMER_EMAIL] Provedor recusou o envio', {
            provider,
            status: providerResponse.status,
            code: providerCode || null,
            message: providerMessage || null,
        });
        return json(res, 502, {
            ok: false,
            error: 'email_delivery_failed',
            provider,
            providerStatus: providerResponse.status,
            providerCode: providerCode || null,
            providerMessage: providerMessage || null,
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
