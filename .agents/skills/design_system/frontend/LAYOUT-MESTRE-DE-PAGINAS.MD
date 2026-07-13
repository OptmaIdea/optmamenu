# Layout Mestre para Reestruturação e Criação das Páginas do Menu

**Imagem modelo:** `admin-inicial.png` (página inicial após login do usuário).

Este documento, em conjunto com as imagens da pasta `.agent/skills/app/design/images`, define as diretrizes das páginas do projeto (novas e existentes), bem como de componentes e ícones.

## Considerações importantes

- O modelo atual considera **desktop**, mas deve ser **responsivo** (tablets, mobiles, telas menores).
- **Cores e fontes:** seguir o arquivo `.agent/skills/design_system.md` até segunda ordem.
- **Imagem base:** `layout-base.png` ilustra as áreas padronizadas:
  - **Lateral:** itens 1 a 4
  - **Cabeçalho:** itens 5 a 7
  - **Frame:** itens 8 a 10

---

## Lateral

Na lateral teremos:
- Logo da aplicação
- Usuário logado
- Menu de funcionalidades

> Apenas a área da logo (mesma altura do cabeçalho) **não será rolável**.

### 1 - Início (logo e colapso)

- **Logo da barra lateral:** `/assets/OptmaMenuLogo.webp` (ou similar) ajustada com altura **`h-9.5`** para um visual impactante e legível. 
- **Sem Links Redundantes:** Devem ser removidos atalhos redundantes (como "Admin" ou "Ver Loja") logo abaixo do logotipo para manter um visual clean.
- Ao lado da logo, o ícone `chevron-left` para **colapsar** o menu lateral.
- Quando recolhido, exibir o ícone `menu` para restaurar, juntamente com os ícones dos itens de menu (não dos grupos).  
  *(Referência: `menu-colappsed.png`)*
- Essa área terá a mesma altura do cabeçalho e ficará sempre visível (sem rolagem), expandida ou recolhida.

### 2 - Usuário logado

- **Avatar:** circular, lado esquerdo.
- **Nome:** negrito (ou destaque).
- **Cargo:** abaixo do nome (campo `role` na tabela `store_members`).

#### Pontos importantes

- **Multi‑empresa:** alguns usuários são proprietários ou funcionários de outras empresas.  
  - Autenticação via Supabase.  
  - Atualmente, ao logar, o usuário escolhe onde manter-se logado (`escolher-loja.png`).  
  - *Posteriormente* resolveremos o isolamento de dados (não agora).
- **Avatar (testes):** a página do usuário ainda está em andamento. Usuários de teste:

| Usuário | E-mail | Cargo |
|---------|--------|-------|
| Edu Souza | edu.pixcef@outlook.com | admin |
| Henrique Souza | logmytravel.com@gmail.com | stock_operator |
| Gelinhares SJN | gelinharessaojoao@gmail.com | owner |

### 3 - Menu lateral

Acesso às páginas do aplicativo conforme `docs/MENU-NAVIGATION.md`.  
Cada item de menu possui um ícone específico como identificador visual.

**Quando a barra lateral estiver recolhida:** mostrar apenas o ícone + tooltip com o nome do menu ao passar o mouse (`menu-colappsed.png`).

#### Estrutura e ícones
Vide `docs/MENU-NAVIGATION.md`.


### 4 - Item selecionado

- Fundo esverdeado (padrão **teal** do Tailwind).
- Nome do grupo: mais escuro, em negrito, com leve aumento de fonte para enfatizar o grupo selecionado.

---

## Cabeçalho (item novo)

Fixo no topo da tela, sempre visível.

### 5 - Nome e ícone do item de menu selecionado

- Ícone: cor **Mostarda**.
- Nome: cor **Laranja** (conforme `design_system.md`).
- Fonte: negrito, um pouco maior que as demais (sem exagero).

### 6 - Duração e início do acesso (estatísticas)

- **Acesso em:** início da sessão (mesmo dado do log).
- **Agora:** hora atual.
- **Tempo de acesso:** diferença entre agora e o login.
> *Use fallback se o monitoramento ainda não estiver ativo.*

### 7 - Ícones de ação (esquerda → direita)

| Ícone | Condição | Cor | Tooltip / Obs. |
|-------|----------|-----|----------------|
| `store` | sempre | padrão | "Acessar loja" (exibe slug da loja) |
| `mail-plus` / `mail` | novas mensagens / sem mensagens | Mostarda / Cinza | implementação futura |
| `bell-ring` / `bell` | novos avisos não lidos / sem avisos | Mostarda / Cinza | pedidos, compras, estoque – central futura |
| toggle | claro/escuro | - | design leve e agradável |
| `power` | sempre | Vermelho | logout e encerramento da sessão |

---

## Frame

Área onde os componentes do menu serão renderizados.  
**Somente os componentes mudam** – sem reload da página inteira.

### 8 - Área do frame

