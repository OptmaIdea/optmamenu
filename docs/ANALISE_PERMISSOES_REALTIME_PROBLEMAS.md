# Analise dos Problemas no Sistema de Permissoes Realtime

Este documento compara o que esta descrito em `docs/GUIA_SISTEMA_PERMISSOES_REALTIME.md` com a implementacao atual do projeto, explicando por que as alteracoes de permissoes nem sempre aparecem automaticamente para o usuario afetado e por que a tela pode passar a impressao de reload ou piscada.

## Resumo

A arquitetura documentada existe parcialmente, mas o fluxo completo ainda nao fecha.

O projeto tem helpers de evento local, hooks de permissao e assinaturas realtime no frontend. Porem:

- o Supabase Realtime parece nao estar habilitado para as tabelas de permissao necessarias;
- o hook principal nao escuta a tabela de overrides individuais;
- alguns salvamentos nao disparam `notifyPermissionsChanged`;
- o `loading` usado para refresh silencioso tambem bloqueia rotas e telas inteiras;
- em erro de refresh, as permissoes antigas sao descartadas.

Com isso, o usuario afetado depende de um realtime que provavelmente nao esta publicando eventos suficientes, e a interface desmonta partes importantes durante atualizacoes que deveriam ser silenciosas.

## 1. Realtime Assinado no Frontend, Mas Provavelmente Nao Publicado no Banco

O hook `usePermissions` cria um canal realtime em:

- `src/hooks/usePermissions.ts`

Ele assina as tabelas:

- `store_role_permission_templates`
- `store_custom_roles`
- `store_members`

Trecho relevante:

```ts
const channel = supabase
    .channel(`effective-permissions:${storeId}`)
    .on(
        'postgres_changes',
        {
            event: '*',
            schema: 'public',
            table: 'store_role_permission_templates',
            filter: `store_id=eq.${storeId}`,
        },
        scheduleRefresh
    )
    .on(
        'postgres_changes',
        {
            event: '*',
            schema: 'public',
            table: 'store_custom_roles',
            filter: `store_id=eq.${storeId}`,
        },
        scheduleRefresh
    )
    .on(
        'postgres_changes',
        {
            event: '*',
            schema: 'public',
            table: 'store_members',
            filter: `store_id=eq.${storeId}`,
        },
        scheduleRefresh
    )
    .subscribe();
```

Porem, o arquivo versionado de configuracao realtime encontrado em:

- `supabase/schema/tables/enable_realtime.sql`

adiciona apenas estas tabelas a publicacao `supabase_realtime`:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.loyalty_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_reservations;
```

Nao foi encontrada migracao adicionando estas tabelas criticas:

- `store_members`
- `store_member_permissions`
- `store_custom_roles`
- `store_role_permission_templates`

Consequencia: o frontend pode estar inscrito corretamente, mas o Supabase nao envia eventos porque as tabelas nao estao na publicacao realtime.

## 2. A Tabela `store_member_permissions` Nao E Escutada no `usePermissions`

O guia diz que as permissoes individuais ficam em:

- `store_member_permissions`

Essa tabela e central para overrides de usuario, ou seja, para o caso em que um administrador altera permissoes de um membro especifico.

No entanto, `src/hooks/usePermissions.ts` nao assina `store_member_permissions`.

Consequencia: quando uma permissao individual muda, o navegador do usuario afetado pode nao receber nenhum gatilho para recalcular suas permissoes.

O `PrivateLayout` monta uma lista realtime que inclui `store_member_permissions`, mas isso dispara refresh de contexto/layout, nao necessariamente o refresh efetivo de `usePermissions`.

Arquivo:

- `src/components/layouts/PrivateLayout.tsx`

Trecho relevante:

```ts
if (activeMembership?.member_id) {
    list.push({
        table: 'store_member_permissions',
        filter: `member_id=eq.${activeMembership.member_id}`,
    });
}
```

Mesmo assim, esse fluxo depende da tabela estar publicada no Supabase Realtime, o que nao aparece nas migracoes analisadas.

## 3. Nem Todo Salvamento Dispara `notifyPermissionsChanged`

O helper existe em:

- `src/utils/permissionEvents.ts`

Ele dispara:

- `CustomEvent` para a mesma aba;
- evento via `localStorage` para outras abas do mesmo navegador.

```ts
window.dispatchEvent(
    new CustomEvent<PermissionsChangedPayload>(PERMISSIONS_CHANGED_EVENT, {
        detail: payload,
    })
);

