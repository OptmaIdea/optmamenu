# 📋 Resumo Executivo - Novas Funcionalidades OptmaMenu SaaS

**Data:** Fevereiro 2026  
**Documento Completo:** `PLANO_DE_NEGOCIOS.md`

---

## 🎯 Novidades Incluídas neste Plano

Este documento resume as **3 grandes seções novas** adicionadas ao plano de negócios:

1. [Painel Super Admin](#1-painel-super-admin)
2. [Exclusão de Contas e Backup](#2-exclusão-de-contas-e-backup)
3. [Estratégia Offline/Híbrida](#3-estratégia-offlinehíbrida)

---

## 1. Painel Super Admin

### O Que É

Uma área **exclusiva para você (dono do SaaS)** monitorar todas as stores cadastradas, seu uso, saúde financeira e status operacional.

### Funcionalidades Principais

| Funcionalidade | Descrição |
|----------------|-----------|
| **Dashboard Geral** | Visão de todas as stores (ativas, teste, inativas), MRR, churn, LTV, NPS |
| **Listagem de Stores** | Filtros por status, plano, busca por nome/CNPJ |
| **Detalhes da Store** | Informações completas, métricas de uso, financeiro, usuários |
| **Monitoramento de Uso** | Pedidos/mês, armazenamento, usuários ativos, API calls |
| **Alertas Automáticos** | Pagamento atrasado, excedeu limite, solicitação de exclusão |
| **Ações Administrativas** | Ver logs, resetar senha, bloquear, exportar dados |

### Estrutura Técnica (Supabase)

```sql
-- Tabela principal de métricas
CREATE TABLE store_usage_metrics (
  store_id UUID,
  metric_date DATE,
  pedidos_count INTEGER,
  produtos_count INTEGER,
  vendas_total DECIMAL,
  storage_bytes BIGINT,
  api_calls_count INTEGER
);

-- Logs do Super Admin
CREATE TABLE super_admin_logs (
  admin_user_id UUID,
  action VARCHAR,
  target_store_id UUID,
  details JSONB
);
```

### Wireframe do Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  OPTMAMENU SAAS - Painel Super Admin                        │
├─────────────────────────────────────────────────────────────┤
│  📊 RESUMO                                                  │
│  Stores: 247 │ Ativas: 189 │ MRR: R$ 28.450 │ Churn: 3.2%  │
│                                                             │
│  ⚠️ ALERTAS                                                 │
│  • 3 stores com pagamento atrasado                          │
│  • 1 store excedeu limite de pedidos                        │
│  • 5 stores solicitaram exclusão                            │
└─────────────────────────────────────────────────────────────┘
```

### Por Que Você Precisa Disso

- ✅ **Tomada de decisão baseada em dados**
- ✅ **Identificação proativa de problemas** (churn, inadimplência)
- ✅ **Visão completa do negócio**
- ✅ **Auditoria e compliance**

---

## 2. Exclusão de Contas e Backup

### Fluxo de Exclusão (15 Dias)

```
Dia 0: Solicitação
  ↓
Dia 1-14: Período de graça (pode cancelar)
  ↓
Dia 15: Exclusão definitiva
```

### Funcionalidades

| Item | Descrição |
|------|-----------|
| **Período de graça** | 15 dias para o lojista arrepender-se |
| **Backup automático** | JSON + CSV enviado por email |
| **Acesso restrito** | Somente leitura durante período de graça |
| **Cancelamento fácil** | 1 clique para reativar conta |
| **Exclusão em cascata** | Remove todos os dados de forma segura |
| **Retenção legal** | Backup mantido por 5 anos (LGPD) |

### Estrutura Técnica

```sql
-- Controle de exclusões
CREATE TABLE deletion_requests (
  store_id UUID,
  requested_at TIMESTAMPTZ,
  scheduled_deletion_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  status VARCHAR -- pending, cancelled, completed
);

-- Log permanente de exclusões
CREATE TABLE deleted_stores_log (
  store_id UUID,
  deleted_at TIMESTAMPTZ,
  backup_path TEXT,
  retention_until TIMESTAMPTZ  -- 5 anos
);

-- Funções armazenadas
soft_delete_store(store_id)   -- Inicia processo
hard_delete_store(store_id)   -- Executa após 15 dias
```

### Email de Backup (Template)

```
Assunto: 📦 Seu backup OptmaMenu está pronto

Olá, João!

Seu backup está disponível:
• Store: Sorveteria Doce Sabor
• Data: 20/02/2026
• Tamanho: 2.3 MB
• Formato: JSON + CSV

[Baixar Backup] (válido por 7 dias)

⚠️ Guarde em local seguro!
```

### UI de Cancelamento de Exclusão

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️ SUA CONTA SERÁ EXCLUÍDA EM 12 DIAS                      │
│                                                             │
│  Data prevista: 05/03/2026                                  │
│                                                             │
│  Durante este período:                                      │
│  ✓ Acesso somente leitura                                   │
│  ✓ Backup sendo preparado                                   │
│  ✓ Pode cancelar a qualquer momento                         │
│                                                             │
│  [🔄 Cancelar Exclusão]  [📥 Baixar Backup]                 │
└─────────────────────────────────────────────────────────────┘
```

### Por Que Isso É Importante

- ✅ **Conformidade LGPD** (direito ao esquecimento)
- ✅ **Transparência com o cliente**
- ✅ **Redução de chargebacks** (cancelamento fácil)
- ✅ **Segurança jurídica** (backup e logs)

---

## 3. Estratégia Offline/Híbrida

### O Problema

- Internet instável em algumas regiões
- Quedas de energia
- Clientes em áreas rurais ou eventos
- **Risco:** Lojista usa offline para não pagar assinatura

### Soluções Propostas

#### Opção A: PWA Offline-First (Recomendada para início)

**Como funciona:**
- Aplicação web que funciona sem internet
- Dados salvos localmente (IndexedDB)
- Sincroniza quando volta a internet

**Limites para prevenir fraude:**
- Máximo **7 dias offline**
- Máximo **200 pedidos offline**
- Força sincronização ao reconectar

**Código exemplo:**
```typescript
class SyncService {
  async sync() {
    // 1. Envia pedidos pendentes
    // 2. Baixa atualizações da nuvem
    // 3. Resolve conflitos (último timestamp vence)
  }
}
```

#### Opção B: OptmaMenu Box (Hardware Dedicado)

**Conceito:**
- Celular recondicionado que você fornece
- Roda o sistema localmente (Node.js + SQLite)
- Sync automático com nuvem quando tem internet

**Modelo de Negócio:**
| Item | Valor |
|------|-------|
| Celular (uma vez) | R$ 299 |
| Licença Professional + Box | R$ 199/mês |
| Seguro opcional | R$ 29/mês |
| Substituição (danos) | R$ 150 |

**Vantagens:**
- ✅ Funciona em área rural
- ✅ Imune a queda de energia/internet
- ✅ Mais rápido (dados locais)

**Desvantagens:**
- ❌ Custo de hardware
- ❌ Logística de envio/troca
- ❌ Risco de dano/roubo

### Arquitetura Híbrida

```
┌─────────────────┐         ┌─────────────────┐
│   NUVEM         │         │   DISPOSITIVO   │
│   (Supabase)    │◄───────►│   LOCAL         │
│                 │  Sync   │   (PWA/SQLite)  │
│ • Dados mestre  │         │ • Cache         │
│ • Backup        │         │ • Fila de ops   │
└─────────────────┘         └─────────────────┘
```

### Fluxo de Sincronização

```
1. Detecta conexão
   ↓
2. Envia operações pendentes (pedidos, ajustes)
   ↓
3. Baixa atualizações da nuvem
   ↓
4. Resolve conflitos
   ↓
5. Atualiza cache local
   ↓
6. Notifica: "✓ 23 pedidos sincronizados"
```

### Tabela de Controle de Licenças Offline

```sql
CREATE TABLE offline_licenses (
  store_id UUID,
  device_id VARCHAR(100),
  last_sync TIMESTAMPTZ,
  offline_orders_count INTEGER,
  max_offline_days INTEGER DEFAULT 7,
  max_offline_orders INTEGER DEFAULT 200,
  status VARCHAR DEFAULT 'active'
);
```

### Recomendação Final

| Situação do Cliente | Solução |
|---------------------|---------|
| Internet boa | Nuvem 100% |
| Internet instável | Híbrido (PWA + sync) |
| Área rural/eventos | OptmaMenu Box |
| Orçamento limitado | Celular próprio + modo offline |

**Roadmap sugerido:**
1. Comece com **PWA offline-first** (sem custo de hardware)
2. Ofereça **Box como upgrade** (R$ 299 + assinatura)
3. Limite uso offline (7 dias, 200 pedidos)

### Por Que Implementar Isso

- ✅ **Amplia mercado** (atende áreas rurais)
- ✅ **Resiliência** (funciona sem internet)
- ✅ **Diferencial competitivo**
- ✅ **Proteção contra fraude** (limites + validação)

---

## 📊 Comparação: Antes vs. Depois

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Visão do SaaS** | Sem monitoramento | Dashboard completo com métricas |
| **Exclusão de conta** | Não tratado | Fluxo de 15 dias com backup |
| **Offline** | Não suportado | PWA + Box com prevenção de fraude |
| **Backup** | Manual | Automático + sob demanda |
| **LGPD** | Parcial | Completa (exclusão + retenção) |

---

## 🚀 Próximos Passos Sugeridos

### Fase 1 (Imediato)
- [ ] Implementar painel Super Admin básico
- [ ] Criar tabela `store_usage_metrics`
- [ ] Edge Function para coleta automática de métricas

### Fase 2 (2-4 semanas)
- [ ] Fluxo de solicitação de exclusão
- [ ] Funções `soft_delete_store` e `hard_delete_store`
- [ ] Template de email de backup
- [ ] UI de cancelamento de exclusão

### Fase 3 (4-8 semanas)
- [ ] PWA com IndexedDB
- [ ] Serviço de sync offline/online
- [ ] Validação de licença offline
- [ ] Limites de uso offline

### Fase 4 (Futuro)
- [ ] OptmaMenu Box (hardware)
- [ ] App React Native
- [ ] Sync bidirecional avançado

---

## 📞 Dúvidas?

Consulte o documento completo: `docs/PLANO_DE_NEGOCIOS.md`

**Seções relacionadas:**
- Seção 15: Painel Super Admin (detalhes completos)
- Seção 16: Exclusão de Contas (fluxos, SQL, templates)
- Seção 17: Estratégia Offline (arquitetura, código, prevenção de fraude)

---

**Resumo criado em:** Fevereiro 2026  
**Versão:** 1.0
