---
name: page_container_header_standard
description: Regras de uso do PageContainer e cabeçalhos
---
# Skill: Padrão de Cabeçalho Suave (Page Header Customization)

## Visão Geral
Esta skill estabelece o padrão de estilização de cabeçalhos de páginas no OptmaMenu utilizando o componente reutilizável `PageContainer`.  
Para evitar poluição visual ("cabeçalhos agressivos") e manter a interface do sistema moderna, limpa e consistente com páginas como **Atividades recentes**, o componente `PageContainer` suporta os modos **Card** (padrão com bordas e gradientes) e **Flat** (cabeçalho suave, sem fundo, integrado ao canvas).

---

## Opções de Cabeçalho do PageContainer

O cabeçalho do `PageContainer` possui duas variantes visuais principais configuráveis por propriedades (props):

1. **Variante Card (Padrão)**:
   * **Uso**: Ideal para páginas isoladas ou formulários de destaque.
   * **Visual**: Renderiza um container com fundo gradiente (`from-white to-gray-50`), bordas arredondadas e sombra.
   
2. **Variante Flat (Cabeçalho Suave)**:
   * **Uso**: Recomendado para páginas de listagens, dashboards e configurações onde os dados já ocupam muito espaço e um frame adicional no topo geraria atrito visual.
   * **Visual**: Renderiza os textos e ações diretamente sobre o plano de fundo da aplicação (off-white `#F8F6F2`), de maneira limpa e sutil.

---

## Como Utilizar

Sempre que criar ou editar uma página do painel administrativo que utilize o `PageContainer`, configure o cabeçalho seguindo as diretrizes abaixo:

### 1. Cabeçalho Suave (Flat) com Tag de Categoria

Para adotar o padrão suave e integrado (como na tela de *Usuários* e *Atividades recentes*), passe as propriedades `flat` e `category` ao componente:

```tsx
import PageContainer from '@/components/common/PageContainer';

export default function MinhaPagina() {
  return (
    <PageContainer
      title="Usuários"
      subtitle="Gerencie os usuários do sistema e suas permissões"
      category="Configurações" // Exibido em verde-água (#21A896) e caixa alta acima do título
      flat // Ativa o modo sem container de fundo (suave)
    >
      {/* Conteúdo da página */}
    </PageContainer>
  );
}
```

### 2. Cabeçalho Padrão (Card)

Utilizado quando se deseja isolar a introdução da página em um bloco visual próprio:

```tsx
import PageContainer from '@/components/common/PageContainer';

export default function MinhaPaginaDestaque() {
  return (
    <PageContainer
      title="Visão Geral do Estabelecimento"
      subtitle="Dados de faturamento, desempenho e status da sua loja"
    >
      {/* Conteúdo da página */}
    </PageContainer>
  );
}
```

---

## Diretrizes de Escolha e Consistência

* **Consistência por Seção**: Telas dentro do mesmo grupo de menu lateral (ex: todas as telas de *Configurações* ou todas de *Produtos*) devem preferencialmente seguir o mesmo padrão de cabeçalho (Flat ou Card) para evitar mudanças bruscas de layout ao navegar.
* **Uso do `category`**: A tag de categoria deve corresponder ao grupo do menu lateral (ex: `"Configurações"`, `"Produtos"`, `"Financeiro"`) ou ao contexto operacional geral da funcionalidade.

---

## 🔐 Padrão de Cabeçalho de Modais de Edição e Visualização

Para garantir que o usuário mantenha o contexto do item com o qual está lidando ao rolar a página em modais, todos os modais de edição e visualização de entidades do sistema (ex: Categorias, Produtos, etc.) devem exibir um cabeçalho fixo no seguinte formato:

1. **Modal de Edição**:
   * **Padrão**: `Editar <Nome da Entidade> | <Nome original do item sendo editado>`
   * **Implementação**:
     ```tsx
     {isEditing ? `Editar Categoria | ${category?.name || ''}` : 'Nova Categoria'}
     ```

2. **Modal de Visualização**:
   * **Padrão**: `Visualizar <Nome da Entidade> | <Nome original do item sendo visualizado>`
   * **Implementação**:
     ```tsx
     Visualizar Categoria | {category.name}
     ```

* **Fixidez e Clareza**: O cabeçalho deve estar sempre fixo no topo do modal. Se a tela sofrer rolagem, o título permanecerá visível permitindo identificar rapidamente o contexto de operação.


