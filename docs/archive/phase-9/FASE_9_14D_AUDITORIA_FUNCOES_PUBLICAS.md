# Fase 9.14D — Auditoria de funções públicas intencionais

## Status

**Aberta para auditoria.**

Esta frente continua a rodada Advisors/RLS/hardening após a conclusão da 9.14A, 9.14B e 9.14C.

O foco agora são as funções que permanecem executáveis por `anon` de forma intencional por sustentarem loja pública, pedido público, OTP/login de cliente e consultas públicas por slug.

---

## Base atual

Arquivo analisado:

- `docs/ADVISORS.md`

Commit informado:

- `466cd5cf86832b7f40397b4d69eb1d1b1140ce26`

Resumo do estado informado:

- erros sumiram;
- warnings diminuíram;
- restaram warnings de funções públicas intencionais e warnings de funções `SECURITY DEFINER` executáveis por `authenticated`;
- há 2 sugestões pendentes no Advisor;
- o aviso `Leaked Password Protection Disabled` deve continuar sendo desconsiderado.

---

## Estado após 9.14B e 9.14C

### Resolvido

- `anon` removido de funções administrativas/privadas;
- `PUBLIC` removido de funções administrativas/privadas;
- `anon` removido de funções internas/técnicas;
- `validate_store_slug` ajustada para `authenticated`;
- RLS habilitado nas tabelas de permissões;
- grants diretos removidos de `anon` e `authenticated` nas tabelas de permissões.

### Persistente por design

Warnings `anon_security_definer_function_executable` ainda aparecem para funções públicas que precisam ser chamadas sem login Supabase.

---

## Funções públicas intencionais identificadas

### Pedido público

- `create_public_order_by_slug(...)`;
- `cancel_reserved_public_order(p_order_id uuid, p_reason text)`.

### Loja pública e catálogo

- `get_store_by_slug(p_slug text)`;
- `get_public_storefront_by_slug(p_slug text)`;
- `get_public_catalog_by_slug(p_slug text)`;
- `get_public_delivery_methods_by_slug(p_slug text)`;
- `get_public_payment_methods_by_slug(p_slug text)`;
- `get_public_sales_channels_by_slug(p_slug text)`.

### Cliente público, fidelidade e OTP

- `get_public_customer_loyalty_by_phone(p_slug text, p_phone text)`;
- `send_customer_otp(p_phone text, p_store_id uuid)`;
- `verify_customer_otp(p_phone text, p_otp text, p_store_id uuid)`;
- `customer_login_with_password(p_phone text, p_password text, p_store_id uuid)`.

---

## Diretriz da 9.14D

Não revogar `anon` dessas funções em lote.

Essas funções devem ser auditadas uma a uma, verificando:

- se realmente precisam ser públicas;
- se validam loja ativa/publicada;
- se validam slug/status da loja;
- se expõem apenas campos necessários;
- se evitam dados sensíveis;
- se normalizam telefone/entrada;
- se não retornam informações úteis para enumeração indevida;
- se possuem limites lógicos contra abuso quando aplicável;
- se o retorno de erro não revela detalhes internos.

---

## Critérios para manter `anon`

Uma função deve permanecer pública quando todos os pontos forem verdadeiros:

1. Sustenta fluxo público sem login Supabase.
2. Usa entrada mínima necessária.
3. Escopa por slug/store de forma explícita.
4. Não retorna dados sensíveis de clientes, usuários internos ou configurações administrativas.
5. Retorna somente dados públicos ou operacionais necessários ao fluxo.
6. Possui validações internas suficientes para impedir acesso fora de escopo.
7. O risco residual é documentado como exceção pública intencional.

---

## Possíveis decisões por função

### Manter pública sem alteração

Quando a função já valida tudo corretamente e expõe somente dados públicos.

### Manter pública com ajuste interno

Quando a função precisa continuar `anon`, mas precisa melhorar:

- validação de status da loja;
- validação de catálogo público habilitado;
- proteção contra enumeração;
- normalização de telefone;
- mensagens de erro genéricas;
- redução de payload.

### Dividir em duas funções

Quando a função mistura uso público e uso administrativo:

- criar uma função pública restrita;
- manter a função administrativa como `authenticated`.

### Revogar `anon`

Apenas se for comprovado que a função não é usada por fluxo público.

---

## Separação dos warnings `authenticated`

O `ADVISORS.md` atualizado também lista muitos warnings `authenticated_security_definer_function_executable`.

Esses warnings não fazem parte da 9.14D.

Motivo:

- são funções de operação autenticada do admin/app;
- devem ser tratadas em rodada própria;
- exigem análise de dependência por módulo;
- muitas são intencionais porque encapsulam validações e operações multi-tabela.

Rodada futura sugerida:

- **9.14E — Auditoria de funções SECURITY DEFINER autenticadas**.

---

## Próxima ação da 9.14D

Criar e rodar diagnóstico específico com definição das funções públicas intencionais.

O diagnóstico deve retornar:

- grants atuais;
- linguagem;
- `security_definer`;
- argumentos;
- definição SQL;
- classificação preliminar;
- observações de risco.

Somente após essa leitura será seguro propor ajustes pontuais.
