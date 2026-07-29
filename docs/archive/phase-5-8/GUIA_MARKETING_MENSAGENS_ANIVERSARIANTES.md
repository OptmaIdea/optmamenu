# 📢💎 Guia Prático: Marketing, Mensagens e Aniversariantes

**Data:** Fevereiro 2026  
**Foco:** Central de Mensagens + Aniversariantes + Dicas Técnicas

---

## 🎯 PARTE 1: CENTRAL DE MENSAGENS (Marketing)

### O Que Temos

| Item | Status | Detalhes |
|------|--------|----------|
| **Tabela `store_messages`** | ✅ Existe | Histórico de mensagens enviadas |
| **Tela Messages.tsx** | ✅ Existe | Compositor + Histórico |
| **Função `send_admin_message`** | ✅ Existe | RPC para enviar mensagens |
| **NotificationService** | ✅ Existe | Push, WhatsApp, Web Push |
| **NotificationReceiver** | ✅ Existe | Componente de recebimento |

### O Que Precisamos

#### 1. Mini Central de Mensagens (Consolidada)

**Problema atual:**
> "Não sei se seria o caso de criar uma mini central de mensagens aqui"

**Solução:** **SIM!** Criar uma central consolidada com:
- ✅ Mensagens manuais (já existe)
- ✅ Campanhas automáticas (aniversário, reativação)
- ✅ Agendamento de envios
- ✅ Templates salvos
- ✅ Relatórios de entrega/abertura

