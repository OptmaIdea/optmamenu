# OptmaMenu — 9.13.1E Realtime, Refresh Suave e Pendências de Permissões

**Data:** 2026-06-17  
**Status geral:** em andamento  
**Escopo:** `/admin/security`, listeners de permissões, redirecionamentos seguros, contexto de acesso e pendências pós-reorganização de Configurações.

---

## Objetivo da etapa

Resolver definitivamente o comportamento de permissões em tempo real e reduzir ruídos visuais ao salvar alterações em:

- `/admin/security?tab=roles`
- `/admin/security?tab=custom_roles`
- `/admin/security?tab=user_permissions`
- sidebar/menu lateral
- rotas protegidas via `RequirePermission`

---

## Diagnóstico resumido

| ID | Problema | Status | Prioridade | Decisão / Correção proposta |
|---:|---|---|---|---|
| 1 | Tela do owner ficou mais suave, mas ainda há ruído visual leve | Parcial | Média | Manter matriz renderizada e usar apenas indicador discreto `refreshing`/`matrixRefreshing`. |
| 2 | Listener parece funcionar apenas no grupo Configurações | Aberto | Alta | Substituir listener dependente de várias tabelas por versionamento central `store_permission_versions`. |
| 3 | Alterações no grupo Operacional não refletem no admin em tempo real | Aberto | Alta | Usar evento/versionamento global de permissões, disparado por todas as RPCs de alteração. |
| 4 | Página sem permissão redireciona para `/admin`, que pode não estar liberada | Aberto | Alta | `RequirePermission` deve redirecionar para `/admin/my-profile`. |
| 5 | `security.view=false` ainda pode deixar Configurações/Senhas e Acesso visível em cenário específico | Revisar | Média | Sidebar deve ocultar item `Senhas e Acesso` quando `security.view=false`; se grupo ficar vazio, ocultar grupo. |
| 6 | Decidir onde fica “Contexto de acesso” | Decisão | Média | Manter versão administrativa em Senhas e Acesso; criar versão simplificada futura em Meus Dados > Segurança. |
| 7 | Definir “Perfil administrativo” e “Global admin” | Decisão | Média | Perfil administrativo = papel elevado na loja ativa; Global admin = superadmin da plataforma/SaaS. |
| 8 | Alteração de função de usuário não refletiu em tempo real | Aberto | Alta | Versionamento central deve ser acionado em alteração de papel/base role/custom role. |
| 9 | Store ID limitado aos 6 primeiros dígitos | Feito | Baixa | Manter mascaramento por padrão; mostrar completo apenas em modo diagnóstico se necessário. |
| 10 | Vídeo em `optmamenu_permissos.mp4` | Analisado parcialmente | Baixa | Vídeo ajuda a visualizar o ruído e a falta de listener; usar como referência visual. |
| 11 | Supabase aparenta lentidão | Monitorar | Média | Evitar múltiplos refreshes; usar debounce e tabela de versão leve. |
| 12 | Arquivos atuais comitados | Feito | Baixa | Usar GitHub como fonte atual. |
| 13 | Warning TS: `isOwner` declarado e não usado em `Security.tsx` | Aberto | Baixa | Remover variável ou substituir usos por `isStoreOwner`. |
| 14 | Advisors em `docs/Advisors.md` | Posterior | Média | Analisar após estabilizar realtime/listener. |
| 15 | `docs/realtime_backend.json` lista tabelas realtime | Referência | Média | Validar se tabelas usadas pelos listeners existem e estão realtime. |
| 16 | `docs/SCHEMAS.md` atualizado | Referência | Média | Remover referências a tabelas inexistentes, principalmente `store_member_permissions`. |

---

## Correção estrutural recomendada: `store_permission_versions`

### Por que criar uma tabela central?

O listener atual depende de várias tabelas (`store_role_permission_templates`, `store_custom_roles`, `store_members`) e ainda existem referências legadas a `store_member_permissions`, que não existe no schema atual. Isso torna o realtime frágil e diferente entre grupos.

A solução mais robusta é criar uma tabela leve de versão por loja:

```sql
create table if not exists public.store_permission_versions (
  store_id uuid primary key references public.stores(id) on delete cascade,
  version bigint not null default 1,
  reason text,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

alter table public.store_permission_versions enable row level security;

create policy store_permission_versions_select_members
on public.store_permission_versions
for select
using (public.is_store_member(store_id));
```

### Função de toque/versionamento

```sql
create or replace function public.touch_store_permission_version(
  p_store_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.store_permission_versions (
    store_id,
    version,
    reason,
    changed_by,
    changed_at
  ) values (
    p_store_id,
    1,
    p_reason,
    auth.uid(),
    now()
  )
  on conflict (store_id)
  do update set
    version = public.store_permission_versions.version + 1,
    reason = excluded.reason,
    changed_by = excluded.changed_by,
    changed_at = now();
end;
$$;
```

