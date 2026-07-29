# OptmaMenu — Domínios por plano, identidade visual e preparação pré-lançamento

Data: 2026-07-26
Status: frente planejada para execução pouco antes do lançamento oficial

## 1. Decisão consolidada

O OptmaMenu continuará operando com três níveis de endereço público:

### Plano básico

```text
https://optmamenu.optmaidea.com.br/s/<slug-da-loja>
```

Exemplo:

```text
https://optmamenu.optmaidea.com.br/s/gelinharessjn
```

### Plano com valor agregado

```text
https://<slug-da-loja>.menu.optmaidea.com.br
```

Exemplo piloto:

```text
https://gelinharessjn.menu.optmaidea.com.br
```

### Evolução premium futura

Domínio próprio da marca do cliente, por exemplo:

```text
https://cardapio.gelinhares.com.br
```

ou:

```text
https://pedidos.gelinhares.com.br
```

O painel administrativo permanece em:

```text
https://optmamenu.optmaidea.com.br
```

## 2. Contexto comercial

O primeiro cliente e laboratório real será o grupo GeLinhares, inicialmente a unidade GeLinhares São João Nepomuceno.

A arquitetura deve atender esse primeiro caso sem impedir a expansão multi-tenant já em andamento.

A URL por subdomínio será tratada como diferencial comercial e recurso de plano superior. O modelo `/s/<slug>` permanece como opção funcional, econômica e padrão para planos menores.

## 3. Estratégia de DNS escolhida

O domínio `optmaidea.com.br` permanece controlado no Registro.br.

Não será feita, neste momento, a migração integral da zona DNS principal.

A estratégia recomendada é delegar apenas a subzona:

```text
menu.optmaidea.com.br
```

para um provedor compatível com wildcard e emissão automática de certificados, preferencialmente Vercel DNS.

Estrutura esperada:

```text
optmaidea.com.br                    Registro.br / DNS principal
optmamenu.optmaidea.com.br          aplicação administrativa
menu.optmaidea.com.br               subzona delegada
*.menu.optmaidea.com.br             lojas premium
```

Essa separação reduz o risco de afetar:

- e-mail institucional;
- SPF, DKIM e DMARC;
- Brevo e serviços de envio;
- site institucional;
- outros registros existentes no domínio principal.

## 4. Regra de elegibilidade por plano

A escolha do endereço público não poderá depender apenas do frontend.

Cada loja deverá possuir configuração explícita no backend, por exemplo:

```text
public_url_mode:
- path_slug
- platform_subdomain
- custom_domain
```

Comportamento:

| Modo | Endereço principal |
|---|---|
| `path_slug` | `optmamenu.optmaidea.com.br/s/<slug>` |
| `platform_subdomain` | `<slug>.menu.optmaidea.com.br` |
| `custom_domain` | domínio validado da marca |

O modo deve ser controlado por plano, contrato ou liberação administrativa.

## 5. Modelo recomendado de domínios

Criar uma tabela própria, separada de `stores.slug`:

```sql
store_domains
-------------
id uuid primary key
store_id uuid not null
hostname text not null
kind text not null
status text not null
is_primary boolean not null default false
verified_at timestamptz
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
disabled_at timestamptz
```

Tipos previstos:

```text
platform_path
platform_subdomain
custom_domain
```

Status previstos:

```text
pending
verified
active
suspended
failed
disabled
```

Restrições mínimas:

- unicidade case-insensitive de `hostname`;
- apenas um domínio principal ativo por loja;
- domínio vinculado à loja correta;
- proibição de hostnames reservados;
- histórico preservado quando o hostname deixa de ser usado.

## 6. Slugs e nomes reservados

A lista de nomes reservados deve ficar no backend e ser aplicada na criação ou troca de slug.

Lista inicial recomendada:

```text
www
app
admin
api
auth
login
account
accounts
billing
status
support
help
docs
mail
email
smtp
imap
pop
ftp
cdn
assets
static
media
images
files
storage
staging
dev
test
preview
beta
internal
dashboard
optmamenu
optmaidea
menu
```

Regras adicionais:

- apenas letras minúsculas, números e hífen;
- não iniciar ou terminar com hífen;
- comprimento mínimo e máximo definidos;
- evitar termos ambíguos ou institucionais;
- impedir reutilização imediata de slug antigo.

## 7. Proteção contra reaproveitamento indevido

Quando uma loja abandonar ou trocar um slug, o valor antigo deverá permanecer reservado.

Motivo: QR Codes, links impressos, mensagens e favoritos antigos podem continuar circulando.

Sem essa proteção, outra loja poderia assumir o slug antigo e receber tráfego destinado à marca anterior.

A retenção pode ser permanente ou obedecer política administrativa explícita.

## 8. Resolução segura do tenant

O hostname serve apenas para identificar a loja desejada. Ele nunca concede acesso por si só.

Fluxo recomendado:

```text
hostname recebido
    ↓
normalização e validação
    ↓
consulta autoritativa em store_domains / stores
    ↓
store_id resolvido
    ↓
validação de loja pública habilitada
    ↓
RPC pública retorna somente dados permitidos
```

Não usar o primeiro segmento do hostname como autoridade isolada.

Toda consulta deve continuar limitada por `store_id`, RLS e RPC pública específica.

## 9. Separação entre painel e loja pública

### Host administrativo

```text
optmamenu.optmaidea.com.br
```

Rotas esperadas:

```text
/login
/admin/*
/pdv
```

