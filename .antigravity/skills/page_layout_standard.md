# Skill: Padrão de Layout e Cabeçalhos de Página

## Visão Geral
Esta skill estabelece a estrutura visual padrão de cabeçalho e navegação para todas as telas do painel administrativo (/admin/*) da aplicação. Isso garante consistência visual e excelente experiência de uso em múltiplos tamanhos de tela.

---

## Diretrizes do Layout

Cada tela de funcionalidade associada a um item de menu deve seguir a seguinte estrutura de dois níveis:

### 1. Cabeçalho de Acesso Rápido (Quick Access Bar)
*   **Localização**: Fica fixado no topo da área de conteúdo (dentro do `PrivateLayout.tsx`).
*   **Conteúdo**:
    *   **Esquerda (Responsivo)**: Exibe os links irmãos (outras páginas do mesmo grupo de menu) como abas de navegação.
        *   **Telas Grandes (>= 1280px)**: Links exibidos em linha horizontalmente (`flex`).
        *   **Telas Menores (< 1280px)**: Links agrupados sob um botão rotulado **"Acesso Rápido"** com um ícone de configurações (`SlidersHorizontal`) e seta indicadora (`ChevronDown`). Abre via **mouse over (hover)** e via **clique** em um menu suspenso (dropdown) flutuante.
        *   Se não houver links irmãos, exibe a etiqueta "Menu de Operação".
    *   **Direita**:
        *   Portal de ações rápidas da página atual (`#quick-access-actions-portal`).
        *   Botão **"Atualizar"** com ícone de rotação (`RefreshCw`), que permanece visível fora do grupo de abas e recarrega os dados da página.

### 2. Título Descritivo da Página (PageContainer Header)
*   **Componente**: Deve-se utilizar obrigatoriamente o componente `PageContainer` com a propriedade `flat={true}`.
*   **Parâmetros**:
    *   `category`: Nome do grupo de navegação em maiúsculas (ex: `"CONFIGURAÇÕES"`, `"PRODUTOS"`, `"COMERCIAL"`).
    *   `title`: O nome descritivo do item de menu ativo (ex: `"Usuários"`).
    *   `subtitle`: Breve frase explicativa do objetivo da tela (ex: `"Gerencie os usuários do sistema e suas permissões"`).
    *   `icon`: O componente do ícone do Lucide correspondente à página (ex: `<UsersIcon size={28} className="text-[#21A896]" />`), posicionado antes do título.

---

## Exemplo de Implementação de Referência (`/admin/users`)

```tsx
import PageContainer from '@/components/common/PageContainer';
import { Users as UsersIcon } from 'lucide-react';

export default function Users() {
  return (
    <PageContainer
      title="Usuários"
      subtitle="Gerencie os usuários do sistema e suas permissões"
      category="Configurações"
      icon={<UsersIcon size={28} className="text-[#21A896]" />}
      flat
    >
      {/* Conteúdo da página */}
    </PageContainer>
  );
}
```
