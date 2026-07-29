0# 📦 Guia Prático: Movimentação de Estoque

**Data:** Fevereiro 2026
**Foco:** O que você precisa implementar (resumo direto)

---

## 🎯 MOVIMENTAÇÃO DE ESTOQUE

### O Que Você Precisa

> "Uma área de entrada e saída de mercadorias para monitorar movimentação completa, além dos pedidos. Na saída, poder exportar um documento para importar na entrada da outra loja."

---

### ✅ Tipos de Movimentação que Você Precisa

| Tipo | Quando Usar | Impacto no Estoque | Documento Gerado |
|------|-------------|-------------------|------------------|
| **Venda** | Pedido do cliente / PDV | Baixa automática | Pedido |
| **Compra/Aquisição** | Recebimento de fornecedor | Entrada | NF de entrada |
| **Transferência Externa** | Loja A → Loja B | Saída em A, Entrada em B | **DTE** (Documento de Transferência) |
| **Transferência Interna** | Armário A → Balcão C (mesma loja) | Sem mudança no total | DTI |
| **Devolução Entrada** | Cliente devolve | Entrada | RMA |
| **Devolução Saída** | Devolve para fornecedor | Saída | NF devolução |
| **Perda** | Validade, dano, ajuste | Baixa | Termo de perda |
| **Zeramento** | Descontinuar produto | Zera saldo | Termo de descontinuação |

---

### 🔄 FLUXO PRINCIPAL: Transferência Entre Lojas

**Cenário que você descreveu:**
> "Depósito A tem 15 itens, vou enviar 10 para filial B. Produtos ficam reservados aguardando confirmação. Se recebeu → baixa definitiva. Se não recebeu → devolução automática."

```
┌─────────────────────────────────────────────────────────────────┐
│                    PASSO A PASSO                                │
└─────────────────────────────────────────────────────────────────┘

LOJA A (Origem)                          LOJA B (Destino)
     │                                         │
     │  1. Cria DTE                            │
     │     • Seleciona 10 produtos             │
     │     • Escolhe valores (aquisição/markup)│
     │     • Gera documento (PDF/JSON)         │
     │                                         │
     ├─────────────────────────────────────────►
     │         DTE #0042 (10 itens)            │
     │                                         │
     │  2. Status: "EM TRÂNSITO"               │
     │     • Produtos RESERVADOS               │
     │     • Não vende mais                    │
     │                                         │
     │                                         │  3. Importa DTE
     │                                         │     • Clica "Importar"
     │                                         │     • Carrega arquivo ou código
     │                                         │
     │                                         │  4. CONFERÊNCIA (obrigatória)
     │                                         │     • Digita quantidade recebida
     │                                         │     • Aceite total OU parcial
     │                                         │
     │  5. ← Notificação automática            │  6. Finaliza conferência
     │     "Loja B recebeu 8/10 itens"         │     • 8 completos
     │                                         │     • 1 parcial (30/50)
     │  7. BAIXA AUTOMÁTICA                    │     • 1 não recebido
     │     • 8 itens: baixa definitiva         │
     │     • 1 item: parcial (30 un.)          │
     │     • 1 item: estornado (volta estoque) │
     │                                         │
     │  Status final: "CONCLUÍDO"              │  Status: "RECEBIDO"
     └─────────────────────────────────────────┘
```

---

### 📋 O Que Implementar (Checklist)

#### Para a Loja que ENVIA (Origem)

- [ ] **Tela: Nova Transferência**
  - Selecionar loja de destino
  - Buscar/adicionar produtos
  - Informar quantidade
  - Escolher preço de transferência (último custo, médio, personalizado)
  - Botão: "Enviar para Loja B"

- [ ] **Status do DTE**
  - Rascunho → Enviado → Em Trânsito → Concluído
  - Ou: Cancelado / Devolvido

- [ ] **Reserva de Estoque**
  - Ao enviar: produto fica "reservado"
  - Não aparece como disponível para venda
  - Campo: `estoque_reservado` na tabela products

- [ ] **Exportar DTE**
  - Gerar PDF para impressão
  - Gerar JSON para envio digital
  - Código único do documento (ex: `DTE-2026-0042`)

#### Para a Loja que RECEBE (Destino)

- [ ] **Tela: Importar DTE**
  - Upload de arquivo JSON
  - Ou digitar código do DTE
  - Carrega lista de produtos esperados

- [ ] **Tela: Conferência Cega**
  - Mostra 1 produto por vez
  - Usuário **digita** quantidade recebida (não só confirma)
  - Opções: Recebido completo / Parcial / Não recebido
  - Campo para observação

- [ ] **Finalização**
  - Resumo da conferência
  - Botões: "Aceitar e Concluir" / "Aceitar Parcial" / "Recusar"
  - Ao confirmar: entrada automática no estoque

#### Para Ambos

