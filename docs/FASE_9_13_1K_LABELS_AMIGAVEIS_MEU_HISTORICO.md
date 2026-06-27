# Fase 9.13.1K — Labels amigáveis, histórico e login de função personalizada

## Status

**Em validação final.**

Esta frente nasce após o fechamento funcional da 9.13.1J, quando o fluxo de alteração cadastral de nome foi validado e ficou claro que alguns registros do **Meu Histórico** ainda exibem rótulos técnicos.

Durante a mesma rodada, também foi identificado um refinamento relacionado ao login: a tela **Escolha onde entrar** exibia apenas o papel base do colaborador, como `Gerente`, mesmo quando o vínculo possuía função personalizada, como `Subgerente Nível I`.

A etapa é majoritariamente de UI/UX textual. Não deve alterar regras de permissão, RLS, Advisors ou cálculo efetivo de permissões. A única alteração backend da rodada foi a ampliação controlada da RPC `get_login_store_options` para retornar dados de função personalizada ao login.

---

## Objetivo

Melhorar a legibilidade do **Meu Histórico** e da escolha de vínculo no login.

Objetivos específicos:

- traduzir termos técnicos para linguagem amigável ao usuário final;
- corrigir labels como `name_change`, `applied`, `full_name` e `name`;
- preservar o fluxo funcional já validado de alteração cadastral;
- exibir a função personalizada real na tela de login quando o membro possuir `custom_role_id` ativo.

---

## Achados do Meu Histórico

Exemplos observados:

- `name_change` deve aparecer como `Alteração de nome`;
- `applied` deve aparecer como `Aplicada`;
- `full_name` ou `name` devem aparecer como `Nome completo`;
- status de solicitações cadastrais devem ser exibidos em português claro.

O ajuste de labels entrou parcialmente, mas houve problema de encoding em ambiente Windows/PowerShell, gerando textos com mojibake, como `AlteraÃ§Ã£o`.

Conclusão operacional:

- evitar scripts PowerShell com acentuação literal para este tipo de ajuste;
- preferir edição direta em UTF-8 pelo VS Code ou atualização direta pelo conector quando possível;
- salvar `MyHistory.tsx` explicitamente em UTF-8 após correções textuais.

---

## Achado do login — função personalizada

Foi observado que o usuário Henrique/Rick possui vínculo em Gelinhares com:

- papel base: `manager` / `Gerente`;
- função personalizada: `Subgerente Nível I`.

A tela **Escolha onde entrar** exibia apenas `Gerente`, pois o frontend usava o campo `role` retornado por `get_login_store_options`.

O frontend foi ajustado para priorizar:

1. `custom_role_name`, quando existir;
2. tradução do `role`, como fallback.

Arquivos ajustados:

- `src/pages/initial/auth/Login.tsx`;
- `src/types/security.ts`.

Commit local informado da validação frontend:

- `e4596b444f1cc9611ff717a72ec2d2e5df8c5b8e`.

---

## Migration de login

A RPC anterior:

- `get_login_store_options()`

retornava apenas o papel base `role`.

Foi criada a migration:

- `supabase/migrations/20260627190000_fix_login_store_options_custom_role.sql`

Escopo:

- recria `get_login_store_options()` preservando a lógica anterior;
- adiciona `LEFT JOIN public.store_custom_roles`;
- retorna:
  - `custom_role_id`;
  - `custom_role_name`;
  - `custom_role_base_role`.

Motivo técnico:

- a assinatura de retorno mudou, então a função precisou ser removida e recriada.

Validação:

- após aplicar a migration e usar o frontend já ajustado, a tela **Escolha onde entrar** passou a exibir `Subgerente Nível I` para Gelinhares.

Commit informado da validação final:

- `fbe68a86b886348b8a6350b5f4737092a46a37a1`.

---

## Escopo inicial do Meu Histórico

Arquivo principal:

- `src/pages/private/admin/settings/myHistory/MyHistory.tsx`

Ajustes previstos:

- ampliar `ACTION_LABELS` para eventos pessoais e solicitações cadastrais;
- criar tradutores locais para:
  - tipo de solicitação cadastral;
  - status de solicitação;
  - campos cadastrais;
- aplicar tradução no bloco `profile_request_*`;
- manter fallback seguro para eventos desconhecidos.

---

## Fora do escopo

- mexer em permissões;
- alterar RLS/policies;
- alterar cálculo efetivo de permissões;
- alterar estrutura ampla de tabelas;
- alterar fluxo de aprovação/aplicação cadastral;
- mexer em Advisors;
- refazer visualmente toda a tela de histórico.

---

## Diretriz de produto

O histórico e o login devem ser compreensíveis para colaborador comum, não apenas para desenvolvedor.

Preferir:

- `Alteração de nome` em vez de `name_change`;
- `Aplicada` em vez de `applied`;
- `Nome completo` em vez de `full_name` ou `name`;
- `Observação do responsável` em vez de `admin_notes`;
- `Subgerente Nível I` em vez de apenas `Gerente`, quando o vínculo possuir função personalizada ativa.

---

## Critérios de aceite

### Meu Histórico

- Cards do Meu Histórico não devem exibir `name_change` em texto principal ou detalhes.
- Status técnicos comuns devem aparecer em português.
- O fluxo já validado de alteração cadastral deve continuar aparecendo no histórico.
- Não deve haver mojibake como `AlteraÃ§Ã£o`.

### Login

- A tela **Escolha onde entrar** deve priorizar `custom_role_name` quando existir.
- O papel base continua como fallback.
- Vínculos sem função personalizada continuam exibindo o papel traduzido.
- O caso Henrique/Rick em Gelinhares deve exibir `Subgerente Nível I`.

### Geral

- Build deve passar sem erros.
- Console deve permanecer limpo.

---

## Observação sobre scripts

Os scripts PowerShell criados para ajustes textuais podem sofrer encoding no Windows quando contêm acentuação literal ou mojibake.

Diretriz a partir deste achado:

- evitar scripts temporários com strings acentuadas para correção textual;
- preferir alteração direta do arquivo em UTF-8;
- remover scripts temporários problemáticos após uso ou falha.

---

## Próximos passos

1. Confirmar se o `MyHistory.tsx` ficou sem caracteres estranhos após correção manual em UTF-8.
2. Remover scripts temporários problemáticos, se ainda existirem no repositório.
3. Atualizar `docs/RPCS_AND_VIEWS.md` com a alteração de `get_login_store_options`.
4. Se build e console estiverem limpos, fechar a 9.13.1K funcionalmente.
