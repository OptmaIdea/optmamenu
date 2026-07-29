# Governança de identidade de clientes públicos — 2026-07-26

## Objetivo

Garantir que clientes originados da loja pública, WhatsApp ou QR/Mesa sejam classificados corretamente, tenham seus dados pessoais protegidos e não possam ter sua identidade alterada apenas porque alguém informou o mesmo telefone em um novo checkout.

## Contrato de origem e propriedade

### Cliente administrativo

- `source = admin` ou `direct_sale`
- `data_ownership = store_managed`
- `editable_by_store = true`
- criado por RPC administrativa com permissão `customers.manage`
- pode ter nome, telefone, e-mail, CPF e data de nascimento editados pela loja

### Cliente público

- `source = public_store`, `whatsapp` ou `qr_table`
- `data_ownership = customer_owned`
- `editable_by_store = false`
- `marketing_consent = false` por padrão
- `loyalty_opt_in = false` por padrão, até adesão explícita
- dados pessoais não podem ser alterados pela loja
- a loja pode manter campos internos permitidos pela RPC administrativa segura, como status, tags e observações internas

## Risco corrigido

A implementação antiga de `create_public_order_by_slug` inseria clientes sem informar `source`, `data_ownership` e `editable_by_store`. Como a tabela possuía padrões administrativos, novos clientes públicos podiam nascer como se fossem administrados pela loja.

A mesma função também atualizava `full_name`, `is_whatsapp`, `contact_preference` e `last_login` quando encontrava um telefone existente. Um checkout público não é prova de identidade e não pode alterar o cadastro pessoal de outra pessoa.

## Arquitetura aplicada

### Fachada pública

`create_public_order_by_slug(...)` agora:

1. resolve slug atual ou alias por `resolve_public_store_slug`;
2. obtém o slug canônico da loja;
3. define contexto interno de origem (`public_store`, `whatsapp` ou `qr_table`);
4. chama a implementação interna legada;
5. mantém a implementação interna sem permissão de execução para `anon` e `authenticated`.

### Trigger de proteção

`trg_enforce_public_customer_identity_context` atua apenas quando existe contexto público explícito.

Em `INSERT`:

- força a origem pública correta;
- define propriedade do cliente;
- bloqueia edição dos dados pessoais pela loja;
- mantém consentimento de marketing e adesão à fidelidade desligados;
- registra metadados de criação e proteção.

Em `UPDATE` durante checkout público:

- preserva nome;
- preserva telefone;
- preserva e-mail, CPF, nascimento e apelido;
- preserva senha e preferências de contato;
- preserva consentimentos;
- preserva origem e propriedade.

Resumos comerciais atualizados por outros gatilhos continuam permitidos.

## Saneamento histórico

Foram reclassificados somente clientes comprovadamente criados junto ao primeiro pedido público.

Critérios usados:

- pedido com `metadata.source = public_order_rpc`;
- cadastro ainda classificado como administrativo;
- ausência de metadados de criação administrativa, ou marcador da tentativa de saneamento;
- horário de criação coincidente com o primeiro pedido, considerando o deslocamento histórico de três horas em `customers.created_at`.

Resultado validado na Gelinhares:

- 8 clientes históricos reclassificados;
- 14 clientes públicos protegidos;
- 3 clientes administrativos preservados;
- nenhum cliente administrativo legítimo foi convertido.

## Permissões validadas

- `anon`: pode executar apenas a fachada pública;
- `authenticated`: pode executar apenas a fachada pública;
- implementação interna: sem execução para `anon` e `authenticated`;
- `service_role`: mantém capacidade operacional.

## Regras para a interface administrativa

A interface deve distinguir claramente:

- **Cadastro da loja** — dados editáveis;
- **Cadastro do cliente** — dados pessoais protegidos;
- **Cliente de balcão** — identidade operacional compartilhada, sem fidelidade;
- **Origem pública** — badge com Loja pública, WhatsApp ou Mesa/QR.

Para clientes protegidos, inputs pessoais devem ficar desabilitados e a tela deve explicar que somente campos internos podem ser alterados.

## Próximos passos

1. revisar badges e bloqueios em `Customers`, `CustomerEditPage` e `CustomerLifecyclePage`;
2. revisar consentimento e logs de adesão;
3. revisar cliente de balcão e exclusão de fidelidade;
4. criar fluxo autenticado para o próprio cliente corrigir seus dados;
5. revisar exposição pública de fidelidade por telefone;
6. documentar LGPD e retenção/exclusão de dados.

## Migration

`supabase/migrations/20260726063500_harden_public_customer_identity.sql`
