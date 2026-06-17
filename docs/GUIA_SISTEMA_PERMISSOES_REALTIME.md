# Guia do Sistema de Permissões em Tempo Real (Realtime & Smooth UX)

Este documento descreve a arquitetura, o fluxo de sincronização em tempo real (Realtime) e a experiência de usuário sem interrupções (Smooth UX) para o sistema de permissões do **OptmaMenu**. Ele serve tanto como documentação de referência quanto como guia de instruções (prompt-style) para o desenvolvimento e manutenção do ecossistema.

---

## 🎯 Objetivo e Necessidades de UX

Quando um administrador ou proprietário altera as permissões de um membro da equipe na tela de Segurança (`/admin/security`):
1. **Sincronização em Tempo Real**: O usuário afetado deve ter suas permissões recalculadas e atualizadas no navegador imediatamente, sem necessidade de atualizar a página manualmente (F5).
2. **Experiência de Usuário Suave (Smooth UX)**:
   - **Sem piscadas (no flicker)**: O menu lateral e as rotas não devem piscar, sumir ou recarregar de forma abrupta durante a atualização.
   - **Estado Anterior Preservado**: Durante o refresh silencioso em segundo plano, as permissões antigas do usuário devem ser mantidas ativas até que a resposta com as novas permissões seja totalmente processada.
   - **Carregamento Sutil**: No máximo, a sidebar exibe um indicador sutil e discreto (*"Atualizando permissões..."*), mantendo a integridade da navegação.

---

## 🗄️ Estrutura de Tabelas do Banco de Dados (Supabase/PostgreSQL)

O sistema de controle de acesso do backend do Supabase é estruturado sobre as seguintes tabelas:

1. **`stores`**: Armazena as informações das lojas (estabelecimentos).
2. **`store_members`**: Vínculo entre os perfis (`profiles`/`auth.users`) e as lojas, contendo o papel principal do usuário (`role`, ex: `manager`, `cashier`) e referenciando funções personalizadas, se aplicável.
3. **`store_role_permission_templates`**: Modelos de permissões básicas e associadas a cada papel em nível de sistema ou nível de loja.
4. **`store_custom_roles`**: Funções (papéis) personalizadas criadas especificamente por uma loja, contendo um JSONB de herança (`permissions`) e papel base (`base_role`).
5. **`store_member_permissions`**: Sobrescritas (overrides) de permissões em nível individual para um membro específico da loja (permite conceder ou negar chaves específicas independentemente do papel).

---

## ⚙️ Os Três Modelos de Configuração de Permissões

A resolução final do vetor de permissões de um usuário segue uma hierarquia de prioridades bem definida:

### 1. Permissões por Papel (Role-based / Built-in Templates)
* **Como funciona**: Chaves de permissão padrão associadas a um dos 8 papéis nativos do sistema (`owner`, `admin`, `manager`, `stock_operator`, `cashier`, `sales`, `staff`, `viewer`).
* **Resolução**: Se o usuário não tiver funções personalizadas ou sobrescritas individuais, ele herda a matriz padrão do seu papel ativo na tabela `store_role_permission_templates`.
* **Exceção**: O papel de Proprietário (`owner`) ignora qualquer checagem e possui acesso total irrestrito automaticamente.

### 2. Funções Personalizadas (Custom Roles)
* **Como funciona**: Permite que a loja crie um papel sob medida (ex: "Gerente de Turno"), herdando um papel base nativo, mas estendendo ou restringindo permissões específicas.
* **Resolução**: Ao carregar, o sistema resolve o papel base e aplica as chaves customizadas parametrizadas em `store_custom_roles` para o perfil selecionado.

### 3. Permissões por Usuário (Individual Overrides)
* **Como funciona**: Ajustes granulares aplicados diretamente sobre a conta de um membro da equipe (tabela `store_member_permissions`).
* **Resolução**: Sobrescreve tanto as permissões por papel quanto as funções personalizadas. Se o registro for `allowed = true`, concede; se `allowed = false`, revoga expressamente.

---

## 🔄 Fluxo de Sincronização em Tempo Real (Realtime)

A sincronização entre o administrador (quem altera) e o operador (quem é alterado) ocorre através de três vias redundantes e complementares:

```mermaid
graph TD
    A[Administrador altera permissões] -->|update_store_custom_role ou update_store_member_permissions| B(notifyPermissionsChanged)
    B -->|1. CustomEvent| C[Mesma Aba / Janela]
    B -->|2. LocalStorage Event| D[Outras Abas do mesmo navegador]
    A -->|3. PostgreSQL Replication| E[Supabase Realtime Channel]
    E -->|WebSocket| F[usePermissions no navegador do usuário afetado]
    C -->|Debounce 400ms| G[refresh() de permissões silencioso]
    D -->|Debounce 400ms| G
    F -->|Debounce 400ms| G
```

1. **Mesma Aba (CustomEvent)**: O evento `'optmamenu:permissions-changed'` é disparado globalmente via `window.dispatchEvent` para que hooks locais atualizem imediatamente.
2. **Outra Aba no mesmo navegador (StorageEvent)**: O evento grava uma chave temporária com timestamp em `localStorage`. Outras abas escutam a alteração através do evento `'storage'` e agendam o refresh.
3. **Outro navegador/dispositivo (Supabase Realtime)**: O hook `usePermissions` abre um canal WebSocket escutando alterações RLS-safe nas tabelas `store_role_permission_templates`, `store_custom_roles` e `store_members` para a loja ativa.

---

## 📂 Arquivos Envolvidos e Suas Funções

### 1. [`src/utils/permissionEvents.ts`](file:///d:/optmamenu/src/utils/permissionEvents.ts)
* **Função**: Helper utilitário que centraliza a criação e emissão dos payloads de eventos de mudança de permissões para a janela local e para o `localStorage` (cross-tab).

### 2. [`src/hooks/usePermissions.ts`](file:///d:/optmamenu/src/hooks/usePermissions.ts)
* **Função**: Carrega o vetor de permissões efetivas do usuário ativo. Escuta canais realtime do Supabase, `CustomEvent` local e `StorageEvent` para agendar um recarregamento debulhado (debounce 400ms) sem ativar telas de carregamento bloqueantes.

### 3. [`src/components/layouts/PrivateLayout.tsx`](file:///d:/optmamenu/src/components/layouts/PrivateLayout.tsx)
* **Função**: Renderiza o menu lateral de navegação condicionado às permissões do usuário.
* **Detalhe Crítico de UX**: A função `hasPermission` **não** bloqueia ou retorna `false` quando `loadingPermissions` está ativo. Isso evita a remontagem de componentes do sidebar e a perda visual das opções do usuário durante a sincronização em tempo real. Exibe apenas a string *"Atualizando permissões..."* na barra lateral de forma discreta.

### 4. [`src/hooks/security/useSecurityPermissionsAdmin.ts`](file:///d:/optmamenu/src/hooks/security/useSecurityPermissionsAdmin.ts)
* **Função**: Hook administrativo para salvar templates de papéis, permissões em lote e individuais. Invoca `notifyPermissionsChanged` após a execução bem-sucedida das RPCs de escrita.

### 5. [`src/pages/private/admin/settings/security/Security.tsx`](file:///d:/optmamenu/src/pages/private/admin/settings/security/Security.tsx)
* **Função**: Tela administrativa de Segurança e Permissões. Dispara `notifyPermissionsChanged` ao criar, editar ou inativar funções personalizadas (`custom_role_update`).
