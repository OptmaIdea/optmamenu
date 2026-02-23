# 📘 Plano de Negócios - OptmaMenu SaaS

**Versão:** 1.0  
**Data:** Fevereiro 2026  
**Status:** Documento de Planejamento Estratégico

---

## 📑 Sumário

1. [Visão Geral do Produto](#1-visão-geral-do-produto)
2. [Modelo de Negócio](#2-modelo-de-negócio)
3. [Módulos do Sistema](#3-módulos-do-sistema)
4. [Gestão de Estoque e Movimentações](#4-gestão-de-estoque-e-movimentações)
5. [Arquitetura Multi-Store](#5-arquitetura-multi-store)
6. [Autenticação e Segurança](#6-autenticação-e-segurança)
7. [Sistema de Permissões (RBAC)](#7-sistema-de-permissões-rbac)
8. [Experiência do Cliente Final](#8-experiência-do-cliente-final)
9. [Marketing e Engajamento](#9-marketing-e-engajamento)
10. [Financeiro](#10-financeiro)
11. [Infraestrutura Técnica](#11-infraestrutura-técnica)
12. [UX/UI e Configurações](#12-uxui-e-configurações)
13. [Roadmap de Implementação](#13-roadmap-de-implementação)
14. [Melhores Práticas e Recomendações](#14-melhores-práticas-e-recomendações)
15. [Painel Admin do SaaS (Super Admin)](#15-painel-admin-do-saas-super-admin)
16. [Exclusão de Contas e Gestão de Dados](#16-exclusão-de-contas-e-gestão-de-dados)
17. [Estratégia Offline/Híbrida](#17-estratégia-offlinehíbrida)
18. [Apêndices](#apêndices)

---

## 1. Visão Geral do Produto

### 1.1 Proposta de Valor

O **OptmaMenu SaaS** é uma plataforma completa de **alavancagem de vendas** para pequenos e médios comerciantes do setor alimentício (sorveterias, lanchonetes, cafés, etc.). 

**Não é apenas um sistema de gestão** — é uma infraestrutura completa que permite ao lojista focar exclusivamente em **atender, entregar e receber**, enquanto o sistema gerencia todo o resto.

### 1.2 Público-Alvo

| Perfil | Características | Necessidades |
|--------|-----------------|--------------|
| **Sorveterias** | 1-3 unidades, 5-20 funcionários | Controle de estoque, pedidos, fidelidade |
| **Lanchonetes** | Bairro, delivery próprio | Cardápio digital, WhatsApp integration |
| **Cafés/Padarias** | Atendimento presencial + delivery | PDV rápido, gestão de mesas |
| **Redes Pequenas** | 3-10 unidades | Transferência entre lojas, relatórios consolidados |

### 1.3 Diferenciais Competitivos

- ✅ **Mobile-first**: Funciona perfeitamente no celular do cliente e do lojista
- ✅ **WhatsApp nativo**: Pedidos e comunicação integrados
- ✅ **QR Code na loja**: Menu digital sem necessidade de app
- ✅ **Marketing embutido**: Campanhas promocionais automatizadas
- ✅ **Multi-loja**: Gerenciamento centralizado de redes
- ✅ **Configurável**: Lojista escolhe o que usa (modelo modular)

---

## 2. Modelo de Negócio

### 2.1 Estrutura de Pricing (Sugestão)

| Plano | Preço/mês | Módulos Incluídos | Limites |
|-------|-----------|-------------------|---------|
| **Starter** | R$ 49-79 | PDV + Estoque Básico + Pedidos WhatsApp | 1 loja, 500 pedidos/mês |
| **Professional** | R$ 99-149 | + Fidelidade + Marketing + Financeiro | 3 lojas, 2000 pedidos/mês |
| **Enterprise** | R$ 199-299 | Todos módulos + API + Suporte prioritário | Lojas ilimitadas |
| **Custom** | Sob consulta | White label, integrações específicas | - |

### 2.2 Módulos Comercializáveis

```
┌─────────────────────────────────────────────────────────────┐
│                    NÚCLEO (obrigatório)                     │
│  • Autenticação • Produtos • Estoque • Pedidos • PDV       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  MÓDULOS OPCIONAIS                          │
├─────────────┬─────────────┬─────────────┬───────────────────┤
│  Fidelidade │  Marketing  │  Financeiro │  Multi-Loja       │
│  • Pontos   │  • SMS      │  • Contas   │  • Transferências │
│  • Rewards  │  • WhatsApp │  • Caixa    │  • Relatórios     │
│  • Tiers    │  • Email    │  • PIX      │  • Centralizado   │
│  • Regras   │  • Push     │  • Cartões  │                   │
├─────────────┼─────────────┼─────────────┼───────────────────┤
│  Analytics  │  Delivery   │  QR Code    │  API/Integrações  │
│  • Dash     │  • Taxas    │  • Menu     │  • Webhooks       │
│  • Relatórios│  • Rotas   │  • Auto-att |  • Zapier         │
└─────────────┴─────────────┴─────────────┴───────────────────┘
```

### 2.3 Estratégia de Adoção

1. **Onboarding gratuito**: 14 dias de teste com todos os módulos
2. **Migração assistida**: Importação de produtos/estoque inicial
3. **Treinamento**: Vídeos tutoriais + documentação por módulo
4. **Suporte**: WhatsApp/Email nos primeiros 30 dias

---

## 3. Módulos do Sistema

### 3.1 Mapa de Módulos

```
OPTMAMENU SAAS
│
├── 🏪 CADASTRO & CONFIGURAÇÃO
│   ├── Dados da Store (nome, CNPJ, endereço, logo, cores)
│   ├── Configurações gerais (moeda, timezone, idioma)
│   ├── Módulos ativados (toggle por módulo)
│   └── Personalização (tema, banners, mensagens)
│
├── 📦 PRODUTOS & ESTOQUE
│   ├── Cadastro de produtos (nome, descrição, preço, imagens)
│   ├── Categorias e subcategorias
│   ├── Controle de estoque (quantidade, reserva, mínimo)
│   ├── Preço de aquisição (histórico)
│   └── Variações (tamanhos, sabores, adicionais)
│
├── 🔄 MOVIMENTAÇÕES
│   ├── Venda (PDV + Pedidos)
│   ├── Compra/Aquisição
│   ├── Transferência entre unidades
│   ├── Transferência interna (setores)
│   ├── Devolução (cliente/fornecedor)
│   ├── Perda (validade, dano, ajuste)
│   └── Zeramento (descontinuação)
│
├── 🛒 PDV & PEDIDOS
│   ├── PDV local (venda balcão)
│   ├── Pedidos online (QR Code/link)
│   ├── Integração WhatsApp
│   ├── Status do pedido (recebido, preparando, pronto, entregue)
│   └── Histórico e reimpressão
│
├── 👥 CLIENTES
│   ├── Cadastro (nome, telefone, email, aniversário)
│   ├── Autenticação SMS/WhatsApp (OTP)
│   ├── Histórico de compras
│   ├── Saldo fidelidade
│   └── Segmentação (aniversariantes, frequentes, inativos)
│
├── 💎 FIDELIDADE
│   ├── Programa de pontos (configuração de regras)
│   ├── Níveis/Tiers (Bronze, Prata, Ouro, etc.)
│   ├── Recompensas (descontos, produtos grátis, brindes)
│   ├── Regras por categoria
│   ├── Pontos manuais (correções)
│   └── Termos legais
│
├── 📢 MARKETING & COMUNICAÇÃO
│   ├── Central de mensagens (SMS, WhatsApp, Email)
│   ├── Campanhas promocionais
│   ├── Mensagens automáticas (aniversário, reativação)
│   ├── Vouchers eletrônicos
│   └── Templates personalizáveis
│
├── 💰 FINANCEIRO
│   ├── Contas a receber (pedidos, fiado)
│   ├── Contas a pagar (fornecedores, despesas)
│   ├── Fluxo de caixa (entradas/saídas)
│   ├── Conciliação (PIX, cartão, dinheiro)
│   ├── Relatórios (DRE simplificado, faturamento)
│   └── Exportação (Excel, PDF)
│
├── 📊 ANALYTICS & RELATÓRIOS
│   ├── Dashboard (vendas, produtos mais vendidos, clientes)
│   ├── Curva ABC de produtos
│   ├── Performance por período
│   ├── Comparativo entre lojas
│   └── Exportação de dados
│
├── 🔐 ADMINISTRAÇÃO & SEGURANÇA
│   ├── Usuários e permissões (RBAC)
│   ├── Logs de auditoria
│   ├── Backup de dados
│   └── Configurações de segurança
│
└── 🏢 MULTI-LOJA (Enterprise)
    ├── Transferência entre unidades
    ├── Relatórios consolidados
    ├── Gestão centralizada de produtos
    └── Padronização de preços/promoções
```

---

## 4. Gestão de Estoque e Movimentações

### 4.1 Tipos de Movimentação

| Tipo | Origem | Destino | Impacto no Estoque | Documento |
|------|--------|---------|-------------------|-----------|
| **Venda** | Estoque principal | Cliente | Baixa | Pedido/NFCE |
| **Compra** | Fornecedor | Estoque principal | Entrada | NF de entrada |
| **Transferência Externa** | Loja A | Loja B | Saída em A, Entrada em B | DTE (Documento de Transferência) |
| **Transferência Interna** | Setor X | Setor Y | Sem mudança no total | DTI |
| **Devolução Entrada** | Cliente | Estoque | Entrada | RMA |
| **Devolução Saída** | Estoque | Fornecedor | Saída | NF de devolução |
| **Perda** | Estoque | Descarte | Baixa | Termo de perda |
| **Zeramento** | Estoque | - | Zera saldo | Termo de descontinuação |

### 4.2 Fluxo de Transferência Entre Lojas

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRANSFERÊNCIA ENTRE LOJAS                    │
└─────────────────────────────────────────────────────────────────┘

FILIAL A (Origem)                          FILIAL B (Destino)
     │                                            │
     │  1. Cria DTE (10 itens)                    │
     │     - Seleciona produtos                   │
     │     - Define valores (aquisição/markup)    │
     │     - Gera documento                       │
     │                                            │
     ├────────────────────────────────────────────►
     │            DTE (PDF/JSON)                  │
     │                                            │
     │  2. Status: "Em trânsito"                  │
     │     - Produtos RESERVADOS                  │
     │     - Não disponíveis para venda           │
     │                                            │
     │                                            │  3. Importa DTE
     │                                            │     - Valida produtos
     │                                            │     - Conferência cega
     │                                            │
     │                                            │  4. Conferência
     │                                            │     - Aceite total
     │                                            │     - Aceite parcial
     │                                            │     - Recusa total
     │                                            │
     │  5. Notificação automática                 │
     │     ←──────────────────────────────────────┤
     │                                            │
     │  6. Confirmação                            │
     │     - Baixa definitiva em A                │
     │     - Libera em B                          │
     │                                            │
     │  7. Cancelamento (se necessário)           │
     │     - Devolução automática                 │
     │     - Estorno em A                         │
     │                                            │

┌─────────────────────────────────────────────────────────────────┐
│                    ESTADOS DO DTE                               │
│  RASCUNHO → ENVIADO → EM TRÂNSITO → RECEBIDO/CONCLUÍDO         │
│                          ↓                                      │
│                    CANCELADO/DEVOLVIDO                          │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Problema: IDs Diferentes entre Lojas

**Cenário:** Matriz usa `k37unsao8y734` para Picolé de Chocolate, Filial usa `867bhasd789ty3`

#### Solução Proposta: **Catálogo Central de Produtos**

```sql
-- Tabela central de produtos (global)
CREATE TABLE product_catalog (
  id UUID PRIMARY KEY,           -- ID único global
  sku_global VARCHAR(50),        -- SKU padrão da rede
  nome_padrao VARCHAR(200),
  descricao TEXT,
  categoria_global_id UUID,
  created_at TIMESTAMPTZ
);

-- Tabela de produtos por loja (local)
CREATE TABLE store_products (
  id UUID PRIMARY KEY,           -- ID local da loja
  store_id UUID REFERENCES stores(id),
  product_catalog_id UUID REFERENCES product_catalog(id),
  sku_local VARCHAR(50),
  nome_local VARCHAR(200),       -- Pode ser personalizado
  preco_venda DECIMAL,
  preco_aquisicao DECIMAL,
  estoque_atual INTEGER,
  ativo BOOLEAN
);

-- Tabela de equivalência (mapeamento)
CREATE TABLE product_equivalence (
  id UUID PRIMARY KEY,
  store_id_a UUID,
  store_id_b UUID,
  product_id_a UUID,
  product_id_b UUID,
  UNIQUE(store_id_a, store_id_b, product_id_a)
);
```

#### Estratégia de Implementação

**Opção A: Catálogo Global (Recomendada)**
- Todos os produtos vêm de um catálogo central
- Cada loja tem seus próprios preços e estoque
- Transferência usa o `product_catalog_id` como referência
- Vantagem: Consistência, relatórios consolidados fáceis

**Opção B: Mapeamento Inteligente**
- Usa SKU ou código de barras como chave de ligação
- Sistema sugere matches baseados em similaridade
- Usuário confirma o mapeamento
- Vantagem: Mais flexível para lojas já existentes

**Opção C: Híbrida**
- Novos produtos: catálogo global obrigatório
- Produtos existentes: migração gradual com mapeamento
- Vantagem: Transição suave

### 4.4 Campo de Preço de Aquisição

**Estrutura sugerida:**

```sql
CREATE TABLE product_acquisition_costs (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  store_id UUID REFERENCES stores(id),
  valor_aquisicao DECIMAL(10,2),
  fornecedor_id UUID,
  data_aquisicao DATE,
  nota_fiscal VARCHAR(50),
  quantidade INTEGER,
  created_at TIMESTAMPTZ
);

-- Na tabela products, adicionar:
ALTER TABLE products ADD COLUMN ultimo_preco_aquisicao DECIMAL(10,2);
ALTER TABLE products ADD COLUMN preco_aquisicao_medio DECIMAL(10,2);
```

**Regra de uso na transferência:**
1. Usuário da matriz escolhe qual custo usar:
   - Último preço de aquisição
   - Preço médio
   - Preço personalizado + markup (%)
   - Preço personalizado + valor fixo

2. O valor escolhido compõe o custo na loja de destino

### 4.5 Categorias e Preços

**Problema atual:** Categoria usa apenas preço de atacado, sem opção de preço único.

**Solução:**

```typescript
interface PricingStrategy {
  type: 'unico' | 'atacado' | 'hibrido';
  preco_unico?: number;
  tabela_atacado?: {
    quantidade_minima: number;
    preco: number;
  }[];
}

// Na tabela categories:
ALTER TABLE categories ADD COLUMN pricing_strategy JSONB;
-- Exemplo: {"type": "atacado", "tabela": [{"qtd_min": 1, "preco": 5.00}]}
```

**Recomendação:** 
- Se o lojista quer preço único, configurar tabela de atacado com `quantidade_minima: 1`
- Manter apenas um campo `preco_base` e usar a lógica de atacado como única opção
- Simplificar a UI: "Preço Unitário" e "Tabela de Atacado (opcional)"

### 4.6 Botões de Estoque: Manter ou Remover?

**Análise:**

| Abordagem | Prós | Contras |
|-----------|------|---------|
| **Botões diretos no estoque** | Rápido para ajustes simples | Risco de erro, sem rastreio, mistura operação com gestão |
| **Área específica de movimentação** | Rastreio completo, fluxos definidos, auditoria | Mais cliques, curva de aprendizado |
| **Híbrida (recomendada)** | Flexibilidade + controle | Complexidade de implementação |

**Recomendação: Abordagem Híbrida**

```
┌─────────────────────────────────────────────────────────────┐
│  ESTOQUE - Visão Geral                                      │
├─────────────────────────────────────────────────────────────┤
│  Produto: Picolé de Chocolate    Saldo: 150 un.             │
│                                                             │
│  [📝 Ajuste Rápido]  [🔄 Movimentação Completa]             │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  Histórico Recente:                                         │
│  • 10/02 - Venda #1234 (-20)                                │
│  • 09/02 - Transferência Loja B (-50)                       │
│  • 08/02 - Compra NF 456 (+200)                             │
└─────────────────────────────────────────────────────────────┘

MODAL "Ajuste Rápido":
┌─────────────────────────────────────────────────────────────┐
│  Ajuste de Estoque - Picolé de Chocolate                    │
├─────────────────────────────────────────────────────────────┤
│  Tipo: ○ Adicionar  ○ Remover                               │
│  Quantidade: [___]                                          │
│  Motivo: [Selecionar ▼] (Perda, Ajuste, Outro)              │
│  Observação: [_________________________________]            │
│                                                             │
│  [Cancelar]  [Confirmar]                                    │
└─────────────────────────────────────────────────────────────┘
→ Gera registro de movimentação tipo "Ajuste"
→ Exige justificativa
→ Vai para o log de auditoria
```

**Conclusão:** Manter botões de ação rápida, mas:
- Sempre gerar registro de movimentação
- Exigir motivo/justificativa
- Limitar por permissão (apenas gerentes)
- Direcionar movimentações complexas para a área específica

---

## 5. Arquitetura Multi-Store

### 5.1 Modelo de Isolamento

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Store A    │  │  Store B    │  │  Store C    │         │
│  │  (Tenant 1) │  │  (Tenant 2) │  │  (Tenant 3) │         │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤         │
│  │ products    │  │ products    │  │ products    │         │
│  │ orders      │  │ orders      │  │ orders      │         │
│  │ customers   │  │ customers   │  │ customers   │         │
│  │ ...         │  │ ...         │  │ ...         │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  Row Level Security (RLS):                                  │
│  - Cada store vê apenas seus dados                         │
│  - Exceções: catálogo global, transferências               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Estrutura de Tabelas com Store Isolation

```sql
-- Todas as tabelas de dados têm store_id
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  nome VARCHAR(200),
  -- ... outros campos
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policy exemplo
CREATE POLICY "Store isolation on products"
ON products FOR ALL
USING (store_id = current_setting('app.current_store')::UUID);

-- Exceto para tabelas globais
CREATE TABLE product_catalog (
  id UUID PRIMARY KEY,
  -- Dados compartilhados entre todas as stores
);
```

### 5.3 Transferência entre Unidades

**Fluxo detalhado:**

```
PASSO 1: Criação do DTE (Loja A)
┌─────────────────────────────────────────────────────────────┐
│  Nova Transferência                                         │
├─────────────────────────────────────────────────────────────┤
│  Destino: [Loja B ▼]                                        │
│                                                             │
│  Produtos:                                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Produto              │ Qtd │ Valor Unit. │ Subtotal │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Picolé Chocolate     │ 50  │ [R$ 2,50]   │ R$ 125   │   │
│  │ Picolé Morango       │ 30  │ [R$ 2,50]   │ R$ 75    │   │
│  │ ...                  │ ... │ ...         │ ...      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Origem do Preço:                                           │
│  ○ Último custo (R$ 2,30)                                   │
│  ● Custo médio (R$ 2,50)                                    │
│  ○ Personalizado: R$ [____]                                 │
│  ○ Custo + Markup: [___]%                                   │
│                                                             │
│  [Salvar Rascunho]  [Enviar para Loja B]                    │
└─────────────────────────────────────────────────────────────┘

PASSO 2: Notificação (Loja B recebe)
┌─────────────────────────────────────────────────────────────┐
│  🔔 Nova Transferência Recebida                             │
│  De: Loja A                                                 │
│  Itens: 10 produtos                                         │
│  Valor total: R$ 500,00                                     │
│                                                             │
│  [Ver Detalhes]  [Aguardando Conferência]                   │
└─────────────────────────────────────────────────────────────┘

PASSO 3: Conferência Cega (Loja B)
┌─────────────────────────────────────────────────────────────┐
│  Conferência de Recebimento                                 │
├─────────────────────────────────────────────────────────────┤
│  Produto: Picolé de Chocolate                               │
│  Quantidade no DTE: 50                                      │
│                                                             │
│  Quantidade Recebida: [___]  ← Usuário digita (cego)        │
│                                                             │
│  Status: ○ Recebido completo  ○ Parcial  ○ Não recebido     │
│  Observação: [_________________________________]            │
│                                                             │
│  [Próximo Produto]                                          │
└─────────────────────────────────────────────────────────────┘

PASSO 4: Finalização
┌─────────────────────────────────────────────────────────────┐
│  Resumo da Conferência                                      │
├─────────────────────────────────────────────────────────────┤
│  Recebido: 8/10 itens                                       │
│  Parcial: 1 item (30/50)                                    │
│  Não recebido: 1 item                                       │
│                                                             │
│  Ações:                                                     │
│  ○ Aceitar e concluir                                       │
│  ○ Aceitar parcial (baixa do recebido)                      │
│  ○ Recusar e devolver                                       │
│                                                             │
│  [Confirmar]                                                │
└─────────────────────────────────────────────────────────────┘

PASSO 5: Atualização Automática
→ Loja A: Notificação de recebimento
→ Loja A: Baixa definitiva (ou estorno se devolução)
→ Loja B: Entrada no estoque
→ Sistema: Atualiza status do DTE
```

### 5.4 Devolução Pós-Recebimento

**Cenário:** Loja B recebeu, mas precisa devolver após 3 dias.

```
┌─────────────────────────────────────────────────────────────┐
│  Solicitação de Devolução                                   │
├─────────────────────────────────────────────────────────────┤
│  DTE Original: #DTE-2026-0042                               │
│  Data recebimento: 05/02/2026                               │
│                                                             │
│  Produtos para devolução:                                   │
│  ☑ Picolé Chocolate (20 un.)                                │
│  ☐ Picolé Morango (30 un.)                                  │
│                                                             │
│  Motivo:                                                    │
│  ○ Qualidade/Validade                                       │
│  ○ Excesso de estoque                                       │
│  ○ Erro no recebimento                                      │
│  ○ Outro: [_____________________]                           │
│                                                             │
│  [Enviar Solicitação]                                       │
└─────────────────────────────────────────────────────────────┘

→ Loja A recebe notificação
→ Loja A aprova/rejeita devolução
→ Se aprovada: Gera DTE reverso
→ Status atualizado em ambas as lojas
```

### 5.5 Transferência Interna (Intra-Store)

```
┌─────────────────────────────────────────────────────────────┐
│  Transferência Interna                                      │
├─────────────────────────────────────────────────────────────┤
│  Store: Loja Matriz                                         │
│                                                             │
│  De: [Armário A - Estoque Frio ▼]                           │
│  Para: [Balcão C - Frente de Loja ▼]                        │
│                                                             │
│  Produtos:                                                  │
│  • Picolé Chocolate: [50] unidades                          │
│  • Picolé Morango: [30] unidades                            │
│                                                             │
│  [Confirmar Transferência]                                  │
└─────────────────────────────────────────────────────────────┘

→ Não altera estoque total da loja
→ Atualiza localização dos produtos
→ Útil para controle interno e inventário
```

---

## 6. Autenticação e Segurança

### 6.1 Tipos de Usuários

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTENTICAÇÃO                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐      ┌─────────────────────┐      │
│  │   USUÁRIO ADMIN     │      │   CLIENTE FINAL     │      │
│  │   (Lojista/Staff)   │      │   (Consumidor)      │      │
│  ├─────────────────────┤      ├─────────────────────┤      │
│  │ Email + Senha       │      │ Telefone + OTP      │      │
│  │ (Supabase Auth)     │      │ (SMS/WhatsApp)      │      │
│  │                     │      │                     │      │
│  │ → Acesso ao Painel  │      │ → Acesso ao Menu    │      │
│  │ → Gestão completa   │      │ → Fazer pedidos     │      │
│  │ → Permissões RBAC   │      │ → Histórico         │      │
│  └─────────────────────┘      └─────────────────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Autenticação de Clientes (OTP)

**Fluxo recomendado:**

```
1. Cliente insere telefone: (11) 98765-4321
                    ↓
2. Sistema valida formato
                    ↓
3. Gera token 6 dígitos (aleatório)
                    ↓
4. Envia via SMS e/ou WhatsApp
   • Token: 847293
   • Validade: 15 minutos
   • Tentativas: 3
                    ↓
5. Cliente digita token
                    ↓
6. Validação:
   • Sucesso → Cria/Atualiza sessão
   • Falha → Decrementa tentativas
                    ↓
7. Sessão ativa (configurável: 30 dias)
```

**Implementação Técnica:**

```typescript
// Estrutura do OTP
interface OTPRecord {
  id: UUID;
  phone: string;
  code: string;        // Hash do código
  expires_at: Date;    // 15 minutos
  attempts: number;    // Máximo 3
  used: boolean;
  created_at: Date;
}

// Tabela no Supabase
CREATE TABLE otp_tokens (
  id UUID PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER DEFAULT 0,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Limpeza automática (cron job ou Edge Function)
DELETE FROM otp_tokens 
WHERE expires_at < NOW() OR used = TRUE;
```

**Melhores Práticas:**

| Prática | Implementação |
|---------|---------------|
| **Rate limiting** | Máx 3 tokens/hora por telefone |
| **Token único** | Invalidar tokens anteriores ao gerar novo |
| **Hash** | Nunca armazenar código em texto puro |
| **Validade** | 15 minutos (configurável) |
| **Tentativas** | Máx 3 tentativas por token |
| **Fallback** | Se SMS falhar, oferecer WhatsApp |
| **Log** | Registrar todas as tentativas (segurança) |

### 6.3 Integração com OTP Existente

Você mencionou ter um complemento para OTP SMS. Estrutura sugerida:

```typescript
// services/otpService.ts
interface OTPProvider {
  send(phone: string, code: string): Promise<boolean>;
  validate(phone: string, code: string): Promise<boolean>;
}

class SMSComplementProvider implements OTPProvider {
  async send(phone: string, code: string): Promise<boolean> {
    // Integração com seu complemento existente
    const response = await fetch('SEU_ENDPOINT_OTP', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code })
    });
    return response.ok;
  }
  
  async validate(phone: string, code: string): Promise<boolean> {
    // Validação via seu complemento
  }
}

// Fallback para WhatsApp se SMS falhar
class WhatsAppProvider implements OTPProvider {
  async send(phone: string, code: string): Promise<boolean> {
    // Integração com API do WhatsApp (Twilio, Z-API, etc.)
  }
}
```

### 6.4 Sessão vs. Logout

**Distinção importante:**

```
┌─────────────────────────────────────────────────────────────┐
│  "Sair" vs "Encerrar Sessão"                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SAIR (Logout completo)                                     │
│  • Encerra conexão com banco de dados                       │
│  • Limpa sessão do Supabase Auth                            │
│  • Redireciona para login                                   │
│  • Necessário para trocar de conta                          │
│                                                             │
│  ENCERRAR SESSÃO (Logout do usuário)                        │
│  • Mantém conexão com banco (app continua aberto)           │
│  • Limpa apenas o usuário logado (RBAC)                     │
│  • Volta para tela de seleção de usuário                    │
│  • Útil para troca de operador no mesmo caixa              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Implementação:**

```typescript
// store/authStore.ts
interface AuthState {
  // Sessão Supabase (conexão com DB)
  supabaseSession: Session | null;
  
  // Usuário logado (permissões)
  currentUser: User | null;
  
  // Ações
  logout: () => Promise<void>;           // Sair completamente
  switchUser: () => void;                 // Encerrar sessão do usuário
}
```

---

## 7. Sistema de Permissões (RBAC)

### 7.1 Estrutura de Roles

```
┌─────────────────────────────────────────────────────────────┐
│                    HIERARQUIA DE ROLES                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐                                            │
│  │   OWNER     │  Dono da store                            │
│  │             │  → Acesso total, incluindo financeiro      │
│  └──────┬──────┘                                            │
│         │                                                   │
│  ┌──────▼──────┐                                            │
│  │   ADMIN     │  Gerente                                  │
│  │             │  → Quase total, exceto configurações da    │
│  │             │    conta e exclusão de dados críticos      │
│  └──────┬──────┘                                            │
│         │                                                   │
│  ┌──────▼──────┐                                            │
│  │  MANAGER    │  Supervisor                               │
│  │             │  → Operacional completo, relatórios        │
│  └──────┬──────┘                                            │
│         │                                                   │
│  ┌──────▼──────┐                                            │
│  │ ATTENDANT   │  Atendente/Caixa                          │
│  │             │  → PDV, pedidos, consulta de estoque       │
│  └──────┬──────┘                                            │
│         │                                                   │
│  ┌──────▼──────┐                                            │
│  │  VIEWER     │  Apenas leitura                           │
│  │             │  → Consultas, relatórios básicos           │
│  └─────────────┘                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Matriz de Permissões

| Funcionalidade | Owner | Admin | Manager | Attendant | Viewer |
|----------------|:-----:|:-----:|:-------:|:---------:|:------:|
| **Dashboard** | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| **Produtos (CRUD)** | ✅ | ✅ | ✅ | ❌ | 👁️ |
| **Estoque (ajuste)** | ✅ | ✅ | ✅ | ⚠️ | 👁️ |
| **PDV/Vendas** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Pedidos** | ✅ | ✅ | ✅ | ✅ | 👁️ |
| **Clientes (CRUD)** | ✅ | ✅ | ✅ | ⚠️ | 👁️ |
| **Fidelidade** | ✅ | ✅ | ✅ | ❌ | 👁️ |
| **Marketing** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Financeiro** | ✅ | ✅ | ⚠️ | ❌ | ❌ |
| **Configurações** | ✅ | ⚠️ | ❌ | ❌ | ❌ |
| **Usuários** | ✅ | ⚠️ | ❌ | ❌ | ❌ |
| **Transferências** | ✅ | ✅ | ✅ | ❌ | 👁️ |
| **Logs/Auditoria** | ✅ | ✅ | ⚠️ | ❌ | ❌ |

**Legenda:**
- ✅ = Acesso completo
- ⚠️ = Acesso limitado (ex: só consulta, só próprio)
- 👁️ = Somente leitura
- ❌ = Sem acesso

### 7.3 Implementação no Supabase

```sql
-- Tabela de roles
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'manager', 'attendant', 'viewer');

-- Tabela de usuários da store
CREATE TABLE store_users (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  auth_user_id UUID REFERENCES auth.users(id),
  role user_role NOT NULL,
  nome VARCHAR(200),
  email VARCHAR(255),
  phone VARCHAR(20),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de permissões granulares (opcional, para controle fino)
CREATE TABLE permissions (
  id UUID PRIMARY KEY,
  role user_role,
  resource VARCHAR(100),  -- ex: 'products', 'orders', 'finance'
  action VARCHAR(50),     -- ex: 'create', 'read', 'update', 'delete'
  UNIQUE(role, resource, action)
);

-- RLS Policy exemplo
CREATE POLICY "Users can only see their store data"
ON store_users FOR SELECT
USING (
  store_id IN (
    SELECT store_id FROM store_users 
    WHERE auth_user_id = auth.uid()
  )
);
```

### 7.4 Logs de Auditoria

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  user_id UUID REFERENCES store_users(id),
  action VARCHAR(100),      -- ex: 'product.created', 'stock.adjusted'
  resource_type VARCHAR(50),
  resource_id UUID,
  old_value JSONB,          -- Estado anterior (para update/delete)
  new_value JSONB,          -- Novo estado (para create/update)
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_audit_logs_store ON audit_logs(store_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

**UI de Logs:**

```
┌─────────────────────────────────────────────────────────────┐
│  Logs de Auditoria                                          │
├─────────────────────────────────────────────────────────────┤
│  Filtros:                                                   │
│  Período: [01/02/2026] até [20/02/2026]                     │
│  Usuário: [Todos ▼]                                         │
│  Ação: [Todas ▼]                                            │
│  Recurso: [Todos ▼]                                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Data/Hora     │ Usuário    │ Ação         │ Detalhe │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ 20/02 14:32   │ João (Adm) │ Estoque +50  │ Picolé  │   │
│  │ 20/02 13:15   │ Maria (Cx) │ Venda #1234  │ R$ 45   │   │
│  │ 20/02 11:00   │ Pedro (Ger)│ Transferência│ Loja B  │   │
│  │ ...           │ ...        │ ...          │ ...     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Exportar CSV] [Exportar PDF]                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Experiência do Cliente Final

### 8.1 Template da Loja do Cliente

**Inspiração:** Mercado Livre / Shopee simplificado

```
┌─────────────────────────────────────────────────────────────┐
│                    CABEÇALHO                                │
├─────────────────────────────────────────────────────────────┤
│  [LOGO]  Sorveteria Doce Sabor                               │
│          ⭐ 4.8 (234 avaliações) • 30-45 min                │
│                                                             │
│  [🔍 Buscar produtos...]              [🛒 2] [👤 Entrar]    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    BANNERS (Carousel)                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🍦 PROMUÇÃO DO DIA                                 │   │
│  │  2 Picolés pelo preço de 1                          │   │
│  │  Só hoje!                                           │   │
│  │  [Peça Agora]                                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  CATEGORIAS                                                 │
├─────────────────────────────────────────────────────────────┤
│  [🍦 Picolés]  [🍨 Cremes]  [🥤 Bebidas]  [🍫 Chocolates]  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  MAIS VENDIDOS                                              │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  IMG     │  │  IMG     │  │  IMG     │  │  IMG     │   │
│  │ Chocolate│  │ Morango  │  │ Limão    │  │ Creme    │   │
│  │ R$ 5,00  │  │ R$ 5,00  │  │ R$ 5,00  │  │ R$ 6,00  │   │
│  │ [Add]    │  │ [Add]    │  │ [Add]    │  │ [Add]    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ANIVERSÁRIO DO MÊS 🎉                                      │
├─────────────────────────────────────────────────────────────┤
│  Faça seu pedido e ganhe um picolé grátis!                  │
│  Válida para aniversariantes do mês                         │
│  [Ver regulamento]                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    RODAPÉ                                   │
├─────────────────────────────────────────────────────────────┤
│  📍 Rua das Flores, 123 - Centro                            │
│  📞 (11) 98765-4321                                         │
│  ⏰ Seg-Sáb: 10h às 22h • Dom: 14h às 20h                   │
│                                                             │
│  [Termos] [Privacidade] [Política de Entrega]               │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Pedido com ou sem Login

**Fluxo recomendado:**

```
┌─────────────────────────────────────────────────────────────┐
│  CARRINHO                                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Opção 1: Continuar sem login                               │
│  • Preencher dados básicos (nome, telefone, endereço)       │
│  • Receber atualizações por SMS                             │
│  • Não acumula pontos fidelidade                            │
│                                                             │
│  Opção 2: Fazer login / Criar conta                         │
│  • Dados salvos automaticicamente                           │
│  • Acumula pontos fidelidade                                │
│  • Histórico de pedidos                                     │
│  • Receber ofertas exclusivas                               │
│                                                             │
│  [Continuar sem login]  [Entrar / Criar conta]              │
└─────────────────────────────────────────────────────────────┘
```

**Vantagens:**
- Reduz atrito para primeira compra
- Captura cliente mesmo sem cadastro
- Incentivo para criar conta (fidelidade)

### 8.3 Configurações de Pagamento

```
┌─────────────────────────────────────────────────────────────┐
│  Configurar Meios de Pagamento                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ☑ PIX                                                      │
│     Chave: [_________________________]                      │
│     Nome: [___________________________]                     │
│                                                             │
│  ☑ Cartão de Crédito                                       │
│     Maquininha: [Stripe ▼]                                 │
│     Parcelamento: [3x sem juros ▼]                         │
│                                                             │
│  ☑ Cartão de Débito                                        │
│     Aceitar no local                                       │
│                                                             │
│  ☑ Dinheiro                                                │
│     Precisa de troco? [Sim/Não]                            │
│                                                             │
│  ☑ Vale Refeição                                           │
│     Aceitar: [VR ▼] [Sodexo ▼] [Alelo ▼]                   │
│                                                             │
│  [Salvar Configurações]                                     │
└─────────────────────────────────────────────────────────────┘
```

### 8.4 Configurações de Entrega (Delivery)

```
┌─────────────────────────────────────────────────────────────┐
│  Configurar Entrega                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📍 Raio de Entrega                                         │
│     [Mapa interativo]                                       │
│     Raio: [5] km                                            │
│                                                             │
│  💰 Taxa de Entrega                                         │
│  ○ Valor fixo: R$ [5,00]                                    │
│  ● Por distância: R$ [2,00] + R$ [1,50]/km                  │
│  ○ Por CEP: [Configurar tabela]                             │
│  ○ Grátis acima de: R$ [50,00]                              │
│                                                             │
│  🚀 Tempo Estimado                                          │
│     [30-45] minutos                                         │
│                                                             │
│  🛵 Entregadores Próprios                                   │
│     Quantidade: [3]                                         │
│                                                             │
│  ☑ Permitir retirada no local                              │
│                                                             │
│  [Salvar Configurações]                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Marketing e Engajamento

### 9.1 Central de Mensagens

```
┌─────────────────────────────────────────────────────────────┐
│  Central de Mensagens                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [📝 Nova Campanha]  [📊 Relatórios]  [⚙️ Configurações]   │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  Campanhas Ativas:                                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🎂 Aniversariantes do Mês                           │   │
│  │ Status: ● Agendada • Envio: 25/02/2026              │   │
│  │ Público: 45 clientes                                │   │
│  │ Canal: WhatsApp + SMS                               │   │
│  │ [Editar] [Cancelar]                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🍦 Promoção Picolés                                 │   │
│  │ Status: ○ Concluída • Envio: 15/02/2026             │   │
│  │ Público: 230 clientes                               │   │
│  │ Canal: WhatsApp                                     │   │
│  │ Taxa abertura: 67% • Conversão: 23%                 │   │
│  │ [Ver Relatório] [Duplicar]                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Criador de Campanhas

```
┌─────────────────────────────────────────────────────────────┐
│  Nova Campanha                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Tipo de Campanha                                        │
│     ○ Aniversário                                           │
│     ○ Promoção                                              │
│     ○ Reativação (inativos)                                 │
│     ○ Personalizada                                         │
│                                                             │
│  2. Público-Alvo                                            │
│     [Filtros]                                               │
│     • Aniversariantes: [Mês ▼] [Quinzena ▼] [Semana ▼] [Dia▼]│
│     • Últimas compras: [30] dias                            │
│     • Gasto mínimo: R$ [___]                                │
│     • Categoria favorita: [___]                             │
│     • Segmento: [Todos ▼]                                   │
│                                                             │
│     Preview: ~45 clientes serão atingidos                    │
│                                                             │
│  3. Conteúdo da Mensagem                                    │
│     Canal: ☑ WhatsApp ☐ SMS ☐ Email                         │
│                                                             │
│     Imagem (opcional):                                      │
│     [📁 Upload] ou arraste aqui                             │
│                                                             │
│     Título: [🎉 Hoje é seu dia especial!]                   │
│                                                             │
│     Mensagem:                                               │
│     [Feliz aniversário, {nome}! 🎂                          │
│      Por mais um ano de vida, você ganhou                   │
│      1 picolé de limão grátis!                              │
│      Passe aqui na loja e ganhe também                      │
│      10% OFF em qualquer compra acima de R$ 20,00.          │
│      Válido até {data_validade}.                            │
│      Te esperamos! 🍦]                                      │
│                                                             │
│     Variáveis disponíveis: {nome}, {data_validade}, ...     │
│                                                             │
│  4. Agendamento                                             │
│     ○ Enviar agora                                          │
│     ● Agendar para: [25/02/2026] às [10:00]                 │
│                                                             │
│  5. Revisão                                                 │
│     Preview da mensagem no WhatsApp                         │
│     ┌─────────────────────────────────────────────────┐    │
│     │ Doce Sabor                                      │    │
│     │ 🎉 Hoje é seu dia especial!                     │    │
│     │                                                 │    │
│     │ Feliz aniversário, Maria! 🎂                    │    │
│     │ ...                                             │    │
│     └─────────────────────────────────────────────────┘    │
│                                                             │
│  [Salvar Rascunho]  [Agendar Campanha]                      │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 Vouchers Eletrônicos

```
┌─────────────────────────────────────────────────────────────┐
│  Criar Voucher                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tipo: ○ Desconto (%)  ● Valor Fixo  ○ Produto Grátis      │
│                                                             │
│  Valor: [R$ 10,00]                                          │
│  ou Produto: [Picolé de Limão ▼]                            │
│                                                             │
│  Código: [AUTO-GERAR] [Personalizado: _____]                │
│                                                             │
│  Validade: [___] dias a partir da emissão                   │
│  ou Até: [__/__/____]                                       │
│                                                             │
│  Condições:                                                 │
│  • Compra mínima: R$ [___] (opcional)                       │
│  • Produtos elegíveis: [Todos ▼]                            │
│  • Uso único: ☑                                             │
│  • Acumulável: ☐                                            │
│                                                             │
│  Design (opcional):                                         │
│  [📁 Upload de imagem ou usar template]                     │
│                                                             │
│  [Criar Voucher]                                            │
└─────────────────────────────────────────────────────────────┘

Voucher gerado:
┌─────────────────────────────────────────────────────────────┐
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓    │
│  ┃  🍦 DOCE SABOR                                     ┃    │
│  ┃  VOUCHER PRESENTE                                  ┃    │
│  ┃                                                    ┃    │
│  ┃  R$ 10,00 DE DESCONTO                              ┃    │
│  ┃  Código: ANIV-MARIA-2026                           ┃    │
│  ┃  Válido até: 25/03/2026                            ┃    │
│  ┃                                                    ┃    │
│  ┃  [|||||||||||||||||||] Código de barras            ┃    │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛    │
└─────────────────────────────────────────────────────────────┘
```

### 9.4 Lógica de Fidelidade (Revisão)

**Pontos de atenção:**

1. **Regras de Pontuação:**
   - Por valor gasto (R$ 1 = 1 ponto)
   - Por produto (categorias específicas)
   - Bônus por período promocional

2. **Validade dos Pontos:**
   - Configurar expiração (ex: 12 meses)
   - Notificação antes de expirar
   - Regra FIFO (primeiro que entra, primeiro que sai)

3. **Resgate de Recompensas:**
   - Limite de resgate por período
   - Combinação com outras promoções
   - Estorno em caso de cancelamento

4. **Níveis/Tiers:**
   - Progressão automática
   - Benefícios por nível
   - Validade do status (anual?)

**Sugestão de melhoria:**

```typescript
interface LoyaltyConfig {
  earningRules: {
    baseRate: number;           // 1 ponto por R$
    categoryMultipliers: {      // Multiplicadores por categoria
      categoryId: string;
      multiplier: number;       // 2x pontos em sorvetes
    }[];
    bonusPeriods: {
      start: Date;
      end: Date;
      multiplier: number;       // 3x pontos em fevereiro
    }[];
  };
  expiration: {
    enabled: boolean;
    months: number;             // 12 meses
    notificationDays: number;   // Avisar 30 dias antes
  };
  tiers: {
    name: string;
    minPoints: number;
    benefits: string[];
  }[];
}
```

---

## 10. Financeiro

### 10.1 Contas a Receber

```
┌─────────────────────────────────────────────────────────────┐
│  Contas a Receber                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Resumo:                                                    │
│  ┌───────────┬───────────┬───────────┬───────────┐         │
│  │ Hoje      │ Esta Semana│ Este Mês  │ A Receber │         │
│  │ R$ 450    │ R$ 2.340  │ R$ 8.900  │ R$ 1.200  │         │
│  └───────────┴───────────┴───────────┴───────────┘         │
│                                                             │
│  Por Forma de Pagamento (Mês):                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ PIX        ████████████████████  R$ 4.500 (51%)     │   │
│  │ Cartão     ██████████████  R$ 3.200 (36%)           │   │
│  │ Dinheiro   ██████  R$ 1.000 (11%)                   │   │
│  │ Outros     █  R$ 200 (2%)                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  Lançamentos:                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Data  │ Descrição      │ Valor   │ Status  │ Ações  │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ 20/02 │ Pedido #1234   │ R$ 45   │ ✅ Pago  │ [...]  │   │
│  │ 20/02 │ Pedido #1235   │ R$ 67   │ ⏳ Pendente│ [...]│   │
│  │ 19/02 │ Fiado - João   │ R$ 30   │ ⚠️ Atrasado│ [...]│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Novo Lançamento] [Cobrar Pendentes] [Exportar]            │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Fluxo de Caixa

```
┌─────────────────────────────────────────────────────────────┐
│  Fluxo de Caixa                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Período: [01/02/2026] até [28/02/2026]                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ SALDO INICIAL:              R$ 1.500,00             │   │
│  │                                                     │   │
│  │ (+) ENTRADAS                                        │   │
│  │     Vendas                                          │   │
│  │     • PIX:              R$ 4.500,00                 │   │
│  │     • Cartão:           R$ 3.200,00                 │   │
│  │     • Dinheiro:         R$ 1.000,00                 │   │
│  │     • Outros:           R$ 200,00                   │   │
│  │     Total Entradas:     R$ 8.900,00                 │   │
│  │                                                     │   │
│  │ (-) SAÍDAS                                          │   │
│  │     Fornecedores        R$ 3.500,00                 │   │
│  │     Despesas            R$ 1.200,00                 │   │
│  │     Taxas               R$ 180,00                   │   │
│  │     Total Saídas:       R$ 4.880,00                 │   │
│  │                                                     │   │
│  │ SALDO FINAL:              R$ 5.520,00               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Lançar Entrada] [Lançar Saída] [Relatório Completo]       │
└─────────────────────────────────────────────────────────────┘
```

### 10.3 Cobrança Automatizada

```
┌─────────────────────────────────────────────────────────────┐
│  Cobrar Pendentes                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Pendentes: 15 clientes                                     │
│  Valor total: R$ 890,00                                     │
│                                                             │
│  Selecionar clientes para cobrança:                         │
│  ☑ João Silva - R$ 30,00 (5 dias atrasado)                  │
│  ☑ Maria Santos - R$ 45,00 (2 dias atrasado)                │
│  ☐ Pedro Costa - R$ 67,00 (vence hoje)                      │
│  ...                                                        │
│                                                             │
│  Método de cobrança:                                        │
│  ○ WhatsApp (mensagem personalizada)                        │
│  ○ SMS (lembrete curto)                                     │
│  ○ Email (formal)                                           │
│                                                             │
│  Modelo de mensagem:                                        │
│  [Olá {nome}, você tem uma pendência de R$ {valor}          │
│   desde {data_vencimento}.                                  │
│   Regularize aqui: {link_pagamento}]                        │
│                                                             │
│  [Enviar Cobranças]                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Infraestrutura Técnica

### 11.1 Toast Notifications

**Biblioteca atual:** Sonner (já implementada) ✅

**Melhores práticas:**

```typescript
// utils/toast.ts
import { toast } from 'sonner';

export const notify = {
  success: (message: string) => {
    toast.success(message, {
      duration: 3000,
      position: 'top-right',
    });
  },
  error: (message: string) => {
    toast.error(message, {
      duration: 5000,
      position: 'top-right',
    });
  },
  warning: (message: string) => {
    toast.warning(message, {
      duration: 4000,
    });
  },
  info: (message: string) => {
    toast.info(message, {
      duration: 3000,
    });
  },
  loading: (message: string) => {
    return toast.loading(message);
  },
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) => {
    toast.promise(promise, messages);
  },
};

// Uso:
// notify.success('Produto salvo com sucesso!');
// notify.error('Erro ao conectar com servidor');
// notify.promise(saveProduct(), {
//   loading: 'Salvando...',
//   success: 'Salvo!',
//   error: 'Falha ao salvar'
// });
```

### 11.2 Error Boundaries

**Implementação recomendada:**

```tsx
// components/common/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    
    // Log para serviço de monitoramento (Sentry, etc.)
    this.props.onError?.(error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-4 bg-red-50 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800">
            Oops! Algo deu errado
          </h2>
          <p className="text-red-600 mt-2">
            Por favor, recarregue a página ou tente novamente.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded"
          >
            Recarregar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Uso no App.tsx:
// <ErrorBoundary fallback={<FallbackUI />}>
//   <App />
// </ErrorBoundary>
```

### 11.3 Performance Monitoring

**Métricas a acompanhar:**

| Métrica | Descrição | Meta |
|---------|-----------|------|
| **FCP** (First Contentful Paint) | Primeiro conteúdo renderizado | < 1.5s |
| **LCP** (Largest Contentful Paint) | Maior elemento visível | < 2.5s |
| **FID** (First Input Delay) | Latência de primeira interação | < 100ms |
| **CLS** (Cumulative Layout Shift) | Estabilidade visual | < 0.1 |
| **TTFB** (Time to First Byte) | Resposta do servidor | < 600ms |

**Implementação:**

```typescript
// utils/performance.ts
export const reportWebVitals = () => {
  if ('PerformanceObserver' in window) {
    // LCP
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      console.log('LCP:', lastEntry.startTime);
      // Enviar para analytics
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // FID
    const fidObserver = new PerformanceObserver((entryList) => {
      entryList.getEntries().forEach((entry) => {
        console.log('FID:', entry.processingStart - entry.startTime);
      });
    });
    fidObserver.observe({ entryTypes: ['first-input'] });

    // CLS
    const clsObserver = new PerformanceObserver((entryList) => {
      let clsValue = 0;
      entryList.getEntries().forEach((entry) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });
      console.log('CLS:', clsValue);
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });
  }
};

// No main.tsx:
reportWebVitals();
```

**Ferramentas sugeridas:**
- Vercel Analytics (gratuito)
- Google Analytics 4 + Web Vitals
- Sentry Performance (pago, mas completo)

### 11.4 SEO Avançado

**Meta tags dinâmicas por página:**

```tsx
// hooks/useSEO.ts
import { useEffect } from 'react';

interface SEOConfig {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  noIndex?: boolean;
}

export const useSEO = ({ title, description, canonical, ogImage, noIndex }: SEOConfig) => {
  useEffect(() => {
    // Title
    document.title = `${title} | OptmaMenu`;

    // Meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', description);
    }

    // Canonical
    if (canonical) {
      const link = document.createElement('link');
      link.rel = 'canonical';
      link.href = canonical;
      document.head.appendChild(link);
    }

    // Open Graph
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', title);
    }

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {
      ogDesc.setAttribute('content', description);
    }

    if (ogImage) {
      const ogImg = document.querySelector('meta[property="og:image"]');
      if (ogImg) {
        ogImg.setAttribute('content', ogImage);
      }
    }

    // No index
    if (noIndex) {
      const robots = document.querySelector('meta[name="robots"]');
      if (robots) {
        robots.setAttribute('content', 'noindex, nofollow');
      }
    }

    // Cleanup
    return () => {
      // Remover tags adicionadas dinamicamente se necessário
    };
  }, [title, description, canonical, ogImage, noIndex]);
};

// Uso em uma página:
// useSEO({
//   title: 'Cardápio - Sorveteria Doce Sabor',
//   description: 'Veja nosso cardápio completo de sorvetes e bebidas',
//   canonical: 'https://docesabor.com.br/cardapio',
//   ogImage: 'https://docesabor.com.br/og-cardapio.jpg'
// });
```

**Schema.org para restaurantes:**

```json
{
  "@context": "https://schema.org",
  "@type": "IceCreamShop",
  "name": "Sorveteria Doce Sabor",
  "image": "https://docesabor.com.br/logo.jpg",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Rua das Flores, 123",
    "addressLocality": "São Paulo",
    "addressRegion": "SP",
    "postalCode": "01234-567",
    "addressCountry": "BR"
  },
  "telephone": "+5511987654321",
  "openingHours": "Mo-Sa 10:00-22:00, Su 14:00-20:00",
  "priceRange": "$$",
  "servesCuisine": "Ice Cream"
}
```

---

## 12. UX/UI e Configurações

### 12.1 Menu Lateral Colapsável

**Recomendação:** Menu colapsável com ícones grandes + submenus em cascata

```
┌─────────────────────────────────────────────────────────────┐
│  MENU EXPANDIDO                                             │
├────┬────────────────────────────────────────────────────────┤
│ 🏠 │ Dashboard                                              │
├────┼────────────────────────────────────────────────────────┤
│ 📦 │ Produtos                    ▶                         │
│    │ ┌──────────────────────────────────────────────────┐  │
│    │ │ • Todos os Produtos                            │  │
│    │ │ • Categorias                                   │  │
│    │ │ • Adicionar Produto                            │  │
│    │ └──────────────────────────────────────────────────┘  │
├────┼────────────────────────────────────────────────────────┤
│ 📊 │ Estoque                     ▶                         │
│    │ ┌──────────────────────────────────────────────────┐  │
│    │ │ • Visão Geral                                  │  │
│    │ │ • Movimentações                                │  │
│    │ │ • Transferências                               │  │
│    │ │ • Ajustes                                      │  │
│    │ └──────────────────────────────────────────────────┘  │
├────┼────────────────────────────────────────────────────────┤
│ 🛒 │ Pedidos                                                │
├────┼────────────────────────────────────────────────────────┤
│ 👥 │ Clientes                                               │
├────┼────────────────────────────────────────────────────────┤
│ 💎 │ Fidelidade                  ▶                         │
├────┼────────────────────────────────────────────────────────┤
│ 📢 │ Marketing                   ▶                         │
├────┼────────────────────────────────────────────────────────┤
│ 💰 │ Financeiro                  ▶                         │
├────┼────────────────────────────────────────────────────────┤
│ ⚙️ │ Configurações               ▶                         │
└────┴────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  MENU COLAPSADO (ícones grandes)                            │
├────┬────────────────────────────────────────────────────────┤
│ 🏠 │                                                        │
├────┼────────────────────────────────────────────────────────┤
│ 📦 │ Produtos                                               │
│    │ ┌──────────────────────────────────────────────────┐  │
│    │ │   Todos os Produtos                              │  │
│    │ │   Categorias                                     │  │
│    │ │   Adicionar Produto                              │  │
│    │ └──────────────────────────────────────────────────┘  │
├────┼────────────────────────────────────────────────────────┤
│ 📊 │ Estoque                                                │
│    │ ┌──────────────────────────────────────────────────┐  │
│    │   ...                                              │  │
│    │ └──────────────────────────────────────────────────┘  │
├────┼────────────────────────────────────────────────────────┤
│ 🛒 │                                                        │
├────┼────────────────────────────────────────────────────────┤
│ 👥 │                                                        │
├────┼────────────────────────────────────────────────────────┤
│ 💎 │                                                        │
├────┼────────────────────────────────────────────────────────┤
│ 📢 │                                                        │
├────┼────────────────────────────────────────────────────────┤
│ 💰 │                                                        │
├────┼────────────────────────────────────────────────────────┤
│ ⚙️ │                                                        │
└────┴────────────────────────────────────────────────────────┘
```

**Comportamento:**
- **Expandir/Recolher:** Botão toggle no rodapé do menu
- **Submenus:** Accordion (clica expande, clica recolhe)
- **Ícones:** 24px no expandido, 32px no colapsado
- **Tooltip:** Mostrar nome do item ao passar mouse no colapsado
- **Responsivo:** Mobile = menu drawer (desliza da esquerda)

### 12.2 Configurabilidade pelo Usuário

**Princípio:** Tudo que for específico do negócio deve ser configurável

```
┌─────────────────────────────────────────────────────────────┐
│  Central de Configurações                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🏪 Dados da Store                                          │
│  • Nome, CNPJ, Endereço                                     │
│  • Logo, Cores da marca                                     │
│  • Redes sociais                                            │
│                                                             │
│  ⏰ Horário de Funcionamento                                │
│  • Dias e horários                                          │
│  • Feriados                                                 │
│  • Horário especial                                         │
│                                                             │
│  💳 Formas de Pagamento                                     │
│  • Ativar/desativar métodos                                 │
│  • Configurar cada método                                   │
│                                                             │
│  🚚 Entrega                                                 │
│  • Raio de entrega                                          │
│  • Taxas                                                    │
│  • Tempo estimado                                           │
│                                                             │
│  📱 Notificações                                            │
│  • SMS (provedor, template)                                 │
│  • WhatsApp (API, template)                                 │
│  • Email (SMTP, template)                                   │
│                                                             │
│  🔐 Segurança                                               │
│  • Senha forte obrigatória                                  │
│  • 2FA (opcional)                                           │
│  • Timeout de sessão                                        │
│                                                             │
│  🎨 Personalização                                          │
│  • Tema (claro/escuro)                                      │
│  • Cores primárias                                          │
│  • Logo do cliente final                                    │
│                                                             │
│  📦 Módulos                                                 │
│  • Ativar/desativar módulos                                 │
│  • Configurar cada módulo                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 12.3 Token Interno vs. OTP Externo

**Estratégia recomendada:**

```
┌─────────────────────────────────────────────────────────────┐
│  Níveis de Segurança                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔓 BAIXO RISCO (sem token)                                 │
│  • Visualizar produtos                                      │
│  • Consultar estoque                                        │
│  • Ver histórico próprio                                    │
│  • Atualizar perfil                                         │
│                                                             │
│  🔒 MÉDIO RISCO (token interno/sessão)                      │
│  • Criar/editar produtos                                    │
│  • Ajustar estoque (rápido)                                 │
│  • Registrar venda                                          │
│  • Cadastrar cliente                                        │
│                                                             │
│  🔐 ALTO RISCO (OTP externo obrigatório)                    │
│  • Excluir produtos/clientes                                │
│  • Ajuste de estoque > 50 unidades                          │
│  • Transferência entre lojas                                │
│  • Alterar configurações da store                           │
│  • Acessar financeiro                                       │
│  • Exportar dados em massa                                  │
│  • Adicionar/remover usuários                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Configuração pelo usuário:**

```
┌─────────────────────────────────────────────────────────────┐
│  Configurar Segurança                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  OTP para operações sensíveis:                              │
│  ☑ Habilitar                                                │
│                                                             │
│  Operações que exigem OTP:                                  │
│  ☐ Exclusão de registros                                    │
│  ☑ Transferências entre lojas                               │
│  ☑ Alterações financeiras                                   │
│  ☐ Ajustes de estoque                                       │
│  ☑ Gestão de usuários                                       │
│                                                             │
│  Método de envio:                                           │
│  ☑ SMS                                                      │
│  ☑ WhatsApp                                                 │
│  ☐ Email                                                    │
│                                                             │
│  Validade do token: [15] minutos                            │
│  Tentativas máximas: [3]                                    │
│                                                             │
│  [Salvar Configurações]                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 13. Roadmap de Implementação

### 13.1 Fases Sugeridas

```
┌─────────────────────────────────────────────────────────────┐
│  FASE 1: Fundação (4-6 semanas)                             │
├─────────────────────────────────────────────────────────────┤
│  ✅ Autenticação (Admin + Cliente OTP)                      │
│  ✅ Produtos e Categorias                                   │
│  ✅ Estoque básico                                          │
│  ✅ PDV/Pedidos                                             │
│  ✅ Configurações da Store                                  │
│                                                             │
│  📋 A fazer:                                                │
│  • Refinar fluxo de OTP                                     │
│  • Implementar RLS completo                                 │
│  • Logs de auditoria                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  FASE 2: Movimentações (4-6 semanas)                        │
├─────────────────────────────────────────────────────────────┤
│  ✅ Transferência entre lojas                               │
│  ✅ Transferência interna                                   │
│  ✅ Devoluções                                              │
│  ✅ Perdas e ajustes                                        │
│  ✅ Preço de aquisição                                      │
│                                                             │
│  📋 A fazer:                                                │
│  • Catálogo global de produtos                              │
│  • DTE (Documento de Transferência)                         │
│  • Conferência cega                                         │
│  • Notificações automáticas                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  FASE 3: Clientes & Fidelidade (3-4 semanas)                │
├─────────────────────────────────────────────────────────────┤
│  ✅ Cadastro de clientes                                    │
│  ✅ Programa de fidelidade                                  │
│  ✅ Níveis e recompensas                                    │
│  ✅ Histórico de compras                                    │
│                                                             │
│  📋 A fazer:                                                │
│  • Revisar regras de pontuação                              │
│  • Implementar expiração de pontos                          │
│  • Relatórios de fidelidade                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  FASE 4: Marketing (3-4 semanas)                            │
├─────────────────────────────────────────────────────────────┤
│  ✅ Central de mensagens                                    │
│  ✅ Campanhas automáticas                                   │
│  ✅ Vouchers eletrônicos                                    │
│  ✅ Templates                                               │
│                                                             │
│  📋 A fazer:                                                │
│  • Integração SMS/WhatsApp                                  │
│  • Analytics de campanhas                                   │
│  • A/B testing                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  FASE 5: Financeiro (3-4 semanas)                           │
├─────────────────────────────────────────────────────────────┤
│  ✅ Contas a receber                                        │
│  ✅ Fluxo de caixa                                          │
│  ✅ Conciliação                                             │
│  ✅ Relatórios                                              │
│                                                             │
│  📋 A fazer:                                                │
│  • Contas a pagar                                           │
│  • Integração bancária (PIX)                                │
│  • Cobrança automatizada                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  FASE 6: UX & Configurações (2-3 semanas)                   │
├─────────────────────────────────────────────────────────────┤
│  ✅ Menu colapsável                                         │
│  ✅ Central de configurações                                │
│  ✅ RBAC completo                                           │
│  ✅ Tema personalizável                                     │
│                                                             │
│  📋 A fazer:                                                │
│  • Testes de usabilidade                                    │
│  • Otimização mobile                                        │
│  • Acessibilidade                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  FASE 7: Analytics & Otimização (contínuo)                  │
├─────────────────────────────────────────────────────────────┤
│  • Dashboard completo                                       │
│  • Relatórios avançados                                     │
│  • Performance monitoring                                   │
│  • SEO                                                      │
│  • Testes A/B                                               │
└─────────────────────────────────────────────────────────────┘
```

### 13.2 Priorização (Matriz Impacto x Esforço)

```
IMPACTO
  ↑
  │  ┌─────────────┐  ┌─────────────┐
  │  │  FAZER AGORA│  │  PLANEJAR   │
  │  │  PDV        │  │  Marketing  │
  │  │  Estoque    │  │  Analytics  │
  │  │  Pedidos    │  │  Financeiro │
  │  └─────────────┘  └─────────────┘
  │
  │  ┌─────────────┐  ┌─────────────┐
  │  │  RÁPIDO     │  │  EVITAR     │
  │  │  Ganho      │  │  (baixo     │
  │  │  (low       │  │  impacto,   │
  │  │  hanging    │  │  alto       │
  │  │  fruit)     │  │  esforço)   │
  │  └─────────────┘  └─────────────┘
  │
  └──────────────────────────────────→ ESFORÇO
```

---

## 14. Melhores Práticas e Recomendações

### 14.1 Checklist de Lançamento

**Antes de cadastrar primeiros clientes:**

- [ ] RLS testado e validado
- [ ] Backup automático configurado
- [ ] Logs de auditoria funcionando
- [ ] OTP SMS/WhatsApp testado
- [ ] Performance (LCP < 2.5s)
- [ ] Mobile responsivo
- [ ] Documentação do usuário
- [ ] Suporte configurado
- [ ] Termos de uso e privacidade
- [ ] LGPD compliance

### 14.2 Monitoramento Contínuo

**Diário:**
- Erros no Sentry/Logs
- Performance (Web Vitals)
- Pedidos falhados

**Semanal:**
- Feedback de usuários
- Métricas de uso (DAU, MAU)
- Conversão de campanhas

**Mensal:**
- Churn rate
- NPS (Net Promoter Score)
- Receita recorrente (MRR)

### 14.3 Escalabilidade

**Quando começar a escalar:**

| Gatilho | Ação |
|---------|------|
| > 100 lojas | Otimizar queries, adicionar índices |
| > 1000 pedidos/dia | Cache (Redis), CDN |
| > 10 lojas ativas simultâneas | Connection pooling |
| > 100MB de imagens | Storage externo (S3, Cloudinary) |

### 14.4 Segurança

**Checklist mínimo:**

- [ ] HTTPS obrigatório
- [ ] Senhas com hash (bcrypt)
- [ ] RLS em todas as tabelas
- [ ] Rate limiting em APIs
- [ ] Validação de input (Zod)
- [ ] XSS protection
- [ ] CSRF tokens
- [ ] Logs de acesso
- [ ] Backup diário
- [ ] Plano de recuperação de desastres

### 14.5 Sugestões Adicionais

**Funcionalidades para considerar:**

1. **App nativo (futuro):** React Native para iOS/Android
2. **Integração iFood/Rappi:** Ampliar alcance
3. **BI/Analytics avançado:** Power BI embedded
4. **Automação de compras:** Sugestão baseada em histórico
5. **Reconhecimento facial:** Para fidelidade (opcional)
6. **Voice ordering:** "Alexa, peça um picolé na Doce Sabor"

---

## 15. Painel Admin do SaaS (Super Admin)

### 15.1 Visão Geral do Painel Super Admin

Como fornecedor do SaaS, você precisa de uma visão completa de **todas as stores** cadastradas, seu uso, saúde financeira e status operacional.

```
┌─────────────────────────────────────────────────────────────┐
│  OPTMAMENU SAAS - Painel Super Admin                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 RESUMO GERAL                                            │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐ │
│  │ Stores      │ Ativas      │ Teste       │ Inativas    │ │
│  │ 247         │ 189         │ 34          │ 24          │ │
│  └─────────────┴─────────────┴─────────────┴─────────────┘ │
│                                                             │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐ │
│  │ MRR         │ Churn       │ LTV         │ NPS         │ │
│  │ R$ 28.450   │ 3.2%        │ R$ 1.240    │ 72          │ │
│  └─────────────┴─────────────┴─────────────┴─────────────┘ │
│                                                             │
│  📈 MÉTRICAS DE USO (Últimos 7 dias)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Pedidos processados:    12.450                      │   │
│  │ Usuários ativos:        1.834                       │   │
│  │ Tickets abertos:        23                          │   │
│  │ Uptime:                 99.97%                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ⚠️ ALERTAS                                                 │
│  • 3 stores com pagamento atrasado                          │
│  • 1 store excedeu limite de pedidos                        │
│  • 5 stores solicitaram exclusão                            │
│                                                             │
│  [Ver Todas Stores] [Ver Financeiro] [Ver Suporte]          │
└─────────────────────────────────────────────────────────────┘
```

### 15.2 Listagem de Stores

```
┌─────────────────────────────────────────────────────────────┐
│  Gerenciar Stores                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Filtros:                                                   │
│  Status: [Todos ▼]  Plano: [Todos ▼]  Busca: [_________]   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Store           │ Plano        │ Uso        │ Status │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ 🍦 Doce Sabor   │ Professional │ 1.234/2000 │ ✅ Ativa│  │
│  │    CNPJ: 12.345   • 45 dias     • R$ 149/mês │       │   │
│  │    [Ver Detalhes] [Bloquear] [Exportar Dados]       │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ 🍔 Lanchonete  │ Starter      │ 489/500    │ ⚠️ Limite│ │
│  │    CNPJ: 98.765   • 12 dias     • R$ 79/mês  │       │   │
│  │    [Ver Detalhes] [Bloquear] [Exportar Dados]       │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ ☕ Café Central │ Enterprise   │ 5.678/∞    │ ✅ Ativa│  │
│  │    CNPJ: 11.222   • 180 dias    • R$ 299/mês │       │   │
│  │    [Ver Detalhes] [Bloquear] [Exportar Dados]       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Exportar Lista] [Adicionar Store Manualmente]             │
└─────────────────────────────────────────────────────────────┘
```

### 15.3 Detalhes da Store

```
┌─────────────────────────────────────────────────────────────┐
│  Store: Sorveteria Doce Sabor                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📋 INFORMAÇÕES                                             │
│  • Owner: João Silva (joao@docesabor.com)                   │
│  • CNPJ: 12.345.678/0001-90                                 │
│  • Plano: Professional (R$ 149/mês)                         │
│  • Desde: 15/01/2026                                        │
│  • Status: ✅ Ativa                                         │
│                                                             │
│  📊 MÉTRICAS DE USO                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Este Mês               │ Acumulado                  │   │
│  │ • Pedidos: 1.234       │ • Pedidos: 3.456           │   │
│  │ • Produtos: 45         │ • Clientes: 892            │   │
│  │ • Vendas: R$ 12.340    │ • Vendas: R$ 34.567        │   │
│  │ • Armazenamento: 2.3GB │ • Login médio: 23 dias     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  💰 FINANCEIRO                                              │
│  • Última fatura: R$ 149,00 (paga em 01/02/2026)            │
│  • Próxima cobrança: 01/03/2026                             │
│  • Histórico: [Ver Todas]                                   │
│                                                             │
│  👥 USUÁRIOS                                                │
│  • Admin: João Silva (ativo)                                │
│  • Staff: Maria (ativo), Pedro (inativo)                    │
│  • Total: 3 usuários                                        │
│                                                             │
│  🔐 AÇÕES                                                   │
│  [Ver Logs] [Resetar Senha] [Bloquear Temporariamente]      │
│  [Exportar Dados] [Solicitar Exclusão]                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 15.4 Monitoramento de Uso por Store

**Métricas importantes para acompanhar:**

| Métrica | Descrição | Alerta |
|---------|-----------|--------|
| **Pedidos/mês** | Volume de pedidos processados | > 90% do limite |
| **Armazenamento** | Espaço usado (imagens + dados) | > 80% da cota |
| **Usuários ativos** | Logins nos últimos 7 dias | < 3 dias sem login |
| **Vendas totais** | Volume financeiro processado | - |
| **API calls** | Requisições à API | > 10.000/dia |
| **Erro rate** | Porcentagem de erros | > 5% |

### 15.5 Tabela de Monitoramento (Supabase)

```sql
-- Tabela de uso das stores
CREATE TABLE store_usage_metrics (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  metric_date DATE NOT NULL,
  pedidos_count INTEGER DEFAULT 0,
  produtos_count INTEGER DEFAULT 0,
  clientes_count INTEGER DEFAULT 0,
  vendas_total DECIMAL(12,2) DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,
  api_calls_count INTEGER DEFAULT 0,
  active_users_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, metric_date)
);

-- Tabela de logs do Super Admin
CREATE TABLE super_admin_logs (
  id UUID PRIMARY KEY,
  admin_user_id UUID REFERENCES auth.users(id),
  action VARCHAR(100),
  target_store_id UUID REFERENCES stores(id),
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- View para ranking de stores
CREATE VIEW store_ranking AS
SELECT 
  s.id,
  s.nome,
  SUM(su.vendas_total) as vendas_30_dias,
  SUM(su.pedidos_count) as pedidos_30_dias,
  COUNT(DISTINCT su.active_users_count) as usuarios_ativos
FROM stores s
LEFT JOIN store_usage_metrics su ON s.id = su.store_id
WHERE su.metric_date >= NOW() - INTERVAL '30 days'
GROUP BY s.id, s.nome
ORDER BY vendas_30_dias DESC;
```

### 15.6 Edge Functions para Coleta de Métricas

```typescript
// supabase/functions/collect-metrics/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Coleta métricas de todas as stores
  const { data: stores } = await supabase.rpc(
                'get_store_config_admin',
                { p_store_id: storeId }
            );
  for (const store of stores) {
    // Contar pedidos do dia
    const { count: pedidosCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', store.id)
      .gte('created_at', new Date().toISOString().split('T')[0]);

    // Contar produtos
    const { count: produtosCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', store.id);

    // Inserir métricas
    await supabase.from('store_usage_metrics').insert({
      store_id: store.id,
      metric_date: new Date().toISOString().split('T')[0],
      pedidos_count: pedidosCount || 0,
      produtos_count: produtosCount || 0,
    });
  }

  return new Response(JSON.stringify({ success: true }));
});
```

---

## 16. Exclusão de Contas e Gestão de Dados

### 16.1 Fluxo de Exclusão de Conta

```
┌─────────────────────────────────────────────────────────────┐
│  FLUXO DE EXCLUSÃO DE CONTA                                 │
└─────────────────────────────────────────────────────────────┘

Dia 0: Solicitação de Exclusão
│
├─► Usuário solicita exclusão nas configurações
├─► Sistema exibe consequências (perda de dados, etc.)
├─► Opção: Receber backup dos dados por email
├─► Confirmação por email/SMS (token)
├─► Status muda para "Pendente Exclusão"
│    • Sistema continua acessível (somente leitura)
│    • Cobrança é cancelada imediatamente
│
├─► Email enviado: "Solicitação de exclusão recebida"
│    • Link para cancelar exclusão
│    • Data prevista: 15 dias
│
▼
Dia 1-14: Período de Graça
│
├─► Usuário pode cancelar exclusão a qualquer momento
├─► Backup dos dados é preparado (JSON + CSV)
├─► Email com backup enviado (se solicitado)
├─► Lembretes: Dia 7, Dia 13
│
▼
Dia 15: Exclusão Definitiva
│
├─► Verifica se não houve cancelamento
├─► Backup final salvo (retenção legal: 5 anos)
├─► Exclusão em cascata iniciada
├─► Email de confirmação: "Conta excluída"
│
▼
Dia 16+: Limpeza Completa
│
├─► Imagens removidas do storage (S3/Supabase Storage)
├─► Dados anonimizados em logs
├─► Domínio customizado liberado
└─► CNPJ disponível para nova conta
```

### 16.2 Estrutura de Exclusão em Cascata

```sql
-- Função para exclusão em cascata controlada
CREATE OR REPLACE FUNCTION soft_delete_store(target_store_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Marca store como pendente de exclusão
  UPDATE stores 
  SET 
    status = 'pending_deletion',
    deletion_requested_at = NOW(),
    deletion_scheduled_at = NOW() + INTERVAL '15 days',
    ativo = FALSE
  WHERE id = target_store_id;

  -- Registra solicitação de exclusão
  INSERT INTO deletion_requests (
    store_id, 
    requested_at, 
    scheduled_deletion_at,
    backup_requested
  ) VALUES (
    target_store_id,
    NOW(),
    NOW() + INTERVAL '15 days',
    TRUE  -- sempre gera backup
  );

  -- Notifica Super Admin
  INSERT INTO admin_notifications (
    type,
    title,
    message,
    store_id
  ) VALUES (
    'deletion_requested',
    'Exclusão de conta solicitada',
    'A store ' || (SELECT nome FROM stores WHERE id = target_store_id) || ' solicitou exclusão. Conclusão em 15 dias.',
    target_store_id
  );
END;
$$ LANGUAGE plpgsql;

-- Função para exclusão definitiva (executada após 15 dias)
CREATE OR REPLACE FUNCTION hard_delete_store(target_store_id UUID)
RETURNS VOID AS $$
DECLARE
  backup_path TEXT;
BEGIN
  -- 1. Exportar dados para backup (JSON)
  SELECT export_store_to_json(target_store_id) INTO backup_path;

  -- 2. Excluir dados em ordem (respeitando FKs)
  DELETE FROM audit_logs WHERE store_id = target_store_id;
  DELETE FROM store_usage_metrics WHERE store_id = target_store_id;
  DELETE FROM store_users WHERE store_id = target_store_id;
  DELETE FROM customer_points WHERE store_id = target_store_id;
  DELETE FROM rewards WHERE store_id = target_store_id;
  DELETE FROM fidelity_programs WHERE store_id = target_store_id;
  DELETE FROM customers WHERE store_id = target_store_id;
  DELETE FROM order_items WHERE order_id IN (
    SELECT id FROM orders WHERE store_id = target_store_id
  );
  DELETE FROM orders WHERE store_id = target_store_id;
  DELETE FROM product_equivalence WHERE store_id_a = target_store_id OR store_id_b = target_store_id;
  DELETE FROM store_products WHERE store_id = target_store_id;
  DELETE FROM products WHERE store_id = target_store_id;
  DELETE FROM categories WHERE store_id = target_store_id;
  DELETE FROM store_configurations WHERE store_id = target_store_id;
  
  -- 3. Remover imagens do storage
  DELETE FROM storage.objects WHERE bucket_id = 'store-images' AND owner = target_store_id;

  -- 4. Excluir store
  DELETE FROM stores WHERE id = target_store_id;

  -- 5. Registrar exclusão
  INSERT INTO deleted_stores_log (
    store_id,
    deleted_at,
    backup_path,
    retention_until
  ) VALUES (
    target_store_id,
    NOW(),
    backup_path,
    NOW() + INTERVAL '5 years'  -- LGPD: retenção legal
  );
END;
$$ LANGUAGE plpgsql;
```

### 16.3 Backup dos Dados

**Opções de backup:**

```
┌─────────────────────────────────────────────────────────────┐
│  Configurar Backup                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📦 Backup Automático                                       │
│  ☑ Diário (mantém últimos 7 dias)                           │
│  ☑ Semanal (mantém últimas 4 semanas)                       │
│  ☑ Mensal (mantém últimos 12 meses)                         │
│                                                             │
│  💾 Backup Sob Demanda                                      │
│  [Gerar Backup Agora]                                       │
│                                                             │
│  📧 Envio de Backup                                         │
│  Email para: [admin@docesabor.com]                          │
│  Formato: ☑ JSON ☑ CSV ☐ SQL                                │
│                                                             │
│  📥 Download Local                                          │
│  [Baixar Backup Completo]                                   │
│                                                             │
│  🔒 Criptografia                                            │
│  ☑ Criptografar backup (senha: [__________])                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Estrutura do backup (JSON):**

```json
{
  "backup_metadata": {
    "store_id": "uuid",
    "store_name": "Sorveteria Doce Sabor",
    "backup_date": "2026-02-20T10:30:00Z",
    "version": "1.0"
  },
  "data": {
    "products": [...],
    "categories": [...],
    "customers": [...],
    "orders": [...],
    "fidelity_programs": [...],
    "configurations": {...}
  },
  "schema_version": "2026.1"
}
```

### 16.4 Email de Backup

**Template de email:**

```
┌─────────────────────────────────────────────────────────────┐
│  De: OptmaMenu SaaS <nao-responda@optmamenu.com>            │
│  Para: admin@docesabor.com                                  │
│  Assunto: 📦 Seu backup OptmaMenu está pronto               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Olá, João!                                                 │
│                                                             │
│  Conforme solicitado, seu backup está disponível.           │
│                                                             │
│  📦 DADOS DO BACKUP                                         │
│  • Store: Sorveteria Doce Sabor                             │
│  • Data: 20/02/2026 10:30                                   │
│  • Tamanho: 2.3 MB                                          │
│  • Formato: JSON + CSV                                      │
│                                                             │
│  📥 DOWNLOAD                                                │
│  [Baixar Backup] (link válido por 7 dias)                   │
│                                                             │
│  ⚠️ IMPORTANTE                                              │
│  Este backup contém TODOS os seus dados. Guarde em local    │
│  seguro. Em caso de exclusão da conta, estes são os únicos  │
│  dados que você terá acesso.                                │
│                                                             │
│  Dúvidas? Entre em contato: suporte@optmamenu.com           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 16.5 Cancelamento de Exclusão

```
┌─────────────────────────────────────────────────────────────┐
│  Conta em Processo de Exclusão                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ⚠️ SUA CONTA SERÁ EXCLUÍDA EM 12 DIAS                      │
│                                                             │
│  Data prevista: 05/03/2026                                  │
│                                                             │
│  Durante este período:                                      │
│  ✓ Você ainda pode acessar (somente leitura)                │
│  ✓ Seu backup está sendo preparado                          │
│  ✓ Você pode cancelar a exclusão a qualquer momento         │
│                                                             │
│  ✗ Novos pedidos estão desativados                          │
│  ✗ Clientes não podem acessar o cardápio                    │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  [🔄 Cancelar Exclusão]  [📥 Baixar Backup]                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Modal de Confirmação:
┌─────────────────────────────────────────────────────────────┐
│  Cancelar Exclusão?                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Sua conta será reativada imediatamente com todos os dados. │
│                                                             │
│  • Plano: Professional (R$ 149/mês)                         │
│  • Próxima cobrança: 01/03/2026                             │
│  • Dados: 100% preservados                                  │
│                                                             │
│  [Voltar]  [Confirmar Reativação]                           │
└─────────────────────────────────────────────────────────────┘
```

### 16.6 Tabela de Controle de Exclusões

```sql
CREATE TABLE deletion_requests (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  requested_by UUID REFERENCES store_users(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_deletion_at TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  backup_requested BOOLEAN DEFAULT TRUE,
  backup_sent_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ[],
  reason TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- pending, cancelled, completed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de stores excluídas (log permanente)
CREATE TABLE deleted_stores_log (
  id UUID PRIMARY KEY,
  store_id UUID,
  store_name VARCHAR(200),
  cnpj VARCHAR(20),
  owner_email VARCHAR(255),
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  backup_path TEXT,
  retention_until TIMESTAMPTZ,
  reason TEXT
);

-- Trigger para exclusão automática após 15 dias
CREATE OR REPLACE FUNCTION check_pending_deletions()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM hard_delete_store(store_id)
  FROM deletion_requests
  WHERE scheduled_deletion_at <= NOW()
    AND status = 'pending';
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Job agendado (pg_cron ou Edge Function)
-- SELECT cron.schedule('check-deletions', '0 2 * * *', 'SELECT check_pending_deletions()');
```

---

## 17. Estratégia Offline/Híbrida

### 17.1 Cenários de Uso

| Cenário | Características | Solução Recomendada |
|---------|-----------------|---------------------|
| **Internet boa** | Cidade grande, fibra | Nuvem 100% |
| **Internet instável** | Bairro, 4G oscilando | Híbrido (sync) |
| **Sem internet** | Área rural, eventos | Offline-first |
| **Queda de energia** | Blackout local | Offline + bateria |

### 17.2 Arquitetura Offline-First

```
┌─────────────────────────────────────────────────────────────┐
│  ARQUITETURA HÍBRIDA                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌─────────────────┐
│   NUVEM         │         │   DISPOSITIVO   │
│   (Supabase)    │◄───────►│   LOCAL         │
│                 │  Sync   │   (PWA/SQLite)  │
│ • Dados mestre  │         │ • Cache         │
│ • Backup        │         │ • Fila de ops   │
│ • Multi-store   │         │ • Operações     │
└─────────────────┘         └─────────────────┘
         │                          │
         │                          ├──► PDV Offline
         │                          ├──► Pedidos (fila)
         │                          └──► Consulta (cache)
```

### 17.3 Implementação Técnica

**Opção A: PWA com IndexedDB (Recomendada para mobile)**

```typescript
// services/offlineStore.ts
import { openDB } from 'idb';

class OfflineStore {
  private db: any;

  async init() {
    this.db = await openDB('OptmaMenuDB', 1, {
      upgrade(db) {
        // Produtos
        db.createObjectStore('products', { keyPath: 'id' });
        // Pedidos pendentes
        db.createObjectStore('pendingOrders', { keyPath: 'id', autoIncrement: true });
        // Sync metadata
        db.createObjectStore('syncMeta', { keyPath: 'key' });
      },
    });
  }

  async saveProduct(product: any) {
    await this.db.put('products', product);
  }

  async queueOrder(order: any) {
    await this.db.add('pendingOrders', {
      ...order,
      queuedAt: new Date().toISOString(),
      synced: false,
    });
  }

  async syncPendingOrders() {
    const pending = await this.db.getAll('pendingOrders');
    for (const order of pending) {
      try {
        await api.post('/orders', order);
        await this.db.delete('pendingOrders', order.id);
      } catch (error) {
        console.error('Sync failed:', error);
      }
    }
  }
}
```

**Opção B: SQLite Local (React Native ou Electron)**

```typescript
// services/localDB.ts
import SQLite from 'react-native-sqlite-storage';

class LocalDatabase {
  private db: any;

  async init() {
    this.db = await SQLite.openDatabase({
      name: 'OptmaMenu.db',
      location: 'default',
    });
    
    // Criar tabelas locais
    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT,
        price REAL,
        stock INTEGER,
        lastSync TEXT
      )
    `);
  }

  async cacheProducts(products: any[]) {
    const tx = this.db.transaction(['products'], 'readwrite');
    products.forEach(product => {
      tx.executeSql(
        'INSERT OR REPLACE INTO products VALUES (?, ?, ?, ?, ?)',
        [product.id, product.name, product.price, product.stock, new Date().toISOString()]
      );
    });
  }
}
```

### 17.4 Sincronização Inteligente

```
┌─────────────────────────────────────────────────────────────┐
│  FLUXO DE SYNCRONIZAÇÃO                                     │
└─────────────────────────────────────────────────────────────┘

1. Detecta conexão
   │
   ▼
2. Verifica últimas operações locais
   │
   ▼
3. Envia fila de operações pendentes
   │   • Pedidos offline
   │   • Ajustes de estoque
   │   • Novos cadastros
   │
   ▼
4. Baixa atualizações da nuvem
   │   • Novos produtos
   │   • Mudanças de preço
   │   • Pedidos de outros canais
   │
   ▼
5. Resolve conflitos
   │   • Regra: último timestamp vence
   │   • Ou: intervenção manual
   │
   ▼
6. Atualiza cache local
   │
   ▼
7. Notifica usuário
   "✓ 23 pedidos sincronizados"
```

**Código de sync:**

```typescript
// services/syncService.ts
class SyncService {
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;

  constructor() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  async handleOnline() {
    this.isOnline = true;
    await this.sync();
  }

  handleOffline() {
    this.isOnline = false;
    notify.warning('Você está offline. Pedidos serão sincronizados depois.');
  }

  async sync() {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      // 1. Enviar pendentes locais
      const pendingOrders = await offlineStore.getPendingOrders();
      for (const order of pendingOrders) {
        await api.post('/orders', order);
        await offlineStore.removePendingOrder(order.id);
      }

      // 2. Baixar atualizações
      const lastSync = await offlineStore.getLastSync();
      const updates = await api.get(`/sync?since=${lastSync}`);
      await offlineStore.applyUpdates(updates);

      // 3. Atualizar metadata
      await offlineStore.setLastSync(new Date().toISOString());

      notify.success('Dados sincronizados!');
    } catch (error) {
      notify.error('Erro ao sincronizar. Tentando novamente em 5 min.');
      setTimeout(() => this.sync(), 300000);
    } finally {
      this.syncInProgress = false;
    }
  }
}
```

### 17.5 Prevenção de Fraude (Uso Offline)

**Problema:** Lojista usa offline para não pagar.

**Soluções:**

| Estratégia | Implementação | Prós | Contras |
|------------|---------------|------|---------|
| **Limite de operações** | Máx 100 pedidos offline | Simples | Limita uso legítimo |
| **Tempo máximo offline** | 7 dias sem sync | Razoável | Incomoda áreas rurais |
| **Assinatura digital** | JWT com expiração | Seguro | Requer clock confiável |
| **Hardware dedicado** | Celérico travado | Muito seguro | Custo alto |
| **Checksum remoto** | Validação cruzada | Seguro | Complexo |

**Recomendação: Combinação de estratégias**

```typescript
// services/licenseCheck.ts
class LicenseValidator {
  private readonly MAX_OFFLINE_DAYS = 7;
  private readonly MAX_OFFLINE_ORDERS = 200;

  async checkLicense(): Promise<LicenseStatus> {
    const lastSync = await this.getLastSync();
    const ordersSinceSync = await this.getOrdersCount(lastSync);
    const daysOffline = (Date.now() - lastSync) / (1000 * 60 * 60 * 24);

    // Verificações
    if (daysOffline > this.MAX_OFFLINE_DAYS) {
      return { valid: false, reason: 'license_expired' };
    }

    if (ordersSinceSync > this.MAX_OFFLINE_ORDERS) {
      return { valid: false, reason: 'order_limit_exceeded' };
    }

    // Valida assinatura JWT (se houver conexão)
    if (navigator.onLine) {
      const response = await api.get('/license/validate');
      return response.data;
    }

    return { valid: true, mode: 'offline' };
  }
}
```

### 17.6 Projeto: Celular como Servidor Dedicado

**Conceito:** Você fornece um celular recondicionado que roda o sistema localmente.

```
┌─────────────────────────────────────────────────────────────┐
│  OPTMAMENU BOX - Servidor Local                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📱 HARDWARE                                                │
│  • Celular recondicionado (Android 10+)                     │
│  • 64GB storage, 4GB RAM                                    │
│  • Bateria: 8h autonomia                                    │
│  • Fixado na loja (não sai)                                 │
│                                                             │
│  💾 SOFTWARE                                                │
│  • OptmaMenu Server (Node.js + SQLite)                      │
│  • Sync automático com nuvem                                │
│  • Acesso via Wi-Fi local                                   │
│  • Funciona sem internet                                    │
│                                                             │
│  💰 MODELO DE NEGÓCIO                                       │
│  • Celérico: R$ 299 (uma vez)                               │
│  • Licença: R$ 199/mês ( Professional + Box)                │
│  • Suporte: Incluso                                         │
│  • Substituição: R$ 150 (se danificado)                     │
│                                                             │
│  ⚠️ RESPONSABILIDADE                                        │
│  • Lojista cuida do equipamento                             │
│  • Seguro opcional: R$ 29/mês                               │
│  • Danos por mau uso: lojista paga                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Vantagens:**
- ✅ Funciona em área rural
- ✅ Imune a queda de internet/energia
- ✅ Mais rápido (dados locais)
- ✅ Backup automático na nuvem

**Desvantagens:**
- ❌ Custo de hardware
- ❌ Logística de envio/troca
- ❌ Risco de dano/roubo
- ❌ Complexidade de suporte

### 17.7 Recomendação Final

**Para seu caso de uso (sorveterias/lanchonetes):**

| Situação | Recomendação |
|----------|--------------|
| **Maioria dos clientes** | Nuvem 100% (PWA com cache) |
| **Internet instável** | Híbrido (sync quando online) |
| **Área rural/eventos** | OptmaMenu Box (celular dedicado) |
| **Orçamento limitado** | Usar celular próprio + modo offline |

**Implementação sugerida:**

1. **Comece com PWA offline-first**
   - Funciona em qualquer dispositivo
   - Sem custo de hardware
   - Sync quando tiver internet

2. **Ofereça Box como upgrade**
   - Para clientes com problemas críticos
   - Preço: R$ 299 + assinatura
   - Contrato de 12 meses

3. **Limite uso offline**
   - 7 dias máximo
   - 200 pedidos máximo
   - Força sync ao reconectar

### 17.8 Tabela de Controle de Licenças Offline

```sql
CREATE TABLE offline_licenses (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  device_id VARCHAR(100),
  last_sync TIMESTAMPTZ,
  offline_orders_count INTEGER DEFAULT 0,
  license_expires_at TIMESTAMPTZ,
  max_offline_days INTEGER DEFAULT 7,
  max_offline_orders INTEGER DEFAULT 200,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Edge Function para validar licença
CREATE OR REPLACE FUNCTION validate_offline_license(
  p_store_id UUID,
  p_device_id VARCHAR,
  p_last_sync TIMESTAMPTZ
)
RETURNS JSON AS $$
DECLARE
  license RECORD;
  days_offline INTEGER;
BEGIN
  SELECT * INTO license
  FROM offline_licenses
  WHERE store_id = p_store_id AND device_id = p_device_id;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'reason', 'device_not_registered');
  END IF;

  days_offline := EXTRACT(DAY FROM NOW() - p_last_sync);

  IF days_offline > license.max_offline_days THEN
    RETURN json_build_object('valid', false, 'reason', 'max_offline_days_exceeded');
  END IF;

  IF license.offline_orders_count > license.max_offline_orders THEN
    RETURN json_build_object('valid', false, 'reason', 'max_offline_orders_exceeded');
  END IF;

  RETURN json_build_object(
    'valid', true,
    'expires_at', license.license_expires_at,
    'remaining_days', license.max_offline_days - days_offline
  );
END;
$$ LANGUAGE plpgsql;
```

---

## 📎 Apêndices

### A. Glossário

| Termo | Definição |
|-------|-----------|
| **DTE** | Documento de Transferência Entre Lojas |
| **DTI** | Documento de Transferência Interna |
| **OTP** | One-Time Password (senha de uso único) |
| **RLS** | Row Level Security (segurança por linha no banco) |
| **RBAC** | Role-Based Access Control (controle de acesso por função) |
| **PDV** | Ponto de Venda |
| **SKU** | Stock Keeping Unit (código do produto) |

### B. Referências Técnicas

- [Supabase Documentation](https://supabase.com/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Web Vitals](https://web.dev/vitals/)

### C. Contatos e Suporte

- **Documentação técnica:** `/docs`
- **Suporte ao usuário:** `suporte@optmamenu.com`
- **Status do sistema:** `status.optmamenu.com`

---

**Documento criado em:** Fevereiro 2026  
**Próxima revisão:** Março 2026  
**Responsável:** Equipe de Desenvolvimento OptmaMenu
