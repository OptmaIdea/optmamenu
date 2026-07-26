# Governança de Slugs das Lojas Públicas

Data: 2026-07-26

## Objetivo

Preservar a continuidade dos endereços públicos do OptmaMenu e impedir reutilização indevida de slugs, quebra de QR Codes ou colisão com endereços institucionais.

## Escopo atual

O catálogo público básico continua acessível por:

```text
https://optmamenu.optmaidea.com.br/s/<slug>
```

A futura modalidade premium usará:

```text
https://<slug>.menu.optmaidea.com.br
```

Os dois formatos devem usar a mesma governança de slug.

## Regras do slug

O backend é a autoridade final. O slug:

- é normalizado para minúsculas;
- deve ter entre 3 e 60 caracteres;
- aceita apenas letras ASCII minúsculas, números e hífen;
- não pode começar ou terminar com hífen;
- é único sem diferença entre maiúsculas e minúsculas;
- não pode usar nome reservado pela plataforma;
- não pode reutilizar slug histórico de outra loja.

## Nomes reservados

A tabela `reserved_store_slugs` mantém nomes institucionais e técnicos que não podem ser usados por lojas, incluindo `app`, `admin`, `api`, `auth`, `login`, `status`, `support`, `docs`, `cdn`, `storage`, `staging`, `optmamenu`, `optmaidea` e `menu`.

A tabela não é exposta diretamente a usuários anônimos ou autenticados. A validação ocorre pela função `validate_store_slug`.

## Histórico e aliases

A tabela `store_slug_history` registra cada slug substituído, a loja proprietária, o novo slug, data da mudança e usuário responsável.

Ao alterar o slug:

1. o slug anterior é registrado automaticamente;
2. ele permanece protegido contra uso por outra loja;
3. ele continua resolvendo para a loja original enquanto `is_redirect_active = true`;
4. novos materiais e QR Codes devem usar o slug atual.

A captura ocorre pelo trigger `trg_capture_store_slug_change`.

## Resolução pública

A função `resolve_public_store_id_by_slug` resolve:

- o slug atual da loja; ou
- um alias histórico ativo.

Ela somente retorna lojas com `public_store_enabled = true`.

As RPCs públicas `get_store_by_slug`, `get_public_storefront_by_slug` e `get_public_catalog_by_slug` usam o resolvedor central. A resposta da vitrine inclui:

- `slug`: slug atual;
- `requested_slug`: slug solicitado;
- `is_slug_alias`: indica acesso por endereço antigo.

## Segurança

- Um slug ou alias não concede acesso administrativo.
- A resolução pública retorna apenas lojas publicadas.
- O histórico possui RLS e pode ser consultado somente por membros da loja.
- Slugs antigos não são liberados automaticamente.
- Nenhuma alteração em DNS é necessária nesta frente.

## Interface administrativa

Em Configurações → Pedido Online, a mudança do slug deve:

- aceitar somente caracteres válidos;
- mostrar aviso quando divergir do slug salvo;
- exigir confirmação explícita;
- informar que o endereço antigo continuará funcionando;
- orientar atualização de QR Codes e materiais futuros.

Integração local:

```powershell
npm run stores:finalize-slug-governance-ui
npm run build
```

## Estado validado em 26/07/2026

Slugs atuais preservados:

- `gelinharessjn`;
- `snacksdicris`;
- `logmytravellunch`.

Validações executadas:

- slug atual da Gelinhares continua válido;
- `admin` é rejeitado como reservado;
- slug inexistente não resolve loja;
- nenhuma linha histórica foi criada sem mudança real.

## Próximas evoluções

- tela de histórico de endereços da loja;
- redirecionamento canônico no frontend ao acessar alias;
- integração com `store_domains` para subdomínio premium;
- conexão e verificação de domínio próprio;
- controle de domínio/subdomínio por plano comercial.
