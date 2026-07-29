# OptmaMenu — Checklist 9.13.1E: Realtime, Sidebar e Segurança

## Status atual observado

- [x] Refresh visual em permissões ficou mais suave no owner.
- [x] Console limpo nos testes recentes.
- [x] `PrivateLayout.tsx` atual já removeu `loadingPermissions` e usa `refreshingPermissions`.
- [x] `store_member_permissions` não aparece mais no `PrivateLayout.tsx` enviado.
- [ ] Sidebar ainda não reflete permissões operacionais em tempo real.
- [ ] Listener aparentemente reflete melhor nas abas de Configurações do que no menu lateral.
- [ ] Alteração de função/papel de usuário ainda não reflete em tempo real de forma confiável.
- [ ] Alguns labels/áreas conceituais de contexto de acesso ainda precisam fechamento.
- [ ] Advisors ficam para etapa posterior.

---

## 9.13.1E.5 — Listener robusto por versionamento

### Objetivo

Criar uma fonte única de evento para alterações de permissão:

- permissões por papel;
- funções personalizadas;
- permissões individuais;
- alteração de papel/função de usuário;
- futuras alterações de catálogo relacionadas a permissões.

### Backend

- [ ] Criar/validar tabela `public.store_permission_versions`.
- [ ] Habilitar RLS select para membros da loja.
- [ ] Adicionar tabela à publicação `supabase_realtime`.
- [ ] Criar função `touch_store_permission_version`.
- [ ] Criar triggers em:
  - [ ] `store_role_permission_templates`;
  - [ ] `store_custom_roles`;
  - [ ] `store_members`.

### Frontend

- [ ] `usePermissions.ts` deve escutar `store_permission_versions` como fonte principal.
- [ ] Manter fallback temporário para:
  - [ ] `store_role_permission_templates`;
  - [ ] `store_custom_roles`;
  - [ ] `store_members`.
- [ ] Evitar limpar permissões durante refresh silencioso.
- [ ] Emitir log temporário de refresh no `usePermissions` para confirmar chegada do evento.

---

## 9.13.1E.6 — Sidebar sem reload e com permissões reativas

### PrivateLayout

- [x] Usa `refreshingPermissions`.
- [x] Não usa mais `loadingPermissions`.
- [x] Não escuta mais `store_role_permissions` nem `store_member_permissions` no arquivo enviado.
- [ ] Confirmar que `storeId` da sidebar é igual ao `storeId` usado no hook de permissões.
- [ ] Adicionar log temporário:
  - `storeId`;
  - `permissions.length`;
  - `allowedPermissions` críticos;
  - `refreshingPermissions`.
- [ ] Confirmar que `orders.view` e `customers.view` mudam dentro do array de permissões no admin.
- [ ] Se `permissions` muda e sidebar não muda, revisar `isMenuItemVisible`.
- [ ] Se `permissions` não muda, problema está no listener/versionamento.

### Testes

- [ ] Owner remove `orders.view` do Admin.
- [ ] Admin perde item `Pedidos` sem F5.
- [ ] Owner remove `customers.view` do Admin.
- [ ] Admin perde item `Clientes` sem F5.
- [ ] Owner altera papel/função do usuário.
- [ ] Admin reflete novo papel/função sem F5.

---

## 9.13.1E.7 — Redirecionamento seguro

### RequirePermission

- [ ] Página negada continua correta.
- [ ] Redirecionar para `/admin/my-profile`, não `/admin`.
- [ ] Botão deve dizer “Ir para Meus Dados”.
- [ ] Countdown deve dizer “Redirecionando para Meus Dados...”.

### Motivo

`/admin` depende de `dashboard.view`. `/admin/my-profile` é página pessoal e deve estar sempre disponível.

---

## 9.13.1E.8 — Segurança geral e menu Configurações

### Situação

Quando `security.view=false`, pode sobrar o grupo Configurações com `Senhas e Acesso`.

### Decisão recomendada

- [ ] Se `settings.view=false`, ocultar grupo Configurações inteiro.
- [ ] Se `settings.view=true` e `security.view=false`, ocultar apenas `Senhas e Acesso`.
- [ ] Não deixar link visível que redireciona imediatamente para `/admin/my-profile`.

---

## 9.13.1E.9 — Contexto de acesso

### Decisão

- [x] Manter em `Senhas e Acesso` como painel diagnóstico administrativo.
- [ ] Futuramente criar versão pessoal em `Meus Dados > Segurança da conta`.

### Labels

- [x] `Store ID` deve aparecer mascarado/parcial.
- [ ] Corrigir label para `É proprietário?`.
- [ ] Revisar `Perfil administrativo?`.
- [ ] Manter `Global admin` apenas como informação técnica/superadmin.

---

## 9.13.1E.10 — Conceitos

### Perfil administrativo

Definição temporária:

- owner: sim;
- admin: sim;
- manager/gerente: sim por decisão atual;
- viewer/visualizador: precisa revisar, pois normalmente não deveria ser administrativo.

### Global admin

Superadministrador da plataforma OptmaMenu/OptmaIdea, não da loja. Fica para etapa posterior de superusuário.

---

## 9.13.1E.11 — Limpezas

- [ ] Remover warning `isOwner` não utilizado no `Security.tsx`.
- [ ] Remover caracteres/labels estranhos.
- [ ] Revisar textos com acentuação quebrada.
- [ ] Revisar `docs/SCHEMA.md`.
- [ ] Deixar `docs/Advisors.md` para etapa posterior.

---

## Próxima sequência sugerida

1. **9.13.1E.5 — Listener robusto por versionamento**
2. **9.13.1E.6 — Sidebar reativa sem reload**
3. **9.13.1E.7 — Redirecionamento seguro**
4. **9.13.1F — Revisão final `manage=false`**
5. **9.13.1G — Pedido Online**
6. **9.13.1H — Configurações de Mensagens**
7. **9.13.2 — Fechamento geral da Segurança**
