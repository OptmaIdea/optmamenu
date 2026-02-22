# 👥👤💎 Guia Prático: Usuários, Clientes e Fidelidade

**Data:** Fevereiro 2026  
**Foco:** O que temos vs. O que precisamos implementar

---

## 📊 RESUMO RÁPIDO

| Área | Status | Prioridade |
|------|--------|------------|
| **Usuários (Staff)** | ❌ Não implementado | 🔴 Alta |
| **Clientes** | 🟡 Parcial (falta endereço via CEP) | 🔴 Alta |
| **Fidelidade** | 🟡 Parcial (falta migração nova estrutura) | 🟡 Média |

---

## 🎯 PARTE 1: USUÁRIOS (Staff da Loja)

### O Que Temos

| Item | Status |
|------|--------|
| **Tabela `profiles`** | ✅ Existe (mas é genérica) |
| **Campo `is_admin`** | ✅ Existe (booleano simples) |
| **Tela Users.tsx** | ⚠️ Placeholder ("Em breve") |
| **Autenticação** | ✅ Supabase Auth (email/senha) |

### O Que Precisamos

#### 1. Estrutura de Banco de Dados

**Problema atual:** `profiles` mistura clientes e staff, sem controle de permissões.

**Solução proposta:**

```sql
-- Tabela de usuários da store (staff)
CREATE TABLE store_users (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  auth_user_id UUID REFERENCES auth.users(id),
  role VARCHAR(50) NOT NULL,  -- owner, admin, manager, attendant, viewer
  nome VARCHAR(200),
  email VARCHAR(255),
  phone VARCHAR(20),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- Tabela de permissões granulares (opcional)
CREATE TABLE permissions (
  id UUID PRIMARY KEY,
  role VARCHAR(50),
  resource VARCHAR(100),  -- products, orders, customers, finance
  action VARCHAR(50),     -- create, read, update, delete
  UNIQUE(role, resource, action)
);

-- Tabela de logs de auditoria
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  user_id UUID REFERENCES store_users(id),
  action VARCHAR(100),
  resource_type VARCHAR(50),
  resource_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. Tipos de Usuário (Roles)

| Role | Acesso |
|------|--------|
| **Owner** | Dono da loja - acesso total |
| **Admin** | Gerente - quase total (exceto excluir loja) |
| **Manager** | Supervisor - operacional completo |
| **Attendant** | Atendente/Caixa - PDV e pedidos |
| **Viewer** | Apenas leitura |

#### 3. Telas que Precisamos Criar

```
┌─────────────────────────────────────────────────────────────┐
│  USUÁRIOS - Checklist de Implementação                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  □ Tela: Listagem de Usuários                               │
│    • Tabela com nome, email, role, status, último acesso    │
│    • Busca por nome/email                                   │
│    • Filtros: role, status (ativo/inativo)                  │
│    • Ações: editar, desativar, reenviar convite             │
│                                                             │
│  □ Tela: Novo Usuário                                       │
│    • Nome, email, telefone                                  │
│    • Selecionar role (dropdown)                             │
│    • Permissões customizadas (opcional)                     │
│    • Enviar convite por email                               │
│                                                             │
│  □ Modal: Editar Usuário                                    │
│    • Alterar dados cadastrais                               │
│    • Mudar role                                             │
│    • Resetar senha                                          │
│    • Desativar/reativar                                     │
│                                                             │
│  □ Tela: Logs de Auditoria                                  │
│    • Filtros: período, usuário, ação                        │
│    • Exportar CSV                                           │
│                                                             │
│  □ Componente: Seletor de Permissões                        │
│    • Checkboxes por recurso (produtos, pedidos, etc.)       │
│    • Matriz visual (role × ação)                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 4. Fluxo de Convite

```
1. Admin clica "Novo Usuário"
   ↓
2. Preenche: nome, email, role
   ↓
3. Sistema gera token de convite (7 dias)
   ↓
4. Email enviado para convidado
   ↓
5. Convidado clica no link
   ↓
6. Define senha e completa cadastro
   ↓
7. Acesso liberado conforme role
```

