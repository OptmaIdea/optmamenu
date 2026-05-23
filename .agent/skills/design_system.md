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