- [ ] **Tela: Histórico de DTEs**
  - Lista todos os documentos
  - Filtros: período, status, loja
  - Visualizar detalhes de cada DTE

- [ ] **Notificações**
  - Loja A: "Seu DTE #0042 foi recebido"
  - Loja B: "Novo DTE #0042 recebido de Loja A"

---

### 🗄️ Estrutura do Banco de Dados

```sql
-- Documento de Transferência
CREATE TABLE transfer_documents (
  id UUID PRIMARY KEY,
  store_origin_id UUID REFERENCES stores(id),
  store_destiny_id UUID REFERENCES stores(id),
  document_number VARCHAR(50),  -- Ex: DTE-2026-0042
  status VARCHAR(50),           -- draft, sent, in_transit, received, cancelled
  total_value DECIMAL(10,2),
  created_by UUID REFERENCES store_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- Itens do Documento
CREATE TABLE transfer_items (
  id UUID PRIMARY KEY,
  transfer_id UUID REFERENCES transfer_documents(id),
  product_id UUID REFERENCES products(id),
  quantity_expected INTEGER,
  quantity_received INTEGER,      -- Preenchido na conferência
  unit_value DECIMAL(10,2),
  subtotal DECIMAL(10,2),
  status VARCHAR(50),             -- pending, received, partial, not_received
  observation TEXT
);

-- Movimentações de Estoque (todas)
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  product_id UUID REFERENCES products(id),
  movement_type VARCHAR(50),      -- sale, purchase, transfer_in, transfer_out, loss, adjustment
  quantity INTEGER,               -- Positivo = entrada, Negativo = saída
  balance_after INTEGER,          -- Saldo após movimentação
  reference_id UUID,              -- ID do documento relacionado (pedido, DTE, etc.)
  reference_type VARCHAR(50),     -- order, transfer, purchase, etc.
  user_id UUID REFERENCES store_users(id),
  observation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 🔑 PROBLEMA: IDs Diferentes entre Lojas

**Sua situação:**
> "Matriz: picolé chocolate = `k37unsao8y734` | Filial: mesmo produto = `867bhasd789ty3`"

#### ✅ Solução Recomendada: **Catálogo Global + Produtos Locais**

```
┌─────────────────────────────────────────────────────────────┐
│  ESTRUTURA RECOMENDADA                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  product_catalog (GLOBAL)                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ id: uuid_global_001                                 │   │
│  │ sku_global: PIC-CHOC-001                            │   │
│  │ nome_padrao: Picolé de Chocolate 50ml               │   │
│  │ descricao: Picolé tradicional de chocolate          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  store_products (LOCAL - por loja)                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Loja A:                                             │   │
│  │   id: k37unsao8y734                                 │   │
│  │   product_catalog_id: uuid_global_001               │   │
│  │   estoque: 150                                      │   │
│  │   preco_venda: 5.00                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Loja B:                                             │   │
│  │   id: 867bhasd789ty3                                │   │
│  │   product_catalog_id: uuid_global_001  ← MESMO ID!  │   │
│  │   estoque: 80                                       │   │
│  │   preco_venda: 5.50                                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Vantagens:**
- ✅ Transferência usa `product_catalog_id` como referência
- ✅ Cada loja tem seu preço e estoque
- ✅ Relatórios consolidados funcionam
- ✅ Não cria produtos duplicados

**Como migrar:**
1. Criar tabela `product_catalog`
2. Para cada produto único, criar entrada no catálogo
3. Vincular produtos existentes ao catálogo
4. Transferências passam a usar catálogo como referência

---

### 💰 PREÇO DE AQUISIÇÃO

**O que você pediu:**
> "Campo de valor de aquisição. Na transferência, usuário escolhe qual valor usar (aquisição ou aquisição + markup)."

#### Estrutura

```sql
-- Na tabela products, adicionar:
ALTER TABLE products ADD COLUMN ultimo_preco_aquisicao DECIMAL(10,2);
ALTER TABLE products ADD COLUMN preco_aquisicao_medio DECIMAL(10,2);

-- Histórico de preços de aquisição
CREATE TABLE acquisition_costs (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  store_id UUID REFERENCES stores(id),
  valor_aquisicao DECIMAL(10,2),
  fornecedor_id UUID,
  quantidade INTEGER,
  data_aquisicao DATE,
  nota_fiscal VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### UI: Escolha do Preço na Transferência

```
┌─────────────────────────────────────────────────────────────┐
│  Definir Valor da Transferência                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Produto: Picolé de Chocolate                               │
│  Quantidade: 50 unidades                                    │
│                                                             │
│  Origem do Preço:                                           │
│  ○ Último custo de aquisição (R$ 2,30)                      │
│  ● Custo médio (R$ 2,50)                                    │
│  ○ Personalizado: R$ [_____]                                │
│  ○ Custo + Markup: [10]%  ou  R$ [_____]                    │
│                                                             │
│  Valor Unitário: R$ 2,50                                    │
│  Valor Total: R$ 125,00                                     │
│                                                             │
│  [Confirmar]                                                │
└─────────────────────────────────────────────────────────────┘
```

---

### 🔘 BOTÕES DE ESTOQUE: Manter ou Remover?

**Sua dúvida:**
> "Devo tirar os botões de adicionar/subtrair do estoque? Ou crio botões de ação para movimentação?"

#### ✅ Recomendação: **Abordagem Híbrida**

**Manter botões rápidos, MAS:**
- Sempre gerar registro de movimentação
- Exigir motivo/justificativa
- Limitar por permissão (apenas gerentes)
- Movimentações complexas → área específica

```
┌─────────────────────────────────────────────────────────────┐
│  ESTOQUE - Picolé de Chocolate    Saldo: 150 un.            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [📝 Ajuste Rápido]    [🔄 Movimentação Completa]           │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  Histórico:                                                 │
│  • 20/02 - Venda #1234 (-20)                                │
│  • 19/02 - Transferência Loja B (-50)                       │
│  • 18/02 - Compra NF 456 (+200)                             │
└─────────────────────────────────────────────────────────────┘