---

## 🎯 PARTE 2: CLIENTES

### O Que Temos

| Item | Status | Detalhes |
|------|--------|----------|
| **Tabela `customers`** | ✅ Existe | Campos: full_name, nickname, phone, email, birth_date, cpf, loyalty_points, loyalty_tier |
| **Tabela `customer_addresses`** | ✅ Existe | Campos: street, number, district, city, state, zip_code, complement |
| **Tela Customers.tsx** | ✅ Existe | Listagem, busca, visualização de detalhes |
| **CustomerService** | ✅ Existe | CRUD de endereços, notificações, consentimento |
| **Autenticação** | 🟡 Parcial | Phone + OTP (precisa integrar com seu complemento SMS) |

### O Que Precisamos

#### 1. Endereço via CEP (Prioridade 🔴)

**Problema atual:**
> "Preciso da forma que usamos primeiro via CEP. Não tendo CEP correto, via UF e relação de municípios."

**Solução: Integração com ViaCEP + Fallback manual**

```typescript
// services/addressService.ts
interface AddressData {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
}

export const addressService = {
  // Busca por CEP
  async fetchByCEP(cep: string): Promise<AddressData | null> {
    try {
      const cleanCep = cep.replace(/\D/g, '');
      if (cleanCep.length !== 8) return null;

      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (data.erro) return null;
      return data;
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      return null;
    }
  },

  // Busca municípios por UF
  async fetchCitiesByUF(uf: string): Promise<string[]> {
    try {
      const response = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
      );
      const data = await response.json();
      return data.map((m: any) => m.nome).sort();
    } catch (error) {
      console.error('Erro ao buscar municípios:', error);
      return [];
    }
  },

  // Busca UFs
  async fetchStates(): Promise<string[]> {
    return ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
            'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
            'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
  }
};
```

#### 2. UI de Cadastro de Endereço

```
┌─────────────────────────────────────────────────────────────┐
│  Novo Endereço                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CEP: [00000-000]  [🔍 Buscar]                              │
│       ← Ao digitar 8 dígitos, busca automática              │
│                                                             │
│  Se CEP encontrado:                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Logradouro: [Rua das Flores________________] (auto) │   │
│  │ Bairro:     [Centro_________________________] (auto)│   │
│  │ Cidade:     [São João Nepomuceno___________] (auto) │   │
│  │ UF:         [MG] (auto)                             │   │
│  │ Número:     [_______]                               │   │
│  │ Complemento:[___________________________] (opcional)│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Se CEP NÃO encontrado:                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ UF:         [MG ▼]                                  │   │
│  │ Cidade:     [São João Nepomuceno ▼]                 │   │
│  │             ← Carrega lista do IBGE                 │   │
│  │ Bairro:     [Centro_________________________]       │   │
│  │ Logradouro: [Rua das Flores________________]        │   │
│  │ Número:     [_______]                               │   │
│  │ CEP:        [00000-000] (opcional)                  │   │
│  │ Complemento:[___________________________] (opcional)│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ☑ Definir como endereço principal                          │
│                                                             │
│  [Cancelar]  [Salvar Endereço]                              │
└─────────────────────────────────────────────────────────────┘
```

#### 3. Validação de Endereço (Evitar Duplicidades)

**Problema:**
> "Não quero adivinhar que o bairro digitado de 3 formas diferentes é o mesmo."

**Soluções:**

| Estratégia | Implementação |
|------------|---------------|
| **CEP obrigatório** | Ideal, mas nem sempre disponível |
| **Normalização** | Converter tudo para maiúsculo, remover acentos |
| **Sugestão de similares** | Buscar endereços parecidos antes de salvar |
| **Validação cruzada** | CEP + Número = endereço único |

**Código de normalização:**

