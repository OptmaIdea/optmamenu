---
name: design_system
description: Diretrizes de Design e Identidade Visual - Optma
---
# Skill: Diretrizes de Design e Identidade Visual - Optma (v5)

## Visão Geral
Esta skill orienta o agente de IA do Antigravity na construção e manutenção de interfaces (HTML/CSS, React, Tailwind) para o ecossistema **Optma** (Optma Menu, Optma Idea).  
Define a paleta de cores oficial da marca, tipografia com fallback moderno para ecossistemas não-Windows, temas de fundo, badges padronizados e um sistema rígido de ícones.

---

## 1. Regras de Tipografia

- **Fonte Principal (Windows):** `Candara` (fonte oficial do logotipo).
- **Fonte Fallback Premium (macOS, iOS, Linux, Android):** `Plus Jakarta Sans` (importada via Google Fonts). Esta fonte geométrica moderna com cortes limpos mantém o impacto visual e sofisticação da marca em ecossistemas que não possuem a fonte Candara pré-instalada.
- **Font Stack Recomendado:**
  ```css
  font-family: 'Candara', 'Plus Jakarta Sans', 'Segoe UI', -apple-system, Arial, sans-serif;
  ```

- **Variações de peso:**
  | Elemento | Peso |
  |----------|------|
  | Títulos (H1-H4) | Bold (700) ou Semibold (600) |
  | Corpo de texto | Regular (400) ou Medium (500) |
  | Labels, badges, botões | Semibold (600) |

---

## 2. Paleta de Cores Oficial

> ⚠️ **Restrições Severas de Cores:**
> - **Não use** azul clássico (`#3B82F6` ou `blue-xxx`), verde puro ou amarelo comum nas interfaces.
> - **Vermelho (`#DC2626`)** deve ser usado **exclusivamente** para alertas críticos, erros fatais, exclusões ou estoque zerado.
> - Todos os totalizadores, cards gerais de faturamento e resumos devem usar o **Roxo Premium (`#7B2D8E`)** no lugar do azul.

### Cores da Marca (OptmaIdea + OptmaMenu)
| Nome | Uso | HEX | Classe CSS sugerida (Tailwind v4) |
|------|-----|-----|-----------------------------------|
| **Secondary/Teal** | Verde-água característico do menu. Usado para status "ativo", "sucesso", "concluído", links secundários e hovers. | `#21A896` | `bg-brand-green` / `text-brand-green` |
| **Dark Teal** | Tom mais escuro do verde-água. Usado para estados ativos escuros, hovers profundos e bordas. | `#1A867A` | `bg-brand-dark` / `text-brand-dark` |
| **Primary/Orange**| Laranja vibrante oficial. Usado para botões principais (CTA), botões de finalização e itens de destaque. | `#F26541` | `bg-brand-orange` / `text-brand-orange` |
| **Light Orange**  | Tom mostarda/laranja suave. Usado para alertas intermediários, atenção e estoque baixo. | `#FBA93C` | `bg-brand-light` / `text-brand-light` |
| **Purple**        | Roxo Premium. Usado para card de totalizadores, resumos gerais e áreas de destaque "premium". | `#7B2D8E` | `bg-purple-600` / `text-purple-600` |
| **Purple Light**  | Roxo claro para fundos e hovers de elementos roxos. | `#B77ED8` | `bg-purple-200` / `text-purple-700` |
| **Warning Red**   | Vermelho de aviso crítico. Usado exclusivamente para erros e remoções. | `#DC2626` | `bg-red-600` / `text-red-600` |

### Cores Neutras (Interface)
| Uso | Cor | HEX |
|------|------|------|
| **Background Claro** | Off-white aconchegante | `#F8F6F2` |
| **Surface/Card** | Branco puro para contraste | `#FFFFFF` |
| **Text Primary** | Cinza escuro quente | `#2D2A26` |
| **Text Secondary** | Cinza médio quente | `#6B6258` |
| **Border/Divider** | Cinza sutil translúcido | `rgba(107, 98, 88, 0.1)` |

---

## 3. Badges e Status Padronizados

Para manter a consistência, todos os status de tabelas, cartões e badges devem seguir exatamente esta regra de cores e ícones:

