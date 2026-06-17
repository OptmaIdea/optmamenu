# Análise dos Problemas: Permissões em Tempo Real & Smooth UX

Este documento analisa as causas pelas quais as soluções descritas em `GUIA_SISTEMA_PERMISSOES_REALTIME.md` não estão funcionando adequadamente no projeto atual.

---

## Problema 1: Falta inscrição Realtime na tabela `store_member_permissions`

**Arquivo**: `src/hooks/usePermissions.ts:107-139`

O hook `usePermissions` inscreve-se via Supabase Realtime nas seguintes tabelas:

| Tabela                          | Inscrito? |
| ------------------------------- | --------- |
| `store_role_permission_templates` | Sim       |
| `store_custom_roles`            | Sim       |
| `store_members`                 | Sim       |
| `store_member_permissions`      | **NÃO**   |

**Consequência**: Quando um admin em outro dispositivo/navegador altera permissões individuais de um usuário (tabela `store_member_permissions`), o hook `usePermissions` do usuário afetado **não é notificado** via Supabase Realtime. O usuário só visualiza a mudança ao recarregar manualmente a página (F5).

**Correção necessária**: Adicionar a inscrição em `store_member_permissions` com filtro por `member_id` ao canal Realtime dentro de `usePermissions`.

---

## Problema 2 (CRÍTICO): Re-inicialização pesada do Layout a cada mudança em `store_members`

**Arquivo**: `src/components/layouts/PrivateLayout.tsx:627-673`

### Fluxo problemático atual

```
useRealtimeListener (tabela: store_members)
  → onChanged: debouncedContextRefresh (500ms debounce)
    → dispatchEvent('optmamenu:security-context-refresh')
      → handleSecurityRefresh (linha 604)
        → initialize()  ← RE-INICIALIZAÇÃO COMPLETA
```

### O que `initialize()` faz (linha 415-623)

1. `supabase.auth.getUser()` — busca o usuário autenticado
2. `getCurrentUserSecurityContext()` — busca todas as memberships via RPC
3. Resolve a loja ativa (`storedActiveStoreId`)
4. Verifica suspensão/bloqueio de acesso
5. `Promise.all` de:
   - `supabase.from('profiles').select(...)` — dados do perfil
   - `supabase.from('store_members').select(...)` — alias, avatar, email, telefone
6. Atualiza os estados: `storeId`, `storeSlug`, `activeMembership`, `userData`
7. Reconfigura o `usePermissions` (pois `storeId` muda)

**Isso é essencialmente um reload completo da página.** Qualquer mudança em `store_members` (de **qualquer** membro da loja, não apenas o usuário afetado) dispara essa re-inicialização em **todos os navegadores** abertos pelos membros daquela loja.

### Por que isso viola o documento GUIA

O GUIA define (Seção "Experiência de Usuário Suave"):

> - **Sem piscadas (no flicker)**: O menu lateral e as rotas não devem piscar, sumir ou recarregar de forma abrupta durante a atualização.
> - **Estado Anterior Preservado**: Durante o refresh silencioso em segundo plano, as permissões antigas do usuário devem ser mantidas ativas até que a resposta com as novas permissões seja totalmente processada.

A re-inicialização completa viola ambos os princípios: causa piscadas/flicker e substitui o estado anterior instantaneamente.

---

## Problema 3: Conflito de timing entre debounces

Há dois mecanismos de debounce concorrentes reagindo ao mesmo evento:

| Mecanismo                    | Debounce | Arquivo / Linha          |
| ---------------------------- | -------- | ------------------------ |
| `usePermissions`             | 400ms    | `usePermissions.ts:75`   |
| `PrivateLayout` (contexto)   | 500ms    | `PrivateLayout.tsx:662`  |

### Sequência problemática quando `notifyPermissionsChanged` dispara

```
t=0ms    CustomEvent disparado
t=400ms  usePermissions → scheduleRefresh() → setLoading(true) → re-render leve
t=500ms  PrivateLayout → debouncedContextRefresh → initialize() → re-render massivo
```