```
┌─────────────────────────────────────────────────────────────┐
│  CENTRAL DE MENSAGENS - Estrutura                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📝 NOVA MENSAGEM                                    │   │
│  │  • Compor manualmente                                │   │
│  │  • Escolher destinatários (todos/selecionados)       │   │
│  │  • Agendar envio                                     │   │
│  │  • Salvar como template                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🎯 CAMPANHAS AUTOMÁTICAS                            │   │
│  │  • Aniversariantes (diário/semanal/mensal)           │   │
│  │  • Clientes inativos (30/60/90 dias)                 │   │
│  │  • Pós-compra (feedback)                             │   │
│  │  • Promoção relâmpago                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📊 HISTÓRICO & RELATÓRIOS                           │   │
│  │  • Mensagens enviadas                                │   │
│  │  • Taxa de abertura/clique                           │   │
│  │  • Conversões                                        │   │
│  │  • Templates salvos                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 2. Estrutura de Banco de Dados

```sql
-- Templates de mensagens
CREATE TABLE message_templates (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  name VARCHAR(200),
  title VARCHAR(200),
  message TEXT,
  type VARCHAR(50),  -- promo, birthday, reactivation, feedback
  channels TEXT[],   -- push, whatsapp, sms, email
  variables TEXT[],  -- {nome}, {data}, {valor}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campanhas automáticas
CREATE TABLE automated_campaigns (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  name VARCHAR(200),
  type VARCHAR(50),  -- birthday, inactive, post_purchase
  trigger_config JSONB,  -- { days_inactive: 30 }
  template_id UUID REFERENCES message_templates(id),
  channels TEXT[],
  enabled BOOLEAN DEFAULT FALSE,
  schedule_time TIME,  -- Horário de envio
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mensagens agendadas
CREATE TABLE scheduled_messages (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  template_id UUID REFERENCES message_templates(id),
  title VARCHAR(200),
  message TEXT,
  recipient_ids UUID[],  -- Customer IDs
  recipient_filter VARCHAR(50),  -- all, birthday_today, inactive_30
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status VARCHAR(50),  -- pending, sent, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Estatísticas de mensagens
CREATE TABLE message_stats (
  id UUID PRIMARY KEY,
  message_id UUID REFERENCES store_messages(id),
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Logs de envio
CREATE TABLE message_logs (
  id UUID PRIMARY KEY,
  message_id UUID,
  customer_id UUID,
  channel VARCHAR(50),  -- push, whatsapp, sms, email
  status VARCHAR(50),  -- sent, delivered, opened, failed
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. Fluxo de Envio de Mensagem

```
┌─────────────────────────────────────────────────────────────┐
│  FLUXO DE ENVIO                                             │
└─────────────────────────────────────────────────────────────┘

1. Usuário clica "Nova Mensagem"
   │
   ▼
2. Escolhe tipo:
   ○ Manual (compor agora)
   ○ Template (usar salvo)
   ○ Campanha automática
   │
   ▼
3. Compõe mensagem:
   • Título (40 chars)
   • Conteúdo (70 chars)
   • Canais: ☑ Push ☑ WhatsApp ☐ SMS ☐ Email
   │
   ▼
4. Seleciona destinatários:
   ○ Todos os clientes
   ○ Segmento (aniversariantes, inativos, etc.)
   ○ Específicos (busca e seleciona)
   │
   ▼
5. Agendamento:
   ○ Enviar agora
   ● Agendar para: [__/__/____] às [__:__]
   │
   ▼
6. Confirmação (PIN de segurança)
   │
   ▼
7. Envio processado:
   • Push: Imediato
   • WhatsApp: Fila (rate limiting)
   • SMS: API externa
   │
   ▼
8. Relatórios disponíveis:
   • Enviadas: 150
   • Entregues: 142
   • Abertas: 89
   • Falharam: 8
```

---

## 🎯 PARTE 2: ANIVERSARIANTES

### O Que Temos

| Item | Status | Detalhes |
|------|--------|----------|
| **Campo `birth_date`** | ✅ Existe | Tabela `customers` |
| **Bônus de aniversário** | ✅ Existe | `fidelity_programs.birthday_bonus_points` |
| **Lista de clientes** | ✅ Existe | Tela `Customers.tsx` |

### O Que Precisamos

#### 1. Painel de Aniversariantes (Dashboard)

**Sua pergunta:**
> "Posso colocar os aniversariantes também para serem mostrados no meu painel de aviso?"

**Resposta:** **SIM!** E é altamente recomendado.

```
┌─────────────────────────────────────────────────────────────┐
│  DASHBOARD - Widget de Aniversariantes                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🎂 ANIVERSARIANTES                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  HOJE (3)                                           │   │
│  │  • Maria Silva - 35 anos                            │   │
│  │  • João Santos - 28 anos                            │   │
│  │  • Ana Costa - 42 anos                              │   │
│  │  [🎁 Enviar Bônus] [📱 Enviar Mensagem]             │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  ESTA SEMANA (8)                                    │   │
│  │  • Pedro Oliveira - 25/02 - 30 anos                 │   │
│  │  • Lucia Ferreira - 27/02 - 22 anos                 │   │
│  │  [Ver Todos]                                        │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  ESTE MÊS (23)                                      │   │
│  │  [Ver Calendário]                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 2. Query para Buscar Aniversariantes

```sql
-- Aniversariantes do dia
SELECT 
  id,
  full_name,
  nickname,
  birth_date,
  EXTRACT(YEAR FROM AGE(CURRENT_DATE, birth_date)) as idade,
  phone_number,
  email
FROM customers
WHERE 
  store_id = 'uuid-da-loja'
  AND EXTRACT(DAY FROM birth_date) = EXTRACT(DAY FROM CURRENT_DATE)
  AND EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
  AND status = 'active';

-- Aniversariantes da semana (próximos 7 dias)
SELECT 
  id,
  full_name,
  nickname,
  birth_date,
  phone_number,
  email,
  EXTRACT(DAY FROM birth_date) as dia,
  EXTRACT(MONTH FROM birth_date) as mes
FROM customers
WHERE 
  store_id = 'uuid-da-loja'
  AND status = 'active'
  AND (
    -- Considera virada de mês
    (EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM CURRENT_DATE) 
     AND EXTRACT(DAY FROM birth_date) BETWEEN EXTRACT(DAY FROM CURRENT_DATE) 
     AND EXTRACT(DAY FROM CURRENT_DATE) + 7)
    OR
    (EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '7 days'))
     AND EXTRACT(DAY FROM birth_date) <= EXTRACT(DAY FROM (CURRENT_DATE + INTERVAL '7 days')))
  )
ORDER BY 
  EXTRACT(MONTH FROM birth_date),
  EXTRACT(DAY FROM birth_date);

-- Aniversariantes do mês
SELECT 
  id,
  full_name,
  nickname,
  birth_date,
  phone_number,
  email,
  EXTRACT(DAY FROM birth_date) as dia
FROM customers
WHERE 
  store_id = 'uuid-da-loja'
  AND status = 'active'
  AND EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
ORDER BY 
  EXTRACT(DAY FROM birth_date);
```

#### 3. Componente de Aniversariantes (Dashboard)

```typescript
// components/dashboard/BirthdayWidget.tsx
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Gift, Calendar, MessageCircle } from 'lucide-react';

export default function BirthdayWidget() {
  const [birthdays, setBirthdays] = useState({
    today: [],
    week: [],
    month: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBirthdays();
  }, []);

  const fetchBirthdays = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: store } = await supabase.rpc(
                'get_store_config_admin',
                { p_store_id: storeId }
            );

      if (!store) return;

      // Buscar aniversariantes (RPC ou query direta)
      const { data } = await supabase.rpc('get_birthdays', {
        p_store_id: store.id,
        p_period: 'all' // today, week, month
      });

      setBirthdays(data || { today: [], week: [], month: [] });
    } catch (error) {
      console.error('Erro ao buscar aniversariantes:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendBirthdayBonus = async (customerId: string) => {
    // Chama função para dar pontos de aniversário
    const { error } = await supabase.rpc('award_birthday_bonus', {
      p_customer_id: customerId
    });

    if (error) {
      toast.error('Erro ao enviar bônus');
    } else {
      toast.success('Bônus de aniversário enviado!');
    }
  };

  const sendBirthdayMessage = async (customer: any) => {
    // Abre modal de mensagem personalizada
    // Pré-preenchida com template de aniversário
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 rounded-2xl p-6 border border-pink-100 dark:border-pink-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black text-gray-800 dark:text-white flex items-center gap-2">
          <Gift className="text-pink-500" size={20} />
          Aniversariantes
        </h3>
        <Calendar className="text-pink-400" size={20} />
      </div>

      {/* Hoje */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-pink-600 dark:text-pink-400 uppercase">
            🎂 Hoje ({birthdays.today.length})
          </span>
        </div>
        {birthdays.today.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Nenhum aniversário hoje</p>
        ) : (
          <div className="space-y-2">
            {birthdays.today.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-2">
                <div>
                  <p className="font-bold text-gray-800 dark:text-white">{c.nickname || c.full_name}</p>
                  <p className="text-xs text-gray-400">{c.idade} anos</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => sendBirthdayBonus(c.id)}
                    className="p-1.5 bg-pink-100 dark:bg-pink-900/30 text-pink-600 rounded hover:bg-pink-200"
                    title="Enviar Bônus"
                  >
                    <Gift size={14} />
                  </button>
                  <button
                    onClick={() => sendBirthdayMessage(c)}
                    className="p-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded hover:bg-purple-200"
                    title="Enviar Mensagem"
                  >
                    <MessageCircle size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Esta Semana */}
      <div className="mb-4">
        <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase">
          📅 Esta Semana ({birthdays.week.length})
        </span>
        {birthdays.week.length > 0 && (
          <div className="mt-2 space-y-1">
            {birthdays.week.slice(0, 3).map((c: any) => (
              <p key={c.id} className="text-sm text-gray-600 dark:text-gray-300">
                {c.nickname || c.full_name} - {c.dia}/{c.mes}
              </p>
            ))}
            {birthdays.week.length > 3 && (
              <button className="text-xs text-pink-600 font-bold hover:underline">
                Ver todos ({birthdays.week.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Este Mês */}
      <div>
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
          📆 Este Mês ({birthdays.month.length})
        </span>
        {birthdays.month.length > 0 && (
          <button className="block mt-2 text-xs text-pink-600 font-bold hover:underline">
            Ver calendário completo
          </button>
        )}
      </div>
    </div>
  );
}
```

#### 4. Automação de Aniversários

```sql
-- Função para dar bônus automático
CREATE OR REPLACE FUNCTION award_birthday_bonus()
RETURNS VOID AS $$
DECLARE
  customer_record RECORD;
  store_record RECORD;
BEGIN
  -- Buscar lojas com programa de fidelidade ativo
  FOR store_record IN 
    SELECT id FROM stores WHERE active = true
  LOOP
    -- Buscar aniversariantes do dia
    FOR customer_record IN
      SELECT id
      FROM customers
      WHERE store_id = store_record.id
        AND status = 'active'
        AND EXTRACT(DAY FROM birth_date) = EXTRACT(DAY FROM CURRENT_DATE)
        AND EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
    LOOP
      -- Verificar se programa tem bônus de aniversário
      IF EXISTS (
        SELECT 1 FROM fidelity_programs 
        WHERE store_id = store_record.id 
          AND is_active = true 
          AND enable_birthday_bonus = true
      ) THEN
        -- Inserir transação de pontos
        INSERT INTO customer_loyalty_transactions (
          customer_id,
          points,
          type,
          description,
          created_at
        )
        SELECT 
          customer_record.id,
          fp.birthday_bonus_points,
          'bonus',
          '🎁 Bônus de Aniversário - ' || EXTRACT(YEAR FROM CURRENT_DATE),
          NOW()
        FROM fidelity_programs fp
        WHERE fp.store_id = store_record.id;

        -- Atualizar saldo do cliente
        UPDATE customers
        SET loyalty_points = loyalty_points + (
          SELECT birthday_bonus_points 
          FROM fidelity_programs 
          WHERE store_id = store_record.id
        )
        WHERE id = customer_record.id;
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Job diário (pg_cron)
SELECT cron.schedule(
  'birthday-bonus-daily',
  '0 8 * * *',  -- Todo dia às 8h
  'SELECT award_birthday_bonus()'
);
```

#### 5. Checklist de Implementação

```
┌─────────────────────────────────────────────────────────────┐
│  ANIVERSARIANTES - Checklist                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  □ RPC: get_birthdays                                       │
│    • Parâmetros: store_id, period (today/week/month)        │
│    • Retorna: lista de clientes por período                 │
│                                                             │
│  □ RPC: award_birthday_bonus                                │
│    • Atribui pontos automaticamente                         │
│    • Registra em customer_loyalty_transactions              │
│                                                             │
│  □ Componente: BirthdayWidget                               │
│    • Exibir no Dashboard                                    │
│    • Lista de hoje, semana, mês                            │
│    • Botões: Enviar Bônus, Enviar Mensagem                  │
│                                                             │
│  □ Job Automático (pg_cron)                                 │
│    • Rodar às 8h diárias                                    │
│    • Atribuir bônus para aniversariantes do dia             │
│                                                             │
│  □ Template de Mensagem de Aniversário                      │
│    • Título: "🎉 Feliz Aniversário!"                        │
│    • Corpo: Mensagem personalizada com {nome}               │
│    • Incluir oferta/voucher                                 │
│                                                             │
│  □ Campanha Automática                                      │
│    • Agendar envio para 8h do dia                           │
│    • Canal: WhatsApp + SMS + Push                           │
│    • Rastrear abertura/clique                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 PARTE 3: DICAS TÉCNICAS

### 3.1 Toast Notifications

**Biblioteca atual:** Sonner (já implementada) ✅

**Melhores práticas:**

```typescript
// utils/toast.ts
import { toast } from 'sonner';

export const notify = {
  success: (message: string, options?: any) => {
    return toast.success(message, {
      duration: 3000,
      position: 'top-right',
      ...options,
    });
  },
  
  error: (message: string, options?: any) => {
    return toast.error(message, {
      duration: 5000,
      position: 'top-right',
      ...options,
    });
  },
  
  warning: (message: string, options?: any) => {
    return toast.warning(message, {
      duration: 4000,
      ...options,
    });
  },
  
  info: (message: string, options?: any) => {
    return toast.info(message, {
      duration: 3000,
      ...options,
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
    return toast.promise(promise, messages);
  },
  
  // Notificação personalizada
  custom: (jsx: React.ReactNode, options?: any) => {
    return toast.custom(jsx, options);
  },
};

// Uso:
// notify.success('Produto salvo com sucesso!');
// notify.error('Erro ao conectar com servidor');
// 
// const toastId = notify.loading('Salvando...');
// api.save().then(() => {
//   toast.dismiss(toastId);
//   notify.success('Salvo!');
// });
// 
// notify.promise(
//   api.save(),
//   {
//     loading: 'Salvando...',
//     success: 'Salvo com sucesso!',
//     error: 'Falha ao salvar'
//   }
// );
```

**Exemplo de uso em formulários:**

```typescript
const handleSubmit = async (data: any) => {
  const toastId = toast.loading('Salvando...');
  
  try {
    await api.save(data);
    toast.dismiss(toastId);
    notify.success('Salvo com sucesso!');
  } catch (error: any) {
    toast.dismiss(toastId);
    notify.error(error.message);
  }
};
```

---

### 3.2 Error Boundaries

**Implementação recomendada:**

```typescript
// components/common/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { toast } from 'sonner';

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
    
    // Log para serviço de monitoramento
    this.props.onError?.(error, errorInfo);
    
    // Notificar usuário
    toast.error('Ops! Algo deu errado. Por favor, recarregue a página.');
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
              Oops! Algo deu errado
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Desculpe pelo inconveniente. Nossa equipe foi notificada.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-brand-green text-white rounded-lg font-bold hover:bg-green-600 transition"
              >
                Recarregar Página
              </button>
              <button
                onClick={() => window.history.back()}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-bold hover:bg-gray-200 transition"
              >
                Voltar
              </button>
            </div>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-xs text-gray-400 cursor-pointer">
                  Detalhes do erro
                </summary>
                <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto max-h-40">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Uso no App.tsx:
// <ErrorBoundary fallback={<ErrorFallback />}>
//   <Routes>...</Routes>
// </ErrorBoundary>
```

**Error Fallback Component:**

```typescript
// components/common/ErrorFallback.tsx
export default function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div className="p-8 text-center">
      <h2 className="text-2xl font-bold mb-4">Erro ao carregar</h2>
      <pre className="text-red-500 text-sm mb-4">{error.message}</pre>
      <button onClick={resetErrorBoundary} className="btn-primary">
        Tentar novamente
      </button>
    </div>
  );
}
```

---

### 3.3 Performance Monitoring

**Métricas a acompanhar:**

| Métrica | Descrição | Meta | Como medir |
|---------|-----------|------|------------|
| **FCP** | First Contentful Paint | < 1.5s | Web Vitals |
| **LCP** | Largest Contentful Paint | < 2.5s | Web Vitals |
| **FID** | First Input Delay | < 100ms | Web Vitals |
| **CLS** | Cumulative Layout Shift | < 0.1 | Web Vitals |
| **TTFB** | Time to First Byte | < 600ms | DevTools |
| **Bundle Size** | Tamanho do JS | < 500KB | Bundle Analyzer |

**Implementação:**

```typescript
// utils/performance.ts
export const reportWebVitals = () => {
  if ('PerformanceObserver' in window) {
    // LCP
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      const lcp = lastEntry.startTime;
      
      console.log('LCP:', lcp);
      // Enviar para analytics
      sendToAnalytics('LCP', lcp);
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // FID
    const fidObserver = new PerformanceObserver((entryList) => {
      entryList.getEntries().forEach((entry) => {
        const fid = entry.processingStart - entry.startTime;
        console.log('FID:', fid);
        sendToAnalytics('FID', fid);
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
      sendToAnalytics('CLS', clsValue);
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });

    // FCP
    const fcpObserver = new PerformanceObserver((entryList) => {
      entryList.getEntries().forEach((entry) => {
        const fcp = entry.startTime;
        console.log('FCP:', fcp);
        sendToAnalytics('FCP', fcp);
      });
    });
    fcpObserver.observe({ entryTypes: ['paint'] });
  }
};

function sendToAnalytics(metric: string, value: number) {
  // Enviar para Google Analytics, Vercel Analytics, etc.
  if (typeof window.gtag !== 'undefined') {
    window.gtag('event', metric, {
      value: Math.round(metric === 'CLS' ? value * 1000 : value),
      event_category: 'Web Vitals',
      non_interaction: true,
    });
  }
}

// No main.tsx:
reportWebVitals();
```

**Ferramentas recomendadas:**

| Ferramenta | Custo | O que faz |
|------------|-------|-----------|
| **Vercel Analytics** | Gratuito | Web Vitals automático |
| **Google Analytics 4** | Gratuito | Métricas customizadas |
| **Sentry Performance** | Pago (US$ 26/mês) | Erros + performance |
| **Lighthouse CI** | Gratuito | Auditoria no build |

**Configurar Bundle Analyzer:**

```bash
npm install --save-dev rollup-plugin-visualizer
```

```typescript
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
    }),
  ],
});
```

---

### 3.4 SEO Avançado

**Meta tags dinâmicas por página:**

```typescript
// hooks/useSEO.ts
import { useEffect } from 'react';

interface SEOConfig {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  noIndex?: boolean;
  keywords?: string[];
}

export const useSEO = ({ 
  title, 
  description, 
  canonical, 
  ogImage, 
  noIndex,
  keywords 
}: SEOConfig) => {
  useEffect(() => {
    // Title
    document.title = `${title} | OptmaMenu`;

    // Meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', description);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = description;
      document.head.appendChild(meta);
    }

    // Keywords
    if (keywords?.length) {
      const metaKeywords = document.querySelector('meta[name="keywords"]');
      if (metaKeywords) {
        metaKeywords.setAttribute('content', keywords.join(', '));
      }
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

    // Cleanup (opcional)
    return () => {
      // Remover tags dinâmicas se necessário
    };
  }, [title, description, canonical, ogImage, noIndex, keywords]);
};

// Uso em uma página:
// useSEO({
//   title: 'Cardápio - Sorveteria Doce Sabor',
//   description: 'Veja nosso cardápio completo de sorvetes e bebidas',
//   canonical: 'https://docesabor.com.br/cardapio',
//   ogImage: 'https://docesabor.com.br/og-cardapio.jpg',
//   keywords: ['sorvete', 'picolé', 'doceria']
// });
```

**Schema.org para restaurantes:**

```typescript
// components/seo/RestaurantSchema.tsx
export default function RestaurantSchema({ store }: any) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "IceCreamShop",
    "name": store.name,
    "image": store.logo_url,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": store.address,
      "addressLocality": store.city,
      "addressRegion": store.state,
      "postalCode": store.zip_code,
      "addressCountry": "BR"
    },
    "telephone": store.phone,
    "openingHours": store.opening_hours,
    "priceRange": "$$",
    "servesCuisine": "Ice Cream",
    "acceptsReservations": "False",
    "url": store.website
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

---

## 🎯 PARTE 4: ÁREA PERSONALIZADA POR USUÁRIO (RBAC)

### O Que Você Pediu

> "Criar uma área personalizada para os usuários de dentro de cada store, pois, precisarão de permissões para executar as tarefas e até mesmo visualizar/manusear/consultar os itens do SaaS."

### Solução: Sistema de Permissões (RBAC)

#### 1. Estrutura de Banco de Dados

```sql
-- Tabela de usuários da store
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

-- Tabela de permissões granulares
CREATE TABLE permissions (
  id UUID PRIMARY KEY,
  role VARCHAR(50),
  resource VARCHAR(100),  -- products, orders, customers, finance, settings
  action VARCHAR(50),     -- create, read, update, delete, export
  UNIQUE(role, resource, action)
);

-- Inserir permissões padrão
INSERT INTO permissions (role, resource, action) VALUES
-- Owner: tudo
('owner', '*', '*'),
-- Admin: quase tudo (exceto excluir loja)
('admin', 'products', '*'),
('admin', 'orders', '*'),
('admin', 'customers', '*'),
('admin', 'finance', 'read'),
('admin', 'finance', 'export'),
-- Manager: operacional
('manager', 'products', 'read'),
('manager', 'products', 'update'),
('manager', 'orders', '*'),
('manager', 'customers', 'read'),
('manager', 'customers', 'update'),
-- Attendant: PDV
('attendant', 'orders', 'create'),
('attendant', 'orders', 'read'),
('attendant', 'products', 'read'),
('attendant', 'customers', 'read'),
-- Viewer: só leitura
('viewer', 'products', 'read'),
('viewer', 'orders', 'read'),
('viewer', 'customers', 'read');

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

-- Índices para performance
CREATE INDEX idx_audit_logs_store ON audit_logs(store_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

#### 2. Hook de Permissões

```typescript
// hooks/usePermissions.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface UserPermission {
  role: string;
  permissions: string[];  // ex: ['products:read', 'products:write']
}

export function usePermissions() {
  const [permissions, setPermissions] = useState<UserPermission | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: storeUser } = await supabase
        .from('store_users')
        .select('role, store_id')
        .eq('auth_user_id', user.id)
        .eq('ativo', true)
        .maybeSingle();

      if (!storeUser) return;

      // Buscar permissões do role
      const { data: perms } = await supabase
        .from('permissions')
        .select('resource, action')
        .eq('role', storeUser.role);

      const permList = perms?.map(p => `${p.resource}:${p.action}`) || [];

      setPermissions({
        role: storeUser.role,
        permissions: permList
      });
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
    } finally {
      setLoading(false);
    }
  };

  const can = (resource: string, action: string): boolean => {
    if (!permissions) return false;
    if (permissions.role === 'owner') return true;
    
    return (
      permissions.permissions.includes(`${resource}:${action}`) ||
      permissions.permissions.includes(`${resource}:*`) ||
      permissions.permissions.includes('*:*')
    );
  };

  const canAny = (actions: string[], resource: string): boolean => {
    return actions.some(action => can(resource, action));
  };

  return {
    permissions,
    loading,
    can,
    canAny,
    role: permissions?.role
  };
}
```

#### 3. Componente de Proteção de Rotas

```typescript
// components/auth/PermissionGuard.tsx
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionGuardProps {
  resource: string;
  action: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function PermissionGuard({ 
  resource, 
  action, 
  children, 
  fallback 
}: PermissionGuardProps) {
  const { can, loading } = usePermissions();

  if (loading) {
    return <div>Carregando...</div>;
  }

  if (!can(resource, action)) {
    return fallback || (
      <div className="p-8 text-center text-gray-400">
        <p>Você não tem permissão para acessar esta área.</p>
      </div>
    );
  }

  return <>{children}</>;
}

// Uso:
// <PermissionGuard resource="products" action="write">
//   <Button>Novo Produto</Button>
// </PermissionGuard>
```

#### 4. Hook para UI Condicional

```typescript
// hooks/useUIPermissions.ts
import { usePermissions } from './usePermissions';

export function useUIPermissions() {
  const { can } = usePermissions();

  return {
    // Produtos
    canCreateProduct: can('products', 'create'),
    canEditProduct: can('products', 'update'),
    canDeleteProduct: can('products', 'delete'),
    
    // Pedidos
    canCreateOrder: can('orders', 'create'),
    canEditOrder: can('orders', 'update'),
    canCancelOrder: can('orders', 'delete'),
    
    // Clientes
    canViewCustomers: can('customers', 'read'),
    canEditCustomer: can('customers', 'update'),
    
    // Financeiro
    canViewFinance: can('finance', 'read'),
    canExportFinance: can('finance', 'export'),
    
    // Configurações
    canEditSettings: can('settings', 'update'),
    canManageUsers: can('users', '*'),
  };
}

// Uso em componentes:
// const { canCreateProduct, canEditProduct } = useUIPermissions();
// 
// return (
//   <div>
//     {canCreateProduct && <Button>Novo Produto</Button>}
//     {canEditProduct && <Button>Editar</Button>}
//   </div>
// );
```

#### 5. Matriz de Permissões (UI)

```typescript
// components/admin/PermissionMatrix.tsx
const DEFAULT_PERMISSIONS = {
  owner: {
    products: ['create', 'read', 'update', 'delete', 'export'],
    orders: ['create', 'read', 'update', 'delete', 'export'],
    customers: ['create', 'read', 'update', 'delete', 'export'],
    finance: ['create', 'read', 'update', 'delete', 'export'],
    settings: ['create', 'read', 'update', 'delete'],
    users: ['create', 'read', 'update', 'delete'],
  },
  admin: {
    products: ['create', 'read', 'update', 'delete', 'export'],
    orders: ['create', 'read', 'update', 'delete', 'export'],
    customers: ['create', 'read', 'update', 'delete', 'export'],
    finance: ['read', 'export'],
    settings: ['read', 'update'],
    users: ['read', 'update'],
  },
  manager: {
    products: ['read', 'update'],
    orders: ['create', 'read', 'update'],
    customers: ['read', 'update'],
    finance: ['read'],
    settings: [],
    users: ['read'],
  },
  attendant: {
    products: ['read'],
    orders: ['create', 'read'],
    customers: ['read'],
    finance: [],
    settings: [],
    users: [],
  },
  viewer: {
    products: ['read'],
    orders: ['read'],
    customers: ['read'],
    finance: [],
    settings: [],
    users: [],
  },
};

export default function PermissionMatrix({ selectedRole, onChange }: any) {
  const permissions = DEFAULT_PERMISSIONS[selectedRole];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800">
            <th className="p-3 font-bold text-gray-500">Recurso</th>
            <th className="p-3 text-center font-bold text-gray-500">Criar</th>
            <th className="p-3 text-center font-bold text-gray-500">Ler</th>
            <th className="p-3 text-center font-bold text-gray-500">Editar</th>
            <th className="p-3 text-center font-bold text-gray-500">Excluir</th>
            <th className="p-3 text-center font-bold text-gray-500">Exportar</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(permissions).map(([resource, actions]) => (
            <tr key={resource} className="border-t dark:border-gray-700">
              <td className="p-3 font-bold capitalize">{resource}</td>
              <td className="p-3 text-center">
                <input
                  type="checkbox"
                  checked={actions.includes('create')}
                  disabled
                  className="w-4 h-4"
                />
              </td>
              <td className="p-3 text-center">
                <input
                  type="checkbox"
                  checked={actions.includes('read')}
                  disabled
                  className="w-4 h-4"
                />
              </td>
              <td className="p-3 text-center">
                <input
                  type="checkbox"
                  checked={actions.includes('update')}
                  disabled
                  className="w-4 h-4"
                />
              </td>
              <td className="p-3 text-center">
                <input
                  type="checkbox"
                  checked={actions.includes('delete')}
                  disabled
                  className="w-4 h-4"
                />
              </td>
              <td className="p-3 text-center">
                <input
                  type="checkbox"
                  checked={actions.includes('export')}
                  disabled
                  className="w-4 h-4"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

#### 6. Checklist de Implementação

```
┌─────────────────────────────────────────────────────────────┐
│  RBAC - Checklist de Implementação                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  □ Banco de Dados                                           │
│    • Criar tabela store_users                               │
│    • Criar tabela permissions                               │
│    • Criar tabela audit_logs                                │
│    • Inserir permissões padrão                              │
│                                                             │
│  □ Hooks                                                    │
│    • usePermissions (carregar permissões)                   │
│    • useUIPermissions (helpers para UI)                     │
│    • useAuditLog (registrar ações)                          │
│                                                             │
│  □ Componentes                                              │
│    • PermissionGuard (proteger rotas)                       │
│    • PermissionMatrix (visualizar matriz)                   │
│    • RoleSelector (selecionar role)                         │
│                                                             │
│  □ Telas                                                    │
│    • Users.tsx (listar usuários)                           │
│    • UserForm.tsx (criar/editar)                            │
│    • AuditLogs.tsx (ver logs)                               │
│                                                             │
│  □ Integração                                               │
│    • Atualizar todas as telas existentes                    │
│    • Esconder botões sem permissão                          │
│    • Bloquear ações não autorizadas                         │
│                                                             │
│  □ Migração                                                 │
│    • Migrar usuários atuais para store_users                │
│    • Atribuir role 'owner' para usuário atual               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 RESUMÃO FINAL

### Mensagens & Marketing

| O Que Fazer | Prioridade |
|-------------|------------|
| Central de Mensagens consolidada | 🔴 Alta |
| Templates de mensagens | 🟡 Média |
| Agendamento de envios | 🟡 Média |
| Relatórios de entrega | 🟢 Baixa |

### Aniversariantes

| O Que Fazer | Prioridade |
|-------------|------------|
| Widget no Dashboard | 🔴 Alta |
| RPC get_birthdays | 🔴 Alta |
| Bônus automático (job) | 🟡 Média |
| Campanha automática | 🟡 Média |

### Dicas Técnicas

| Item | Status |
|------|--------|
| Toast (Sonner) | ✅ Já implementado |
| Error Boundaries | 🟡 Criar componente |
| Performance Monitoring | 🟡 Implementar Web Vitals |
| SEO Avançado | 🟡 Adicionar meta tags |

### RBAC (Permissões)

| O Que Fazer | Prioridade |
|-------------|------------|
| Tabela store_users | 🔴 Alta |
| Tabela permissions | 🔴 Alta |
| Hook usePermissions | 🔴 Alta |
| PermissionGuard | 🔴 Alta |
| Audit Logs | 🟡 Média |

---

**Documento criado para:** Guia de Marketing, Mensagens e Implementações Técnicas  
**Próximo passo:** Implementar widget de aniversariantes no Dashboard
