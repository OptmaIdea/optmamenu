# Skill: Listeners em Tempo Real (Supabase Realtime)

## Visão Geral

Esta skill define o **padrão oficial** para implementar escuta de mudanças em tempo real no OptmaMenu utilizando o **Supabase Realtime** (`postgres_changes`).

O projeto **não deve mais usar polling por `setInterval`** como mecanismo principal de atualização de dados em telas sensíveis. O Supabase Realtime substitui essa abordagem com notificações push vindas diretamente do banco de dados PostgreSQL, sem custo de requisições repetidas.

> ⚠️ **Contexto histórico**: Existia anteriormente um loader de intervalo automático que atualizava frames sensíveis periodicamente. Esse mecanismo foi descontinuado. O padrão correto é o descrito nesta skill.

---

## Quando Usar Realtime

Implemente um listener Supabase Realtime sempre que a tela for considerada **sensível a mudanças**, ou seja: dados exibidos podem mudar por ação de outro usuário, do sistema ou de um cliente externo, e a atualização deve ser visível **sem que o usuário precise clicar em "Atualizar"**.

### Telas que obrigatoriamente devem ter Realtime

| Tela | Rota | Tabelas a escutar |
|---|---|---|
| **Pedidos** | `/admin/orders` | `orders`, `order_items` |
| **Dashboard** | `/admin` | `orders`, `products` (stock), `customers` |
| **Estoque por Local** | `/admin/inventory` | `products`, `inventory_locations`, `stock_movements` |
| **Movimentações de Estoque** | `/admin/stock-movements` | `stock_movements` |
| **Atividades Recentes** | `/admin/activity` | (tabela de log de atividades) |
| **Alertas** | `/admin/alerts` | `products` (stock), `orders` |
| **Caixa** | `/admin/cashbook` | `cashbook_entries`, `orders` |

### Telas onde Realtime é opcional (mas recomendado)

- Clientes (`customers`) — quando há múltiplos atendentes
- Transferências de Estoque (`transfers`) — para atualizações de status
- Fornecedores (`suppliers`) — raramente muda, mas pode ser incluído

---

## Arquitetura do Padrão

O padrão é implementado como um **hook customizado** (`useRealtimeListener`) que encapsula toda a lógica de subscrição, limpeza e reconexão. Cada página consome esse hook declarativamente.

### Fluxo de dados

```
Supabase DB (PostgreSQL)
        │  (INSERT / UPDATE / DELETE)
        ▼
Supabase Realtime Server (WebSocket)
        │
        ▼
  useRealtimeListener (hook)
        │  (dispara callback)
        ▼
  fetchData() na página  →  setState()  →  Re-render
```

---

## Hook Padrão: `useRealtimeListener`

Crie o arquivo em `src/hooks/useRealtimeListener.ts`:

```typescript
import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type RealtimeTable = {
  /** Nome da tabela no banco (ex: 'orders', 'products') */
  table: string;
  /** Filtro opcional no formato Supabase (ex: 'store_id=eq.abc-123') */
  filter?: string;
  /** Eventos a escutar. Padrão: todos ('*') */
  events?: ('INSERT' | 'UPDATE' | 'DELETE' | '*')[];
};

type UseRealtimeListenerOptions = {
  /** Nome único do canal. Evite colisões entre abas/componentes. */
  channelName: string;
  /** Lista de tabelas e eventos a escutar */
  tables: RealtimeTable[];
  /** Callback disparado quando qualquer mudança ocorrer */
  onChanged: () => void;
  /** Se false, o listener não será registrado (ex: aguardando storeId) */
  enabled?: boolean;
};

/**
 * Hook padrão para escuta de mudanças em tempo real via Supabase Realtime.
 * Registra um canal WebSocket e chama `onChanged` quando detecta alterações
 * nas tabelas especificadas. Realiza limpeza automática ao desmontar.
 *
 * @example
 * useRealtimeListener({
 *   channelName: 'orders_realtime',
 *   tables: [{ table: 'orders', filter: `store_id=eq.${storeId}` }],
 *   onChanged: fetchOrders,
 *   enabled: !!storeId,
 * });
 */
export function useRealtimeListener({
  channelName,
  tables,
  onChanged,
  enabled = true,
}: UseRealtimeListenerOptions) {
  // Ref para evitar closure stale no callback
  const onChangedRef = useRef(onChanged);
  useEffect(() => { onChangedRef.current = onChanged; }, [onChanged]);

  useEffect(() => {
    if (!enabled || tables.length === 0) return;

    let channel: RealtimeChannel = supabase.channel(channelName);

    for (const { table, filter, events = ['*'] } of tables) {
      for (const event of events) {
        channel = channel.on(
          'postgres_changes',
          {
            event,
            schema: 'public',
            table,
            ...(filter ? { filter } : {}),
          },
          () => onChangedRef.current()
        );
      }
    }

    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn(`[Realtime] Erro no canal "${channelName}". Reconectando...`);
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, enabled, JSON.stringify(tables)]);
  // Nota: JSON.stringify(tables) é intencional para comparação de valor profundo.
}
```

---

## Como Usar em uma Página

### Exemplo completo — tela de Estoque

