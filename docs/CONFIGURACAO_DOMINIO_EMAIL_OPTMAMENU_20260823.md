# Configuração canônica de domínio e e-mail — OptmaMenu

**Data:** 23/08/2026  
**Domínio canônico:** `https://optmamenu.com.br`

Este documento registra a configuração externa confirmada durante a retomada da homologação geral. Não contém credenciais SMTP, senhas ou API keys privadas.

---

## 1. Vercel

Projeto: `optmamenu`

Domínio canônico de produção:

```text
https://optmamenu.com.br
```

Redirecionamentos 308 confirmados:

```text
https://www.optmamenu.com.br          → https://optmamenu.com.br
https://optmamenu.optmaidea.com.br    → https://optmamenu.com.br
https://optmamenu.vercel.app          → https://optmamenu.com.br
```

Todos aparecem com configuração válida na Vercel.

---

## 2. Registro.br / DNS

Observação operacional importante: no editor avançado do Registro.br, para registros no apex do domínio, o campo **Nome fica em branco**. A interface não aceita `@` como nome do registro.

Configuração atual registrada:

```text
A      optmamenu.com.br                      216.198.79.1
MX     optmamenu.com.br                      10 mx1.improvmx.com.
MX     optmamenu.com.br                      20 mx2.improvmx.com.
TXT    optmamenu.com.br                      "v=spf1 include:spf.improvmx.com ~all"
TXT    optmamenu.com.br                      "brevo-code:87bc80e692224f4c5c34614785bb2892"
TXT    _dmarc.optmamenu.com.br               "v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com"
CNAME  brevo1._domainkey.optmamenu.com.br    b1.optmamenu-com-br.dkim.brevo.com
CNAME  brevo2._domainkey.optmamenu.com.br    b2.optmamenu-com-br.dkim.brevo.com
CNAME  auth.optmamenu.com.br                 auth-optmamenu-com-br.brand.brevosend.com
CNAME  img.auth.optmamenu.com.br             auth-optmamenu-com-br.img.brand.brevosend.com
CNAME  r.auth.optmamenu.com.br               auth-optmamenu-com-br.r.brand.brevosend.com
CNAME  www.optmamenu.com.br                  e3e9f032e5ab1390.vercel-dns-017.com.
```

Regra: manter apenas um SPF no mesmo hostname. A Brevo está autenticando o domínio por DKIM/DMARC e não foi criado segundo SPF no apex.

---

## 3. ImprovMX

Domínio `optmamenu.com.br` ativo.

Aliases atuais:

```text
avisos@optmamenu.com.br       → optmamenu@gmail.com
faleconosco@optmamenu.com.br  → optmamenu@gmail.com
```

O endereço Gmail foi criado por limitação do plano gratuito do ImprovMX e funciona como caixa de destino dos aliases públicos do OptmaMenu.

---

## 4. Brevo

Remetente confirmado:

```text
OptmaMenu <naoresponda@auth.optmamenu.com.br>
```

Estado confirmado:

- remetente verificado;
- DKIM válido para `auth.optmamenu.com.br`;
- DMARC configurado;
- envio por IP compartilhado.

As credenciais SMTP permanecem somente em ambientes protegidos e nunca devem ser versionadas no Git.

---

## 5. Supabase Auth

Projeto: `lgkkfmqzaorrutuoqeax`

Site URL confirmada:

```text
https://optmamenu.com.br
```

Redirect URLs atuais incluem:

```text
http://192.168.1.91:5173/**
https://optmamenu.vercel.app/**
https://optmamenu.vercel.app/
https://optmamenu.optmaidea.com.br/**
https://optmamenu.com.br/**
```

O domínio antigo permanece temporariamente na allowlist para compatibilidade com e-mails/links anteriores durante a transição.

SMTP do Supabase Auth foi migrado para o remetente Brevo do domínio novo.

### Templates versionados

Os templates versionados no repositório devem evitar hardcode do domínio principal. Foi adotado `{{ .SiteURL }}` em links próprios de autenticação, permitindo que o domínio canônico seja controlado pela configuração do Supabase Auth.

Arquivos:

```text
supabase/templates/invite.html
supabase/templates/password_changed_notification.html
```

A documentação oficial do Supabase confirma `{{ .SiteURL }}` como variável disponível nos templates hospedados.

---

## 6. Edge Function `create-store-member-invite`

Endpoint:

```text
https://lgkkfmqzaorrutuoqeax.supabase.co/functions/v1/create-store-member-invite
```

Em 23/08/2026 foi publicada a versão **6** com:

- `verify_jwt = true`;
- fallback de `OPTMAMENU_APP_URL` alterado de `https://optmamenu.optmaidea.com.br` para `https://optmamenu.com.br`;
- import JSR corrigido para lowercase `@supabase/functions-js`, necessário para bundling atual.

Regra atual:

```ts
const appUrl = Deno.env.get("OPTMAMENU_APP_URL") || "https://optmamenu.com.br";
```

### Secret recomendado

Mesmo com fallback correto, manter o secret da Edge Function explicitamente configurado:

```text
OPTMAMENU_APP_URL=https://optmamenu.com.br
```

O fallback existe apenas como proteção contra configuração ausente.

---

## 7. Formspree

Conta/caixa associada à operação pública: `optmamenu@gmail.com`.

Endpoint atual do formulário:

```text
https://formspree.io/f/mljrvyga
```

O endpoint pode existir no frontend como identificador público de formulário; credenciais de conta e serviços externos não devem ser versionadas.

---

## 8. Próximas validações

Antes de considerar a migração de domínio fechada:

- [ ] copiar/confirmar no dashboard do Supabase Auth os templates versionados que usam `{{ .SiteURL }}`;
- [ ] confirmar `OPTMAMENU_APP_URL=https://optmamenu.com.br` nos secrets da Edge Function;
- [ ] enviar convite de usuário real de homologação e validar link no domínio canônico;
- [ ] testar recuperação de senha e confirmar link no domínio canônico;
- [ ] testar formulário Formspree e recebimento em `optmamenu@gmail.com`;
- [ ] confirmar `faleconosco@optmamenu.com.br` e `avisos@optmamenu.com.br` por envio externo;
- [ ] manter redirects 308 antigos durante a homologação;
- [ ] remover dependência de URLs antigas somente após confirmar que não há e-mails antigos relevantes circulando.