| Status/Significado | Cor de Fundo | Cor do Texto | Ícone Recomendado (Lucide) |
|--------------------|--------------|--------------|----------------------------|
| **Total / Geral / Faturamento** | Roxo (`#7B2D8E`) | Branco (`#FFFFFF`) | `BarChart3` ou `TrendingUp` |
| **Sucesso / Ativo / Pago** | Verde-água (`#21A896`) | Branco (`#FFFFFF`) | `CheckCircle2` |
| **Pendente / Em Preparo / Atenção** | Laranja (`#F26541`) | Branco (`#FFFFFF`) | `Clock` |
| **Estoque Baixo / Rascunho** | Mostarda (`#FBA93C`) | Cinza Escuro (`#2D2A26`) | `AlertTriangle` |
| **Cancelado / Descontinuado / Neutro** | Cinza Quente (`#6B6258`) | Branco (`#FFFFFF`) | `XCircle` ou `Archive` |
| **Crítico / Erro / Estoque Zerado** | Vermelho (`#DC2626`) | Branco (`#FFFFFF`) | `Skull` ou `AlertOctagon` |

---

## 4. 🎯 Sistema de Ícones (Lucide React)

> **Regra de Ouro:** Não repita ícones para conceitos diferentes. Um ícone deve representar apenas uma ação/tabela na interface.

### Navegação do Painel
* **Dashboard principal**: `LayoutDashboard`
* **Vendas / Comercial**: `Store`
* **Produtos / Estoque**: `Package`
* **Financeiro**: `DollarSign`
* **Configurações**: `Settings`
* **Suporte / Ajuda**: `LifeBuoy`

### Comercial (Submenus)
* **Pedidos**: `ShoppingCart`
* **Clientes**: `Users`
* **Fidelidade**: `Star` (ou `Crown` para fidelidade avançada)
* **Canais de Venda**: `Smartphone`
* **Métodos de Pagamento**: `CreditCard`

### Produtos e Estoque
* **Categorias**: `Folders`
* **Estoque por Local**: `Warehouse`
* **Transferências**: `ArrowLeftRight`
* **Fornecedores**: `Building2`
* **Movimentações de Estoque**: `Activity`

---

## 5. Componentes Visuais CSS Padronizados

### Cards Numéricos de Dashboard
```css
.card-numerico {
  background: #FFFFFF;
  border-radius: 16px;
  padding: 1.25rem;
  transition: all 0.2s ease-in-out;
  border-left: 4px solid;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.card-numerico:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

/* Variações de borda lateral conforme a paleta */
.card-numerico.total { border-left-color: #7B2D8E; } /* Roxo */
.card-numerico.ativo { border-left-color: #21A896; } /* Verde-água */
.card-numerico.pendente { border-left-color: #F26541; } /* Laranja */
.card-numerico.alerta { border-left-color: #FBA93C; } /* Mostarda */
.card-numerico.critico { border-left-color: #DC2626; } /* Vermelho */
.card-numerico.inativo { border-left-color: #6B6258; } /* Cinza Quente */
```

---

## 6. Layout Mestre do Painel Administrativo (PrivateLayout)

O layout da área de administração segue uma estrutura unificada e responsiva com as seguintes especificações rígidas:

### 6.1 Barra Lateral (Sidebar)
* **Topo Fixo (73px)**: Conterá a logo (`/assets/OptmaMenuLogo.webp` ou similar) dimensionada com altura **`h-9.5`** para melhor legibilidade, e o botão de colapso (`ChevronLeft` / `Menu`), permanecendo sempre fixo e sem rolagem. 
* **Sem Redundâncias**: Atalhos redundantes ("Admin", "Ver Loja") no topo da sidebar devem ser evitados para reduzir o ruído visual.
* **Fluxo Único Rolável**: Todos os outros elementos (Perfil do usuário logado, Menu de Navegação, Seletor de Loja, Tema/Sair e Copyright) ficam em um único container rolável vertical (`flex-1 overflow-y-auto custom-scrollbar`).
* **Perfil do Usuário**: Exibe o avatar circular e o cargo dinâmico (campo `role` da tabela `store_members` formatado via `formatLayoutRole`) abaixo do nome. Se colapsado, mostra apenas o avatar com tooltip. O perfil não deve ser duplicado no rodapé.
* **Menu Accordion Real**: Ao clicar para abrir um grupo de opções (ex: Dashboard, Comercial, Financeiro, Produtos, Configurações, Suporte), todas as outras seções são fechadas de forma que apenas um grupo fique aberto por vez.
* **Grupo Ativo**: Se o grupo do menu selecionado estiver ativo, o texto deve ser mais escuro, em negrito e com leve aumento de fonte (`text-[13px] font-black text-gray-800 dark:text-gray-200` em vez de `text-xs font-bold text-gray-400`).
* **Item Selecionado**: Ganha fundo verde-água translúcido (`bg-[#21A896]/10 text-[#21A896] border border-[#21A896]/20`).