localStorage.setItem(
    PERMISSIONS_CHANGED_STORAGE_KEY,
    JSON.stringify(payload)
);
```

Isso funciona apenas localmente, no mesmo navegador. Para outro usuario, outro navegador ou outro dispositivo, ainda e necessario Supabase Realtime.

O hook `useSecurityPermissionsAdmin` chama `notifyPermissionsChanged` apos atualizar permissoes individuais:

- `src/hooks/security/useSecurityPermissionsAdmin.ts`

```ts
notifyPermissionsChanged(currentStoreId, 'member_permissions_update');
```

Porem, a tela `Security.tsx` possui um fluxo proprio para salvar permissoes individuais e faz chamada direta para a RPC:

- `src/pages/private/admin/settings/security/Security.tsx`

```ts
const { error } = await supabase.rpc('update_store_member_permissions', {
    p_member_id: selectedMember.member_id,
    p_permissions: selectedMemberPermissions,
    p_sensitive_actions: selectedMember.sensitive_actions ?? {},
    p_reason: 'Atualizacao de permissoes individuais',
});
```

Depois disso, ela atualiza a propria tela:

```ts
await refreshAdmin();
setSelectedMemberId(selectedId);
await fetchMemberPermissionDetail(selectedId);
await refreshPermissions();
```

Mas nao chama `notifyPermissionsChanged`.

Consequencia: a tela do administrador atualiza, mas outros hooks locais ou abas podem nao ser notificados por esse mecanismo. O usuario afetado fica dependendo somente do realtime do banco.

## 4. O Refresh Nao E Realmente Silencioso

O guia diz que durante o refresh silencioso as permissoes antigas devem continuar ativas ate a chegada das novas.

No entanto, `usePermissions.refresh()` sempre liga `loading`:

- `src/hooks/usePermissions.ts`

```ts
setLoading(true);
setError(null);
```

Esse mesmo `loading` e usado tanto para carga inicial quanto para atualizacoes em background.

Consequencia: qualquer componente que trata `loading` como carregamento bloqueante vai desmontar ou substituir a tela, mesmo quando era apenas uma sincronizacao silenciosa.

## 5. `RequirePermission` Bloqueia a Tela Durante Refresh

Arquivo:

- `src/components/RequirePermission.tsx`

Quando `permissionsLoading` fica `true`, o componente substitui todo o conteudo por um spinner full-screen:

```tsx
if (securityLoading || permissionsLoading) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#21A896]"></div>
    </div>
  );
}
```

Isso contradiz o comportamento esperado no guia.

Consequencia: uma atualizacao de permissao em background pode desmontar a pagina protegida e dar a impressao de reload.

## 6. `AdminLanding` Tambem Usa Loading Bloqueante

Arquivo:

- `src/AppRoutes.tsx`

O componente `AdminLanding` tambem bloqueia a tela quando `permissionsLoading` esta ativo:

```tsx
if (securityLoading || permissionsLoading) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#21A896]"></div>
    </div>
  );
}
```

Consequencia: ao recalcular permissoes, a area administrativa pode parecer recarregar.

## 7. A Tela `Security.tsx` Tambem Bloqueia Durante Refresh de Permissoes

Arquivo:

- `src/pages/private/admin/settings/security/Security.tsx`

Trecho:

```tsx
if (loading || loadingPermissions || loadingSecurityContext) {
    return (
        <div className="p-8 flex justify-center">
            <Loader className="animate-spin text-brand-green" />
        </div>
    );
}
```

Consequencia: a propria tela de seguranca pode piscar ou trocar o conteudo por loader ao salvar/atualizar permissoes.

## 8. O `PrivateLayout` Tenta Ser Suave, Mas Nao Controla os Guards

O `PrivateLayout` esta mais alinhado com o guia. Ele mostra apenas um texto discreto:

- `src/components/layouts/PrivateLayout.tsx`

```tsx
{loadingPermissions && (
    <div className="px-4 py-1 text-[10px] text-gray-400">
        Atualizando permissoes...
    </div>
)}
```

E a funcao `hasPermission` nao retorna `false` por causa do loading:

```ts
const hasPermission = useCallback((key: string) => {
    if (activeMembership?.role === 'owner') return true;

    return hasEffectivePermission(permissions, key);
}, [permissions, activeMembership?.role]);
```

Porem, isso nao resolve os componentes de rota que estao acima ou em volta das paginas, como `RequirePermission` e `AdminLanding`.

Consequencia: a sidebar pode tentar se manter suave, mas a pagina principal ainda pode ser desmontada.

## 9. Em Caso de Erro, As Permissoes Antigas Sao Descartadas

Arquivo:

- `src/hooks/usePermissions.ts`

No `catch`, o hook limpa as permissoes:

```ts
setError(getErrorMessage(err, 'Erro ao carregar permissoes'));
setPermissions([]);
```

Isso contraria o requisito de preservar o estado anterior durante refresh silencioso.

Consequencia: uma falha temporaria de rede ou RPC pode remover permissoes ja conhecidas, esconder menus e bloquear rotas indevidamente.

## Conclusao

As solucoes documentadas nao funcionam adequadamente porque a implementacao atual esta incompleta em pontos essenciais:

1. O banco provavelmente nao publica eventos realtime das tabelas de permissoes.
2. O hook `usePermissions` nao escuta `store_member_permissions`.
3. O fluxo de salvar permissoes individuais em `Security.tsx` nao chama `notifyPermissionsChanged`.
4. O refresh de permissoes usa `loading` bloqueante, nao um estado separado de refresh silencioso.
5. Guards e paginas substituem o conteudo por spinner durante atualizacoes em background.
6. Em erro de refresh, o estado anterior e apagado.

O resultado pratico e:

- o usuario afetado pode nao receber a alteracao automaticamente;
- quando recebe, a UI pode piscar ou parecer recarregar;
- o comportamento suave descrito no guia nao se sustenta fora da sidebar.

## Pontos Recomendados Para Correcao

1. Criar migracao para adicionar as tabelas de permissoes a `supabase_realtime`:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_member_permissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_custom_roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_role_permission_templates;
```

2. Adicionar `store_member_permissions` ao canal do `usePermissions`, filtrando pelo `member_id` do usuario ativo quando possivel.

3. Fazer `Security.tsx` usar `updateMemberPermissions` do hook `useSecurityPermissionsAdmin` ou chamar `notifyPermissionsChanged` apos `update_store_member_permissions`.

4. Separar `loadingInitial` de `refreshing` no `usePermissions`.

5. Fazer `RequirePermission`, `AdminLanding` e `Security.tsx` bloquearem tela apenas no carregamento inicial, mantendo o conteudo anterior durante refresh silencioso.

6. Em erro de refresh silencioso, preservar as permissoes antigas e apenas registrar/exibir erro discreto.