```typescript
// utils/addressUtils.ts
export function normalizeAddress(address: {
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  zip_code?: string;
}): string {
  // Cria uma "chave única" para o endereço
  const parts = [
    address.zip_code?.replace(/\D/g, '') || '',
    address.street.toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
    address.number.toUpperCase().trim(),
    address.district.toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
    address.city.toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
    address.state.toUpperCase().trim()
  ];

  return parts.filter(p => p).join('|');
}

// Antes de salvar, verifica se já existe
export async function checkDuplicateAddress(
  customerId: string,
  newAddress: any
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('customer_id', customerId);

  const newKey = normalizeAddress(newAddress);

  return existing?.some(addr => normalizeAddress(addr) === newKey) || false;
}
```

#### 4. Checklist de Implementação

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENTES - Checklist                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  □ Serviço: addressService                                  │
│    • Integração ViaCEP                                      │
│    • Busca de municípios por UF (IBGE)                      │
│    • Lista de UFs                                           │
│                                                             │
│  □ Componente: AddressForm                                  │
│    • Campo CEP com busca automática                         │
│    • Fallback: UF + Município (dropdown)                    │
│    • Campos manuais (número, complemento)                   │
│    • Validação de duplicidade                               │
│                                                             │
│  □ Componente: AddressList                                  │
│    • Lista de endereços do cliente                          │
│    • Marcar/desmarcar como principal                        │
│    • Editar/excluir endereço                                │
│                                                             │
│  □ Modal: Cliente Detalhes                                  │
│    • Adicionar botão "Novo Endereço"                        │
│    • Integrar AddressForm                                   │
│                                                             │
│  □ Autenticação de Clientes                                 │
│    • Integrar com seu complemento de SMS                    │
│    • Fallback para WhatsApp                                 │
│    • Token válido 15 minutos                                │
│    • Máximo 3 tentativas                                    │
│                                                             │
│  □ Campos Adicionais (já existem)                           │
│    • CPF (com validação)                                    │
│    • Data de nascimento                                     │
│    • Consentimento de marketing                             │
│    • Tags (opcional)                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 PARTE 3: FIDELIDADE

### O Que Temos

| Item | Status | Detalhes |
|------|--------|----------|
| **Tabela `fidelity_programs`** | ✅ Existe | Configurações do programa |
| **Tabela `loyalty_transactions`** | ✅ Existe | Histórico de pontos |
| **Tabela `rewards`** | ✅ Existe | Prêmios/resgates |
| **Tabela `customer_vouchers`** | ✅ Existe | Vouchers resgatados |
| **Tela LoyaltyConfig.tsx** | ✅ Existe | Configurações completas |
| **Componentes** | ✅ Existem | LevelsConfig, CategoryRules, RewardsConfig, etc. |

### Estrutura Atual (tipos/loyalty.ts)

```typescript
interface FidelityProgram {
  id: string;
  name: string;
  is_active: boolean;
  points_per_currency: number;        // 1 ponto por R$ 1,00
  min_order_value: number;
  
  enable_join_bonus: boolean;
  join_bonus_points: number;
  
  enable_birthday_bonus: boolean;
  birthday_bonus_points: number;
  
  enable_cashback: boolean;
  
  // Sistema de Selos
  enable_stamps: boolean;
  min_order_for_stamp: number;        // Acima de R$ X ganha 1 selo
  stamps_target: number;              // Juntar Y selos = Z pontos
  points_per_stamp_block: number;
  
  points_validity_months: number;
  min_points_redemption: number;
  
  // Avisos de expiração
  warn_voucher_expiry_1: number;      // 7 dias antes
  warn_voucher_expiry_2: number;      // 3 dias antes
  warn_voucher_expiry_3: number;      // 1 dia antes
}
```

### O Que Precisamos

#### 1. Migração da Estrutura Antiga → Nova

**Problema:**
- `profiles.loyalty_points` (antigo)
- `loyalty_transactions` (antigo, linked to profiles)
- Nova estrutura usa `customers` e `fidelity_programs`

**Solução:**