MODAL "Ajuste Rápido":
┌─────────────────────────────────────────────────────────────┐
│  Ajuste de Estoque                                          │
├─────────────────────────────────────────────────────────────┤
│  Tipo: ○ Adicionar  ○ Remover                               │
│  Quantidade: [___]                                          │
│  Motivo: [Perda ▼] (Validade, Dano, Ajuste, Outro)          │
│  Observação: [_________________________________]            │
│                                                             │
│  [Cancelar]  [Confirmar]                                    │
└─────────────────────────────────────────────────────────────┘
→ Gera registro em stock_movements
→ Exige justificativa
→ Vai para log de auditoria
```

## 🎯 RESUMÃO: O Que Implementar (Prioridade)

### 🔴 ALTA PRIORIDADE (Faça Primeiro)

1. **Tabela `transfer_documents` e `transfer_items`**
2. **Tela: Nova Transferência** (Loja origem)
3. **Tela: Importar DTE** (Loja destino)
4. **Tela: Conferência Cega** (digitar quantidade)
5. **Reserva de estoque** (campo `estoque_reservado`)
6. **Catálogo global de produtos** (resolver IDs diferentes)

### 🟡 MÉDIA PRIORIDADE

7. **Tabela `stock_movements`** (histórico completo)
8. **Tela: Histórico de DTEs**
9. **Preço de aquisição** (campos em `products`)
10. **Ajuste rápido de estoque** (modal com motivo)
11. **Preço único vs. Por quantidade** (simplificar UI)

### 🟢 BAIXA PRIORIDADE (Deixe para Depois)

12. **Transferência interna** (setores da mesma loja)
13. **Devolução pós-recebimento**
14. **Notificações automáticas** (WhatsApp, email)
15. **Relatórios avançados de movimentação**

---

## 📊 FLUXO COMPLETO (Visão Geral)

```
┌─────────────────────────────────────────────────────────────┐
│                    MOVIMENTAÇÕES                            │
└─────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │   ESTOQUE       │
                    │   (produtos)    │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
   ┌──────────┐       ┌──────────┐       ┌──────────┐
   │ ENTRADA  │       │  SAÍDA   │       │  INTERNO │
   │          │       │          │       │          │
   │ • Compra │       │ • Venda  │       │ • Transf │
   │ • Devol. │       │ • Transf │       │   Interna│
   │   Entrada│       │ • Devol. │       │ • Ajuste │
   │ • Ajuste │       │   Saída  │       │ • Perda  │
   │          │       │ • Perda  │       │          │
   └────┬─────┘       └────┬─────┘       └────┬─────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ stock_movements │
                  │   (histórico)   │
                  └─────────────────┘
```

---

## ✅ CHECKLIST FINAL

### Movimentação

- [ ] Criar tabelas: `transfer_documents`, `transfer_items`, `stock_movements`
- [ ] Criar tabela: `product_catalog` (para IDs globais)
- [ ] Adicionar campos: `estoque_reservado`, `ultimo_preco_aquisicao`
- [ ] Tela: Nova Transferência (origem)
- [ ] Tela: Importar DTE (destino)
- [ ] Tela: Conferência Cega
- [ ] Tela: Histórico de DTEs
- [ ] Modal: Ajuste Rápido de Estoque
- [ ] Lógica: Reserva de estoque ao enviar
- [ ] Lógica: Baixa automática ao receber
- [ ] Lógica: Estorno se não recebido
- [ ] Exportar DTE (PDF + JSON)
- [ ] Notificações básicas

---

**Documento criado para:** Guia rápido de implementação
**Baseado em:** `PLANO_DE_NEGOCIOS.md` (Seções 4 e 4.4-4.6)
**Próximo passo:** Começar pela tabela `transfer_documents`