**Resultado**: derrubos visuais consecutivos — primeiro um indicador sutil de "Atualizando permissões...", seguido 100ms depois por uma re-inicialização completa que redesenha toda a sidebar e o conteúdo.

---

## Problema 4: `setLoading(true)` precoce no `usePermissions`

**Arquivo**: `src/hooks/usePermissions.ts:46`

```typescript
const refresh = useCallback(async () => {
    setLoading(true);  // ← Estado alterado ANTES da busca
    // ...
    const result = await getEffectiveStorePermissions(storeId);
    setPermissions(result);
    setLoading(false);
}, [storeId]);
```

O `setLoading(true)` é chamado **antes** da busca assíncrona, o que imediatamente altera o estado do componente consumidor. Embora o `PrivateLayout` mostre apenas um texto sutil ("Atualizando permissões..." na linha 1079-1083), esse `setState` provoca um re-render desnecessário que, combinado com o Problema 2, amplifica a percepção de "reload".

**Correção sugerida**: Usar um estado separado como `refreshing` (em vez de `loading`) para indicar atualização em segundo plano, sem bloquear a UI com o estado `loading` principal.

---

## Problema 5: `updateSensitiveAction` não chama `notifyPermissionsChanged`

**Arquivo**: `src/hooks/security/useSecurityPermissionsAdmin.ts:376-416`

A função `updateSensitiveAction` executa a RPC `update_store_sensitive_action_rule` mas **não invoca** `notifyPermissionsChanged` após sucesso:

```typescript
const updateSensitiveAction = useCallback(async (params) => {
    // ... executa RPC ...
    setLoading((prev) => ({ ...prev, saving: false }));

    if (rpcError) throw rpcError;

    // ← FALTA: notifyPermissionsChanged(currentStoreId, 'sensitive_action_update');
    await fetchSensitiveActions({ silent: true });
}, [...]);
```

**Correção necessária**: Adicionar `notifyPermissionsChanged(currentStoreId, 'sensitive_action_update')` após a execução bem-sucedida da RPC.

---

## Causa Raiz: Duas infraestruturas reagindo à mesma mudança com intensidades diferentes

```
Mudança em store_members (via admin)
  │
  ├─→ usePermissions ( leve )
  │     → CustomEvent / StorageEvent / Realtime
  │     → scheduleRefresh (400ms)
  │     → getEffectiveStorePermissions(storeId)  // RPC rápida
  │     → setPermissions(result)                 // Atualiza estado
  │     → Re-render com novas permissões         // Suave
  │
  └─→ useRealtimeListener no PrivateLayout ( pesado )
        → onChanged (500ms)
        → dispatchEvent('optmamenu:security-context-refresh')
        → initialize()                           // RE-INICIALIZAÇÃO COMPLETA
        → getUser + getSecurityContext + getProfile + getMembers
        → Atualiza storeId, membership, userData  // Substitui tudo
        → Re-render massivo                      // Causa flicker/reload
```

O mecanismo leve (`usePermissions`) funciona corretamente — busca apenas as permissões efetivas e atualiza o estado local. Porém, o mecanismo pesado (`initialize()` no PrivateLayout) sobrescreve o resultado 100ms depois, causando a aparência de reload.

---

## Resumo das Correções Necessárias

| #  | Correção                                                              | Arquivo                                    | Prioridade |
| -- | --------------------------------------------------------------------- | ------------------------------------------ | ---------- |
| 1  | Adicionar `store_member_permissions` ao canal Realtime em `usePermissions` | `src/hooks/usePermissions.ts`              | Alta       |
| 2  | **Não re-inicializar o contexto completo** quando `store_members` mudar — atualizar incrementalmente apenas campos afetados | `src/components/layouts/PrivateLayout.tsx` | Crítica    |
| 3  | Unificar ou alinhar os debounces para evitar dois refreshes concorrentes | Ambos os arquivos                          | Média      |
| 4  | Usar estado `refreshing` separado de `loading` no `usePermissions`    | `src/hooks/usePermissions.ts`              | Média      |
| 5  | Adicionar `notifyPermissionsChanged` ao `updateSensitiveAction`       | `useSecurityPermissionsAdmin.ts`           | Média      |
