# Segurança, Governança de Usuários e Sistema de Permissões

> **Versão Autorizada:** `0.10.0-rc.1`  
> **Consolidação:** Fase 9.13 (Permissões, Realtime e Segurança), Fase 9.13.1G (Meu Histórico) e Governança de Clientes.

---

## 🔐 1. Arquitetura de Identidade e Usuários

O OptmaMenu adota um modelo rigoroso de separação entre **dados globais do usuário** e o **vínculo com o estabelecimento (loja)**:

| Tabela | Responsabilidade | Campos Principais |
|---|---|---|
| `profiles` | Dados globais da conta de usuário (autenticação Supabase Auth) | `id`, `full_name`, `cpf`, `birth_date`, `avatar_url`, `created_at` |
| `store_members` | Vínculo específico do colaborador com a loja | `id`, `store_id`, `user_id`, `role`, `status`, `internal_alias`, `permissions`, `custom_role_id` |

> ⚠️ **Regra Fundamental**: Nunca buscar o apelido interno (`internal_alias`) em `profiles`. O apelido por loja reside estritamente em `store_members`.

---

## 🛡️ 2. Sistema de Permissões — Precedência e Hierarquia

O acesso a rotas, menus, abas e ações administrativas segue uma ordem de avaliação determinística em 5 níveis:

1. **Permissão Individual (`store_members.permissions`)**: Configurações customizadas diretamente no membro sobrepõem qualquer papel.
2. **Função Personalizada (`store_custom_roles.permissions`)**: Se o membro possui um `custom_role_id`, adota a matriz de permissões dessa função.
3. **Papel Base (`store_role_permission_templates`)**: Caso contrário, utiliza o template associado ao `role` padrão (`manager`, `cashier`, `stockist`, `waiter`, `kitchen`, etc.).
4. **Fallback Seguro (`false`)**: Qualquer chave não mapeada ou omissa avalia estritamente como `false`.
5. **Proprietário (`owner`)**: O papel `owner` possui porteira aberta e acesso integral a todas as áreas, ignorando verificações específicas.

---

## 👁️ 3. Regras de Interface: `view` vs `manage`

### 3.1 Padrão `view=false`
- Oculta o item do menu lateral/header e impede a navegação para a aba ou rota correspondente.
- Se o usuário tentar acessar via URL direta uma rota onde `view=false`, o sistema executa um **redirecionamento gracioso** para a rota padrão acessível (`/admin/my-profile`).
- O grupo **SEGURANÇA** (`/admin/security`) é protegido pela chave mestra `security.view`. Se `security.view=false`, nenhuma aba de segurança abre.

### 3.2 Padrão `manage=false`
- A tela permanece acessível em **modo somente leitura**.
- Formulários, inputs, selects, toggles e botões de alteração/exclusão ficam desabilitados ou ocultos.
- Utiliza o componente `<PermissionLocked />` e utilitários visuais sem disparar erros no console ou toasts de rejeição desnecessários.

---

## ⚡ 4. Realtime de Permissões (`store_permission_versions`)

A atualização de permissões em tempo real é centralizada para garantir alta performance e estabilidade nos navegadores:

- **Tabela Central**: `store_permission_versions`.
- **Hook Responsável**: `src/hooks/usePermissions.ts`.
- **Funcionamento**: Qualquer alteração em papéis, membros ou funções personalizadas incrementa o campo `version` em `store_permission_versions` para a loja. O hook escuta exclusivamente essa tabela e invalida a cache local de permissões instantaneamente, refletindo as mudanças na UI sem recarregar a página.

---

## 📜 5. Auditoria e "Meu Histórico" (`/admin/my-history`)

- **Rastreabilidade**: Todas as ações sensíveis (alteração de senhas, alteração de permissões, cancelamentos de pedidos, divergências de caixa e sangrias) são registradas em `store_security_activity_logs`.
- **Meu Histórico**: A rota `/admin/my-history` exibe ao usuário logado seu histórico pessoal de logins, sessões ativas, alterações cadastrais e ações sensíveis realizadas em seu vínculo.

---

## 📋 6. Checklist Obrigatório para Novas Permissões

Toda nova permissão introduzida no OptmaMenu deve obrigatoriamente cumprir os 4 passos:

1. **Registrar no Catálogo**: Incluir a chave no catálogo de permissões e no template base (`store_role_permission_templates`).
2. **Atualizar `store_permission_versions`**: Garantir que alterações na permissão acionem o evento de realtime.
3. **Mapear na Árvore Visual (`ROLE_PERMISSION_TREE`)**: Incluir a chave no mapa de permissões com label amigável em pt-BR.
4. **Proteger Rotas e UI**: Aplicar a verificação na rota via `ProtectedRoute` / `RequirePermission` e na interface via `manage`.