```sql
-- Migração de pontos antigos
UPDATE customers c
SET loyalty_points = COALESCE((
  SELECT SUM(lt.amount)
  FROM loyalty_transactions lt
  JOIN profiles p ON p.id = lt.user_id
  WHERE p.phone = c.phone_number
), 0);

-- Migrar transações antigas (se necessário)
INSERT INTO customer_loyalty_transactions (
  customer_id,
  order_id,
  points,
  type,
  description,
  created_at
)
SELECT 
  c.id,
  lt.order_id,
  lt.amount,
  CASE 
    WHEN lt.amount > 0 THEN 'earn'
    ELSE 'redeem'
  END,
  lt.description,
  lt.created_at
FROM loyalty_transactions lt
JOIN profiles p ON p.id = lt.user_id
JOIN customers c ON c.phone_number = p.phone;
```

#### 2. Funcionalidades que Precisam de Ajuste

| Funcionalidade | Status | Ajuste Necessário |
|----------------|--------|-------------------|
| **Pontos por compra** | 🟡 | Vincular ao `customer_id` no pedido |
| **Bônus de aniversário** | ✅ | Já existe, precisa de job automático |
| **Bônus de adesão** | ✅ | Já existe |
| **Sistema de selos** | 🟡 | Implementar contagem automática |
| **Níveis VIP** | 🟡 | Componente LevelsConfig existe, precisa integrar |
| **Regras por categoria** | 🟡 | Componente CategoryRules existe |
| **Prêmios/Resgates** | 🟡 | RewardsConfig existe, precisa de fluxo de resgate |
| **Vouchers** | 🟡 | Gerar e enviar por WhatsApp/SMS |

#### 3. Fluxo de Resgate de Prêmios

```
┌─────────────────────────────────────────────────────────────┐
│  RESGATE DE PRÊMIOS                                         │
└─────────────────────────────────────────────────────────────┘

CLIENTE (App/Menu)                         LOJA (Painel)
     │                                          │
     │  1. Acessa área de fidelidade            │
     │     • Vê saldo de pontos                 │
     │     • Vê prêmios disponíveis             │
     │                                          │
     │  2. Escolhe prêmio                       │
     │     • Picolé Grátis (100 pts)            │
     │     • Desconto 10% (50 pts)              │
     │                                          │
     ├──────────────────────────────────────────►
     │         Confirma resgate                 │
     │                                          │
     │  3. Voucher gerado                       │
     │     • Código: ABC123                     │
     │     • Validade: 30 dias                  │
     │     • QR Code para loja                  │
     │                                          │
     │  4. Recebe no WhatsApp/SMS               │
     │     "Você resgatou: Picolé Grátis"       │
     │                                          │
     │                                          │  5. ← Notificação
     │                                          │    "Cliente X resgatou prêmio"
     │                                          │
     │  6. Vai à loja e mostra voucher          │
     │                                          │
     │                                          │  7. Valida voucher
     │                                          │     • Escaneia QR Code
     │                                          │     • Ou digita código
     │                                          │
     │                                          │  8. Voucher marcado como "USADO"
     │                                          │     • Baixa pontos do cliente
     │                                          │     • Registra transação
     │                                          │
     │  9. Recebe prêmio                        │
     │                                          │
```

#### 4. Checklist de Implementação