```tsx
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRefreshFrame } from '@/hooks/useRefreshFrame';
import { useRealtimeListener } from '@/hooks/useRealtimeListener';
import PageContainer from '@/components/common/PageContainer';

export default function InventoryByLocationPage() {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Função de carregamento (estável com useCallback)
  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('...')
        .eq('store_id', storeId);
      if (error) throw error;
      setData(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  // 2. Carga inicial e ao mudar storeId
  useEffect(() => { fetchData(); }, [fetchData]);

  // 3. Conecta ao botão "Atualizar" global do PrivateLayout
  useRefreshFrame(fetchData);

  // 4. Listener Realtime — dispara fetchData automaticamente a cada mudança no DB
  useRealtimeListener({
    channelName: `inventory_realtime_${storeId}`,
    tables: [
      { table: 'products', filter: `store_id=eq.${storeId}` },
      { table: 'stock_movements', filter: `store_id=eq.${storeId}` },
    ],
    onChanged: fetchData,
    enabled: !!storeId,
  });

  return (
    <PageContainer title="Estoque por Local" category="PRODUTOS" flat>
      {/* conteúdo */}
    </PageContainer>
  );
}
```

---

## Regras e Boas Práticas

### ✅ Obrigatório

1. **Sempre filtre por `store_id`** quando a tabela pertence a uma loja específica. Nunca escute a tabela inteira sem filtro em produção.
   ```typescript
   filter: `store_id=eq.${storeId}`
   ```

2. **Use `enabled: !!storeId`** para não registrar o listener antes de ter o ID da loja disponível.

3. **Nomes de canal devem ser únicos por contexto.** Inclua o `storeId` ou a rota:
   ```typescript
   channelName: `orders_realtime_${storeId}`
   ```

4. **Sempre combine Realtime com `useRefreshFrame`**. O listener atualiza automaticamente, mas o usuário ainda pode clicar no botão "Atualizar".

5. **A função `fetchData` deve ser envolvida em `useCallback`** para não recriar o listener a cada render.

### ❌ Proibido / A evitar

- **Não use `setInterval` como substituto do Realtime** em telas sensíveis. Polling é aceitável apenas para timers de UI (ex: contagem regressiva de pedido), nunca para busca de dados do banco.
- **Não crie canais duplicados** com o mesmo nome em múltiplos componentes ativos simultaneamente — isso gera múltiplas notificações para a mesma mudança.
- **Não omita o retorno de limpeza** (`return () => supabase.removeChannel(channel)`). Canais não removidos acumulam e causam vazamento de WebSocket.
- **Não passe funções instáveis** (recriadas a cada render) como `onChanged` diretamente — o hook usa um `ref` interno para contornar isso, mas mantenha `fetchData` em `useCallback` para clareza.

---

## Indicador Visual de Conexão (Recomendado)

Para telas críticas como **Pedidos**, é recomendável exibir um indicador de status da conexão Realtime para o operador saber que está recebendo atualizações ao vivo.

```tsx
// Componente simples de badge de status
function RealtimeBadge({ connected }: { connected: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full
      ${connected
        ? 'bg-[#21A896]/10 text-[#21A896]'
        : 'bg-[#FBA93C]/10 text-[#FBA93C]'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[#21A896] animate-pulse' : 'bg-[#FBA93C]'}`} />
      {connected ? 'Ao vivo' : 'Reconectando...'}
    </span>
  );
}
```

Para capturar o status de conexão, expanda o `useRealtimeListener` para retornar o estado:

```typescript
// Variação com retorno de status
const [connected, setConnected] = useState(false);

channel.subscribe((status) => {
  setConnected(status === 'SUBSCRIBED');
});
```

---

## Supabase Realtime — Pré-requisitos no Banco

Para que o `postgres_changes` funcione, a tabela precisa ter **Replication habilitado** no Supabase Dashboard:

1. Acesse o **Supabase Dashboard** → **Database** → **Replication**
2. Localize a tabela desejada na lista
3. Ative o toggle ao lado da tabela

Tabelas que **já devem ter Replication ativo**:
- `orders`
- `products`
- `stock_movements`
- `cashbook_entries`
- `customers`
- `store_members`

> Se o listener não disparar mesmo com mudanças no banco, verifique primeiro se a Replication da tabela está ativa.

---

## Compatibilidade com o `useRefreshFrame`

Os dois hooks são **complementares e devem coexistir** em toda página sensível:

| Mecanismo | Quando atualiza | Como |
|---|---|---|
| `useRealtimeListener` | Automaticamente, ao receber evento do banco | Supabase WebSocket push |
| `useRefreshFrame` | Quando o usuário clica em "Atualizar" | Evento customizado `optmamenu.refresh` |

```typescript
// Na mesma página, ambos os hooks apontam para a mesma função
useRefreshFrame(fetchData);
useRealtimeListener({ ..., onChanged: fetchData, ... });
```

---

## Referência Rápida — Tabelas e Canais Sugeridos por Módulo

| Módulo | `channelName` sugerido | Tabelas |
|---|---|---|
| Pedidos | `orders_rt_${storeId}` | `orders` |
| Usuários | `users_rt_${storeId}` | `store_members` |
| Dashboard | `dashboard_rt_${storeId}` | `orders`, `products` |
| Estoque por Local | `inventory_rt_${storeId}` | `products`, `stock_movements` |
| Movimentações | `stock_movements_rt_${storeId}` | `stock_movements` |
| Atividades | `activity_rt_${storeId}` | *(tabela de log)* |
| Alertas | `alerts_rt_${storeId}` | `products`, `orders` |
| Caixa | `cashbook_rt_${storeId}` | `cashbook_entries`, `orders` |

---

## Arquivo a Criar

| Arquivo | Ação |
|---|---|
| `src/hooks/useRealtimeListener.ts` | **[NOVO]** Hook padrão de listener (código acima) |

Após criar o hook, aplique-o progressivamente nas telas sensíveis listadas na seção "Telas que obrigatoriamente devem ter Realtime".