- Fundo: cinza bem claro.
- Rolável (scroll lateral se necessário).
- O conteúdo do item vem **abaixo** da barra de acesso rápido (item 9).

### 9 - Barra de acesso rápido e Portal de Ações

- Exibe atalhos para os **outros itens do mesmo grupo** (exclui o item selecionado).
- Exemplos (`acesso-rapido.png` e `acesso-rapido-2.png`):
  - Grupo `Dashboard` com `Painel operacional` ativo → atalhos para `Atividades recentes`, `Alertas`, `Relatórios` (ícones + dicas).
  - Se `Alertas` estiver ativo → atalhos para `Painel operacional`, `Atividades recentes`, `Relatórios`.
  - Mesma lógica para grupos `Produtos`, `Financeiro`, etc.
- **Botão de atualizar:** segue layout existente no dashboard (padronizar). Em componentes com atualizações constantes, o botão fica girando (atualização automática periódica).
- **Portal de Ações Rápidas (`#quick-access-actions-portal`)**: A barra de acesso rápido expõe um container portal para injeção dinâmica de botões no lado direito. Isso permite que botões globais da página (como "+ Novo Produto", "Exportar CSV", "Registrar Ajuste", "Filtros", ou botões de "Voltar" e salvar) sejam inseridos reativamente na barra superior da aplicação.
- **Sem Duplicação de Cabeçalhos**: Para evitar que o frame principal exiba banners e títulos gigantes repetidos, as páginas de conteúdo inseridas no frame devem herdar a prop `withoutHeader={true}` no `PageContainer`.
- **Proibição de Navegadores Locais Agressivos**: Menus com ícones circulares flutuantes gigantes no meio das páginas (ex: `InventoryQuickNav`) foram removidos para evitar a poluição e descentralização das ações. Toda a manipulação deve ocorrer nos cartões ou através do portal da barra de acesso rápido.

### 10 - Botão "Voltar ao topo"

- Aparece **dentro do frame** (não na página inteira) quando o frame tiver rolado um determinado percentual.
- Componentes existentes:
  - `src/components/common/navigation/BackToTopButton.tsx`
  - `src/components/layouts/PublicLayout.tsx` (trecho com `ChevronUp` e fundo teal `#21A896`)
- **Padrão a ser usado:** o do `PublicLayout.tsx` (chevron-up circle teal).

#### Código de referência

```jsx
{/* Main Content */}
<main className="pb-24 relative">
  {showScrollTop && (
    <button
      onClick={scrollToTop}
      className="fixed bottom-24 right-6 md:bottom-28 md:right-8 z-[1000] 
                 bg-[#21A896] hover:bg-[#1a867a] text-white
                 w-12 h-12 md:w-14 md:h-14 rounded-full shadow-lg 
                 flex items-center justify-center
                 transition-all duration-300 transform hover:scale-110
                 focus:outline-none focus:ring-2 focus:ring-[#21A896] focus:ring-offset-2
                 dark:focus:ring-offset-gray-900"
      aria-label="Voltar ao topo"
    >
      <ChevronUp className="w-6 h-6 md:w-7 md:h-7" />
    </button>
  )}
  <Outlet />
</main>

## Detalhes adicionais

### Responsividade

As alterações devem refletir satisfatoriamente em:

- Mobile
- Tablets
- Desktops
- Monitores pequenos

### Fontes

- **Primária:** Candara
- **Fallback:** `'Candara', 'Plus Jakarta Sans', 'Segoe UI', -apple-system, Arial, sans-serif`

### Temas (claro/escuro)

- Ambos os temas devem ficar bem visíveis.
- Revisar itens que atualmente só são visíveis no tema escuro.

### Spinner de carregamento

Ao carregar páginas do menu dentro do frame, usar o spinner conforme `src/pages/private/admin/dashboard/Dashboard.tsx` (linhas 250-261).  
**Imagem de referência:** `load-spinner.png`.

#### Código do spinner

```jsx
if (loading) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#21A896] mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-300 font-candara">
          Carregando dashboard...
        </p>
      </div>
    </div>
  );
}

### Animações (se possível)

- Ícones de sino (`bell-ring`) e envelope (`mail-plus`) devem ter animação suave quando houver novas mensagens/avisos.

### Referência das imagens

| Imagem | Uso |
|--------|-----|
| `.agent\skills\app\design\images\admin-inicial.png` | Página inicial após login |
| `.agent\skills\app\design\images\layout-base.png` | Divisão das áreas (itens 1 a 10) |
| `.agent\skills\app\design\images\menu-colappsed.png` | Menu recolhido com tooltip |
| `.agent\skills\app\design\images\escolher-loja.png` | Seleção de loja após login |
| `.agent\skills\app\design\images\acesso-rapido.png` | Barra de acesso rápido (ex. Dashboard) |
| `.agent\skills\app\design\images\acesso-rapido-2.png` | Barra de acesso rápido (outro exemplo) |
| `.agent\skills\app\design\images\load-spinner.png` | Spinner de carregamento |