### Realtime da tabela

```sql
do $$
begin
  begin
    alter publication supabase_realtime add table public.store_permission_versions;
  exception when duplicate_object then
    null;
  end;
end $$;
```

### Onde chamar `touch_store_permission_version`

Chamar no final das RPCs/funções que alteram permissões ou vínculos:

- `set_store_role_permission_v3`
- `set_store_role_permissions_bulk_v3`
- `update_store_member_permissions`
- `assign_store_custom_role_to_member`
- `create_store_custom_role`
- `update_store_custom_role`
- funções de ativar/inativar função personalizada
- funções que alterem `store_members.role`, `store_members.permissions`, `store_members.custom_role_id` ou `store_members.status`

---

## Ajustes de frontend recomendados

### `usePermissions.ts`

- Remover listener da tabela inexistente `store_member_permissions`.
- Manter refresh silencioso.
- Escutar preferencialmente `store_permission_versions`.
- Opcionalmente manter fallback escutando `store_role_permission_templates`, `store_custom_roles` e `store_members`, mas a fonte principal deve ser a tabela de versão.

### `PrivateLayout.tsx`

- Remover listeners de permissões do layout.
- Layout deve escutar apenas contexto:
  - `store_members`
  - `profiles`
  - `stores`
- Corrigir textos com acentuação:
  - `Atualizando permissões...`
- Trocar símbolo de seta textual por ícone `ChevronDown` para evitar caracteres estranhos.

### `RequirePermission.tsx`

- Em caso de acesso negado, redirecionar para `/admin/my-profile`, não para `/admin`.
- Botão principal deve ser “Ir para Meus Dados”.
- Countdown deve apontar para Meus Dados.

### `Security.tsx`

- Remover warning TS de `isOwner` não usado.
- Garantir que o campo “É proprietário?” se refere à loja ativa.
- `Global admin` deve ser exibido como diagnóstico da plataforma, não permissão de loja.
- Store ID deve permanecer mascarado por padrão.

---

## Definições conceituais

### Contexto de acesso

**Manter em Senhas e Acesso** como painel diagnóstico administrativo, pois ele mostra vínculo, papel, permissões efetivas, status e flags de segurança da loja ativa.

**Criar futuramente em Meus Dados** uma aba simplificada “Segurança da conta”, com informações pessoais do usuário:

- dados da conta
- senha de acesso
- PIN pessoal
- sessões
- histórico próprio

### Perfil administrativo

Usuário com papel administrativo dentro da loja ativa, por exemplo:

- `owner`
- `admin`
- talvez `manager`, dependendo da regra final

Não significa superadmin da plataforma.

### Global admin

Usuário interno da plataforma OptmaMenu/OptmaIdea com permissão global/SaaS. Deve ser raro e não deve liberar automaticamente ações comuns da loja, salvo em área de suporte/admin global futura.

---

## Checklist de validação

### Listener operacional

- [ ] Owner tira `orders.view` de Admin.
- [ ] Admin vê “Pedidos” sumir sem F5.
- [ ] Owner tira `customers.view` de Admin.
- [ ] Admin vê “Clientes” sumir sem F5.
- [ ] Owner altera função de usuário.
- [ ] Usuário afetado recebe nova permissão sem F5.

### Listener Configurações

- [ ] `settings.payment.view=false` remove Pagamento da sidebar e da aba.
- [ ] `settings.stock.view=false` remove Configurações de Estoque.
- [ ] `security.view=false` remove Senhas e Acesso.

### Rotas protegidas

- [ ] Acesso negado redireciona para `/admin/my-profile`.
- [ ] Não redireciona mais para `/admin` quando dashboard não estiver liberado.

### UI/ruído

- [ ] Nenhum spinner full-screen em refresh silencioso.
- [ ] Sidebar não desmonta durante refresh.
- [ ] Texto “Atualizando permissões...” aparece apenas como indicador discreto.
- [ ] Não há caracteres estranhos no menu.

---

## Próxima sequência sugerida

1. **9.13.1E.5 — Listener robusto por versionamento**  
   Criar `store_permission_versions`, ajustar RPCs e frontend.

2. **9.13.1E.6 — Redirecionamento seguro e limpeza visual**  
   Ajustar `RequirePermission`, ícones e textos.

3. **9.13.1F — Padrão final `manage=false`**  
   Inputs, switches e selects desabilitados; botões ocultos; tooltips no lugar de toasts.

4. **9.13.1G — Pedido Online**  
   Slug, status da loja pública, layout básico, link público, pedido mínimo e regras iniciais.

5. **9.13.1H — Configurações de Mensagens**  
   Templates, canais, mensagens padrão e separação entre configuração e operação.

6. **9.13.2 — Fechamento geral da Segurança**  
   Revisão de rotas, menus, abas, logs, documentação e advisors.
