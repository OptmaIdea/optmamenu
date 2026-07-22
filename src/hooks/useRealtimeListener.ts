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
 */
export function useRealtimeListener({
  channelName,
  tables,
  onChanged,
  enabled = true,
}: UseRealtimeListenerOptions) {
  const onChangedRef = useRef(onChanged);
  const sessionActiveRef = useRef(false);

  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) sessionActiveRef.current = Boolean(data.session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      sessionActiveRef.current = event !== 'SIGNED_OUT' && Boolean(session);
    });

    return () => {
      mounted = false;
      sessionActiveRef.current = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

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
          } as any,
          () => {
            if (!sessionActiveRef.current) return;
            onChangedRef.current();
          }
        );
      }
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, enabled, JSON.stringify(tables)]);
  // JSON.stringify(tables) é intencional para comparação de valor profundo.
}