### 6.2 Cabeçalho Unificado (Header)
* **Altura Fixa (73px)**: Fixo no topo da tela, sempre visível (no desktop e no mobile), sobrepondo-se ao conteúdo.
* **Lado Esquerdo**: Hamburger (para mobile) + Ícone da rota selecionada (cor **Mostarda** `#FBA93C`) + Nome da rota selecionada (cor **Laranja** `#F26541` em negrito).
* **Centro**: Estatísticas de tempo de sessão ("Acesso em: hh:mm:ss", "Agora: hh:mm:ss" e "Tempo: hh:mm:ss" com destaque verde-água no cronômetro decorrido).
* **Lado Direito**:
  * Ícone `store` ("Acessar loja") direcionando para `/s/${storeSlug}` em nova aba.
  * Ícone `mail` (mensagens): cor cinza com indicador se mockado.
  * Ícone `bell` (alertas): cor **Mostarda** (padrão crítico de atenção/exclamação) com efeito de pulse se `attentionCount > 0`, indicando a quantidade de alertas.
  * Alternador de Tema (Sun/Moon).
  * Ícone `power` (logout): cor vermelha.

### 6.3 Barra de Acesso Rápido e Portal de Ações
* Fica posicionada logo abaixo do cabeçalho e acima do conteúdo principal.
* Apresenta atalhos do tipo tags/badges discretos para as **rotas irmãs** (outras rotas do mesmo grupo de menu, ocultando a rota ativa).
* Contém o botão **Atualizar** (`RefreshCw`). Ao ser clicado, dispara o evento customizado `optmamenu.refresh` e anima com rotação o ícone.
* As páginas principais escutam o evento `optmamenu.refresh` para recarregar seus dados de forma transparente sem dar refresh na tela inteira.
* **Portal de Ações Rápidas (`#quick-access-actions-portal`)**: Há um elemento `<div id="quick-access-actions-portal" className="flex items-center gap-2"></div>` do lado direito desta barra. As páginas ativas devem injetar seus botões de ação globais (como "+ Novo Produto", "Exportar CSV", "Registrar Ajuste", etc.) usando React Portal:
  ```tsx
  {mounted && document.getElementById('quick-access-actions-portal') && createPortal(
    <button className="...">Ação</button>,
    document.getElementById('quick-access-actions-portal')!
  )}
  ```

### 6.4 Ocultação de Cabeçalhos e Títulos Duplicados nas Páginas
* Para evitar visual poluído e duplicação de informações com o cabeçalho superior, as páginas internas exibidas no frame principal devem herdar a prop **`withoutHeader={true}`** no componente `<PageContainer>`:
  ```tsx
  <PageContainer title="Título" withoutHeader={true}>
    {/* Conteúdo */}
  </PageContainer>
  ```
* Não utilize componentes locais de navegação com ícones circulares gigantes no meio das páginas (ex: o antigo `InventoryQuickNav`). As ações e navegações devem ser delegadas à barra de acesso rápido e ao portal superior.

---

## 7. Layout e Páginas Públicas (PublicLayout e Páginas Iniciais)

As páginas públicas de entrada no sistema (Landing Page, Login, Cadastro, Termos de Uso e Política de Privacidade) são encapsuladas pelo `PublicLayout` e devem seguir especificações para garantir elegância e consistência visual:

### 7.1 Fundo e Cores Neutras
* **Modo Claro:** Utilizar o fundo off-white aconchegante (`bg-[#F8F6F2]`) com texto principal em cinza escuro quente (`text-[#2D2A26]`). Evitar `bg-gray-50`.
* **Modo Escuro:** O fundo deve ser preto profundo/cinza-escuro premium (`dark:bg-gray-950`) e texto em cinza claro (`dark:text-gray-100`).
* **Cards e Surfaces:** Usar fundo branco no modo claro (`bg-white`) e cinza escuro no modo escuro (`dark:bg-gray-900`) com bordas translúcidas sutis de classe `border-[#6B6258]/10` (no claro) ou `dark:border-gray-800` (no escuro).

### 7.2 Tipografia
* Utilizar a fonte padrão `font-sans` configurada globalmente no Tailwind (com suporte à Candara e fallback para Plus Jakarta Sans).

### 7.3 Elementos Visuais e CTAs
* **Botão CTA Principal:** Sempre que houver um botão de ação primário de destaque (ex: "Começar Agora"), utilizar a classe de utilidade `.button-primary` para aplicar o gradiente vertical e a sombra projetada laranja oficial da marca.
* **Ícones Informativos:** Em seções informativas de funcionalidades, substituir emojis estáticos por ícones da biblioteca Lucide envolvidos em recipientes circulares translúcidos (`w-16 h-16 rounded-full bg-brand-green/10 text-brand-green`).
* **Cards Jurídicos / Informativos:** Usar as classes de estilo `.glass-card` e `.card-hover` para criar cartões sofisticados e responsivos com elevação interativa.