### Host premium da loja

```text
<slug>.menu.optmaidea.com.br
```

Rotas públicas esperadas:

```text
/
/checkout
/p/<token>
```

Em host público, rotas administrativas devem ser bloqueadas ou redirecionadas.

Em host administrativo, o subdomínio `optmamenu` nunca deve ser interpretado como loja.

## 10. Sessão, cookies e armazenamento local

Antes da ativação em produção, validar:

- sessão administrativa restrita ao host do painel;
- ausência de cookie com `Domain=.optmaidea.com.br`;
- ausência de compartilhamento de token entre lojas;
- `localStorage` e caches separados por origem;
- checkout e dados pessoais nunca compartilhados entre tenants;
- Service Worker com escopo e cache por hostname.

Nenhuma loja pública deve receber sessão administrativa do painel.

## 11. Identidade visual por plano

A personalização pode ser monetizada em camadas.

### Plano básico

- logo;
- cores básicas;
- catálogo por `/s/<slug>`;
- identidade OptmaMenu presente.

### Plano intermediário

- subdomínio em `menu.optmaidea.com.br`;
- favicon da loja;
- título personalizado;
- banner;
- paleta ampliada;
- fontes pré-aprovadas;
- opções de borda e estilo controladas.

### Plano premium futuro

- domínio próprio;
- personalização ampliada;
- configurações avançadas de marca;
- suporte de implantação e validação de DNS;
- possíveis recursos adicionais de marketing e analytics.

## 12. Campos seguros de aparência

Permitir somente propriedades controladas:

```text
primary_color
secondary_color
background_color
text_color
font_key
radius_key
logo_asset_id
banner_asset_id
favicon_asset_id
theme_key
```

Não permitir `custom_css` livre nesta fase.

Validações:

- cores no formato hexadecimal de seis dígitos;
- contraste mínimo;
- fontes por enumeração;
- raios por enumeração;
- imagens processadas pelo pipeline de Storage;
- sem SVG arbitrário enviado por lojista.

## 13. Página de hostname inexistente

Como o wildcard aceitará muitos hostnames, um host não cadastrado deverá exibir página pública neutra:

```text
Loja não encontrada ou endereço indisponível.
```

Nunca abrir:

- loja padrão;
- última loja armazenada;
- painel administrativo;
- dados de outro tenant.

## 14. Domínio próprio futuro

A arquitetura de `store_domains` deve nascer preparada para domínio próprio.

Fluxo futuro:

1. lojista informa o domínio;
2. sistema gera instrução DNS;
3. domínio fica `pending`;
4. validação de propriedade;
5. certificado emitido;
6. domínio passa a `active`;
7. domínio antigo pode redirecionar para o principal;
8. histórico e auditoria permanecem.

Nunca ativar domínio próprio apenas porque o cliente digitou um hostname.

## 15. Segurança operacional de DNS

Antes da implantação:

- exportar registros atuais do Registro.br;
- documentar rollback;
- reduzir TTL com antecedência;
- ativar MFA no Registro.br e na Vercel;
- usar acessos individuais;
- não compartilhar senha;
- registrar responsáveis pela alteração;
- validar certificado e renovação;
- monitorar resolução DNS e HTTPS.

## 16. Sequência recomendada de execução

Esta frente deverá ser retomada pouco antes do lançamento oficial, nesta ordem:

1. consolidar slug e regras de cadastro da loja;
2. consolidar cadastro e identidade dos clientes;
3. criar `store_domains`;
4. criar nomes reservados e tombstones de slug;
5. implementar resolução autoritativa por hostname;
6. separar rotas públicas e administrativas por host;
7. implementar configuração de plano e `public_url_mode`;
8. implementar tema seguro e controlado;
9. testar isolamento de sessão, cache e Service Worker;
10. delegar `menu.optmaidea.com.br`;
11. ativar `gelinharessjn.menu.optmaidea.com.br` como piloto;
12. validar operação real com GeLinhares São João Nepomuceno;
13. documentar suporte e rollback;
14. liberar comercialmente para planos elegíveis;
15. iniciar frente de domínio próprio.

## 17. Critérios de aceite do piloto

O piloto GeLinhares somente será considerado aprovado quando:

- o hostname resolver exclusivamente para a loja correta;
- host inexistente não revelar outro tenant;
- `/admin` não funcionar no hostname público;
- sessão do painel não atravessar para a loja;
- checkout e pedidos funcionarem normalmente;
- QR Codes e links antigos por `/s/gelinharessjn` continuarem válidos;
- URL antiga puder redirecionar de forma controlada;
- favicon, título, logo e cores forem aplicados sem CSS livre;
- caches não misturarem lojas;
- o certificado HTTPS estiver válido e renovável;
- houver rollback documentado.

## 18. Fora do escopo imediato

Esta frente não será executada agora.

Também ficam fora do escopo atual:

- migração completa do DNS principal;
- domínio próprio do cliente;
- CSS livre;
- marketplace de temas;
- cobrança automática por plano;
- editor visual avançado;
- múltiplos domínios ativos por loja sem regra de principalidade.

## 19. Próxima retomada

A frente deve ser retomada pouco antes do lançamento oficial, após o fechamento das etapas de slug, cadastro de clientes e demais pendências funcionais prioritárias.

A arquitetura foi mantida preparada para monetização, diferenciação de planos e expansão multi-tenant sem comprometer o piloto inicial do grupo GeLinhares.
