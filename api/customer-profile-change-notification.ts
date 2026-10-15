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

function fieldLabel(value: string) {
    if (value === 'cpf') return 'CPF';
    if (value === 'birth_date') return 'data de nascimento';
    return value.replace(/_/g, ' ');
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return json(res, 405, { ok: false, error: 'method_not_allowed' });
    }

    const authorization = String(req.headers.authorization || '');
    if (!authorization.toLowerCase().startsWith('bearer ')) {
        return json(res, 401, { ok: false, error: 'access_denied' });
    }

    const auditId = String(req.body?.auditId || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(auditId)) {
        return json(res, 400, { ok: false, error: 'invalid_audit_id' });
    }

    const supabaseUrl =
        process.env.SUPABASE_URL
        || process.env.VITE_SUPABASE_URL
        || 'https://lgkkfmqzaorrutuoqeax.supabase.co';
    const anonKey =
        process.env.SUPABASE_ANON_KEY
        || process.env.VITE_SUPABASE_ANON_KEY
        || '';

    const serverProof = String(process.env.CUSTOMER_EMAIL_SERVER_PROOF || '').trim();
    if (!serverProof) {
        return json(res, 503, { ok: false, error: 'secure_email_rpc_not_configured' });
    }

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

    if (!supabaseUrl || !anonKey) {
        return json(res, 503, { ok: false, error: 'vercel_supabase_not_configured' });
    }

    const noticeResult = await callRpc(
        supabaseUrl,
        anonKey,
        authorization,
        'get_customer_self_sensitive_change_notice_safe',
        { p_audit_id: auditId },
    );

    const notice = noticeResult.payload;
    if (!noticeResult.response.ok || !notice?.ok) {
        const error = String(notice?.error || 'notice_not_available');
        return json(res, error === 'access_denied' ? 401 : 404, { ok: false, error });
    }

    if (notice.already_notified === true) {
        return json(res, 200, { ok: true, sent: true, alreadySent: true });
    }

    const email = String(notice.email || '').trim().toLowerCase();
    const emailVerified = notice.email_verified === true;
    if (!emailVerified || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json(res, 200, { ok: true, sent: false, reason: 'verified_email_unavailable' });
    }

    if ((!resendApiKey && !brevoApiKey) || !emailFrom) {
        return json(res, 503, {
            ok: false,
            sent: false,
            error: 'email_provider_not_configured',
        });
    }

    const fields = Array.isArray(notice.fields_changed)
        ? notice.fields_changed.map((value: unknown) => String(value))
        : [];
    const fieldLabels = fields.map(fieldLabel);
    const changedText = fieldLabels.length > 0
        ? fieldLabels.join(fieldLabels.length > 1 ? ' e ' : '')
        : 'dados protegidos do cadastro';
    const fullName = String(notice.full_name || 'Cliente').trim();
    const storeName = String(notice.store_name || 'Loja').trim();
    const storeSlug = String(notice.store_slug || '').trim();
    const rawLogoUrl = String(notice.store_logo_url || '').trim();
    const storeLogoUrl = /^https:\/\//i.test(rawLogoUrl) ? rawLogoUrl : '';
    const changedAt = notice.changed_at
        ? new Date(String(notice.changed_at)).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        : 'agora';

    const safeSenderName = storeName
        .replace(/[<>\r\n"]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60) || 'Loja';
    const sender = emailFrom.includes('<') ? emailFrom : `${safeSenderName} <${emailFrom}>`;
    const subject = `Seu cadastro na ${storeName} foi alterado`;
    const brand = storeLogoUrl
        ? `<img src="${escapeHtml(storeLogoUrl)}" alt="${escapeHtml(storeName)}" style="display:block;max-width:160px;max-height:72px;margin:0 auto 18px;object-fit:contain">`
        : `<div style="font-size:22px;font-weight:800;text-align:center;margin-bottom:18px;color:#172033">${escapeHtml(storeName)}</div>`;

    const html = `<!doctype html>
<html>
<body style="margin:0;background:#f3f6f8;font-family:Arial,Helvetica,sans-serif;color:#172033">
  <div style="max-width:620px;margin:32px auto;padding:0 16px">
    <div style="background:#fff;border-radius:20px;padding:32px;box-shadow:0 8px 30px rgba(23,32,51,.08)">
      ${brand}
      <div style="display:inline-block;background:#fff4e5;color:#9a5a00;font-size:12px;font-weight:700;padding:7px 10px;border-radius:999px;margin-bottom:16px">AVISO DE SEGURANÇA</div>
      <h1 style="font-size:24px;line-height:1.25;margin:0 0 16px">Seu cadastro foi atualizado</h1>
      <p style="font-size:15px;line-height:1.7;margin:0 0 12px">Olá, ${escapeHtml(fullName)}.</p>
      <p style="font-size:15px;line-height:1.7;margin:0 0 12px">Foi registrada uma alteração em <strong>${escapeHtml(changedText)}</strong> na sua conta da <strong>${escapeHtml(storeName)}</strong>, em ${escapeHtml(changedAt)}.</p>
      <p style="font-size:15px;line-height:1.7;margin:0 0 12px">Por segurança, este e-mail não mostra o valor anterior nem o novo valor informado.</p>
      <div style="background:#fff7ed;border-radius:14px;padding:16px;margin-top:22px">
        <p style="font-size:13px;line-height:1.6;color:#7c4a03;margin:0"><strong>Se foi você:</strong> nenhuma ação é necessária.</p>
        <p style="font-size:13px;line-height:1.6;color:#7c4a03;margin:10px 0 0"><strong>Se não foi você:</strong> entre na sua conta, confira os dados, altere sua senha e desconecte dispositivos que não reconhecer. Se precisar, fale diretamente com a loja.</p>
      </div>
      <p style="font-size:12px;line-height:1.6;color:#7a8493;margin:20px 0 0">Esta é uma mensagem transacional de segurança e não depende da sua autorização de marketing.</p>
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

    const messageId = String(providerData?.id || providerData?.messageId || '');

    await callRpc(
        supabaseUrl,
        anonKey,
        authorization,
        'mark_customer_self_sensitive_change_notice_server_safe',
        {
            p_audit_id: auditId,
            p_provider: provider,
            p_provider_message_id: messageId || null,
            p_failed: !providerResponse.ok,
            p_server_proof: serverProof,
        },
    ).catch(() => undefined);

    if (!providerResponse.ok) {
        console.error('[CUSTOMER_PROFILE_EMAIL] Provedor recusou o aviso de segurança', {
            provider,
            status: providerResponse.status,
        });
        return json(res, 502, {
            ok: false,
            sent: false,
            error: 'email_delivery_failed',
            provider,
            providerStatus: providerResponse.status,
        });
    }

    return json(res, 200, {
        ok: true,
        sent: true,
        provider,
        fields: fieldLabels,
    });
}