```
┌─────────────────────────────────────────────────────────────┐
│  FIDELIDADE - Checklist                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  □ Migração de Dados                                        │
│    • Migrar pontos de profiles para customers               │
│    • Migrar transações antigas                              │
│    • Validar consistência                                   │
│                                                             │
│  □ Integração com Pedidos                                   │
│    • Ao finalizar pedido → calcular pontos                  │
│    • Verificar regras por categoria                         │
│    • Atualizar saldo do cliente                             │
│    • Gerar transação em customer_loyalty_transactions       │
│                                                             │
│  □ Sistema de Selos                                         │
│    • Contador de selos por cliente                          │
│    • Acumular selos a cada R$ X                             │
│    • Converter Y selos → Z pontos automaticamente           │
│                                                             │
│  □ Níveis VIP                                               │
│    • Componente LevelsConfig (já existe)                    │
│    • Calcular nível baseado em pontos ou gastos             │
│    • Benefícios automáticos por nível                       │
│    • Exibir nível no perfil do cliente                      │
│                                                             │
│  □ Prêmios/Resgates                                         │
│    • RewardsConfig (já existe)                              │
│    • Tela de resgate (cliente)                              │
│    • Validação de voucher (loja)                            │
│    • Baixa automática de pontos                             │
│                                                             │
│  □ Comunicações                                             │
│    • Enviar voucher por WhatsApp/SMS                        │
│    • Avisos de expiração (7, 3, 1 dia)                      │
│    • Aniversário (bônus automático)                         │
│    • Mudança de nível                                       │
│                                                             │
│  □ Relatórios                                               │
│    • Pontos emitidos vs. resgatados                         │
│    • Prêmios mais resgatados                                │
│    • Clientes por nível                                     │
│    • ROI do programa                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ ESTRUTURA DE BANCO DE DADOS COMPLETA

### Usuários (Staff)

```sql
-- Tabela principal
CREATE TABLE store_users (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  auth_user_id UUID REFERENCES auth.users(id),
  role VARCHAR(50) NOT NULL,  -- owner, admin, manager, attendant, viewer
  nome VARCHAR(200),
  email VARCHAR(255),
  phone VARCHAR(20),
  avatar_url TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, email)
);

-- Permissões granulares
CREATE TABLE permissions (
  id UUID PRIMARY KEY,
  role VARCHAR(50),
  resource VARCHAR(100),
  action VARCHAR(50),
  UNIQUE(role, resource, action)
);

-- Logs de auditoria
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  user_id UUID REFERENCES store_users(id),
  action VARCHAR(100),
  resource_type VARCHAR(50),
  resource_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convites pendentes
CREATE TABLE user_invitations (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  email VARCHAR(255),
  role VARCHAR(50),
  token UUID UNIQUE,
  expires_at TIMESTAMPTZ,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Clientes

```sql
-- Tabela principal (já existe, ajustes)
CREATE TABLE customers (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  full_name VARCHAR(200),
  nickname VARCHAR(100),
  phone_number VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  cpf VARCHAR(14),
  birth_date DATE,
  loyalty_points INTEGER DEFAULT 0,
  loyalty_tier VARCHAR(50),  -- Bronze, Prata, Ouro
  loyalty_stamps INTEGER DEFAULT 0,
  marketing_consent BOOLEAN DEFAULT FALSE,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, phone_number)
);

-- Endereços (já existe, adicionar validação)
CREATE TABLE customer_addresses (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  zip_code VARCHAR(10),
  street VARCHAR(200),
  number VARCHAR(20),
  complement VARCHAR(100),
  district VARCHAR(100),
  city VARCHAR(100),
  state VARCHAR(2),
  label VARCHAR(50),  -- Casa, Trabalho, etc.
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (zip_code IS NOT NULL AND LENGTH(REPLACE(zip_code, '-', '')) = 8) OR
    (street IS NOT NULL AND city IS NOT NULL AND state IS NOT NULL)
  )
);

-- Consentimentos (LGPD)
CREATE TABLE customer_consent_logs (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  consent_type VARCHAR(50),  -- marketing, terms, privacy
  action VARCHAR(20),        -- granted, revoked
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notificações
CREATE TABLE customer_notifications (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  store_id UUID REFERENCES stores(id),
  title VARCHAR(200),
  message TEXT,
  type VARCHAR(20),  -- info, success, warning, error
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Fidelidade

```sql
-- Programa de fidelidade (já existe)
CREATE TABLE fidelity_programs (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  name VARCHAR(200),
  is_active BOOLEAN DEFAULT FALSE,
  points_per_currency DECIMAL(5,2) DEFAULT 1.00,
  min_order_value DECIMAL(10,2) DEFAULT 0,
  enable_join_bonus BOOLEAN DEFAULT FALSE,
  join_bonus_points INTEGER DEFAULT 0,
  enable_birthday_bonus BOOLEAN DEFAULT FALSE,
  birthday_bonus_points INTEGER DEFAULT 0,
  enable_cashback BOOLEAN DEFAULT FALSE,
  enable_stamps BOOLEAN DEFAULT FALSE,
  min_order_for_stamp DECIMAL(10,2) DEFAULT 0,
  stamps_target INTEGER DEFAULT 0,
  points_per_stamp_block INTEGER DEFAULT 0,
  points_validity_months INTEGER DEFAULT 12,
  min_points_redemption INTEGER DEFAULT 0,
  warn_voucher_expiry_1 INTEGER DEFAULT 7,
  warn_voucher_expiry_2 INTEGER DEFAULT 3,
  warn_voucher_expiry_3 INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transações de pontos
CREATE TABLE customer_loyalty_transactions (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  order_id UUID REFERENCES orders(id),
  points INTEGER NOT NULL,
  type VARCHAR(20),  -- earn, redeem, bonus, adjustment
  description TEXT,
  balance_after INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Níveis VIP
CREATE TABLE loyalty_tiers (
  id UUID PRIMARY KEY,
  program_id UUID REFERENCES fidelity_programs(id),
  name VARCHAR(100),
  min_points INTEGER,
  min_spending DECIMAL(10,2),
  benefits JSONB,  -- { discount: 0.10, free_delivery: true }
  icon_url TEXT,
  color VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Regras por categoria
CREATE TABLE loyalty_category_rules (
  id UUID PRIMARY KEY,
  program_id UUID REFERENCES fidelity_programs(id),
  category_id UUID REFERENCES categories(id),
  points_multiplier DECIMAL(5,2) DEFAULT 1.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, category_id)
);

-- Prêmios
CREATE TABLE rewards (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  program_id UUID REFERENCES fidelity_programs(id),
  title VARCHAR(200),
  description TEXT,
  points_cost INTEGER,
  additional_cash_cost DECIMAL(10,2) DEFAULT 0,
  image_url TEXT,
  type VARCHAR(50),  -- product, discount, voucher
  stock_quantity INTEGER,
  max_redemptions_per_customer INTEGER,
  offer_valid_until TIMESTAMPTZ,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vouchers resgatados
CREATE TABLE customer_vouchers (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  reward_id UUID REFERENCES rewards(id),
  code VARCHAR(20) UNIQUE,
  status VARCHAR(20),  -- active, used, expired
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📋 RESUMÃO: O Que Fazer Primeiro

### 🔴 PRIORIDADE 1 (Essencial)

```
□ Integrar ViaCEP no cadastro de endereços
□ Fallback: UF + Município (dropdown do IBGE)
□ Validação de duplicidade de endereços
□ Autenticação de clientes (OTP SMS/WhatsApp)
□ Tela de Usuários (listagem + CRUD básico)
```

### 🟡 PRIORIDADE 2 (Importante)

```
□ Migração: profiles → customers (fidelidade)
□ Sistema de convites para usuários (email)
□ Roles e permissões (RBAC)
□ Logs de auditoria
□ Integração pontos por compra
```

### 🟢 PRIORIDADE 3 (Depois)

```
□ Sistema de selos automático
□ Níveis VIP com benefícios
□ Resgate de prêmios (fluxo completo)
□ Validação de vouchers na loja
□ Relatórios de fidelidade
□ Notificações automáticas (aniversário, expiração)
```

---

## 🔗 PRÓXIMOS PASSOS

1. **Endereço via CEP:** Criar componente `AddressForm` com ViaCEP
2. **Usuários:** Implementar tela `Users.tsx` com CRUD
3. **Migração Fidelidade:** Script SQL para migrar dados antigos
4. **OTP SMS:** Integrar com seu complemento existente

---

**Documento criado para:** Guia de implementação  
**Baseado em:** Análise do código atual + requisitos  
**Próximo passo:** Começar pelo endereço via CEP
