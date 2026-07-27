import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { createClientUuid } from '@/utils/clientUuid';
import type { RealtimeChannel } from '@supabase/supabase-js';

const PRESENCE_TAB_ID_KEY = 'optmamenu.presence_tab_id';

function getOrCreateSessionTabId(): string {
  if (typeof window === 'undefined') return 'server_tab';
  let tabId = sessionStorage.getItem(PRESENCE_TAB_ID_KEY);
  if (!tabId) {
    tabId = createClientUuid();
    sessionStorage.setItem(PRESENCE_TAB_ID_KEY, tabId);
  }
  return tabId;
}

export type StoreMemberPresencePayload = {
  user_id: string;
  member_id: string;
  store_id: string;
  online_at: string;
  tab_id: string;
};

export type PresenceStatus = 'idle' | 'connecting' | 'subscribed' | 'error';

// Registro global de canais ativos para desinscrição segura no logout
const activeStorePresenceChannels = new Map<string, RealtimeChannel>();

/**
 * Desinscreve e remove todos os canais de presença ativos imediatamente.
 * Deve ser chamado antes do logout da sessão.
 */
export async function untrackAllStorePresences(): Promise<void> {
  const promises: Promise<unknown>[] = [];
  for (const [key, channel] of activeStorePresenceChannels.entries()) {
    try {
      promises.push(
        channel.untrack().catch(() => {}).then(() => supabase.removeChannel(channel))
      );
    } catch (err) {
      console.warn(`[Presence] Erro ao fechar canal ${key}:`, err);
    }
    activeStorePresenceChannels.delete(key);
  }
  await Promise.allSettled(promises);
}

/**
 * Hook de Presença Realtime por Store.
 * Garante que apenas usuários com conexão WebSocket ativa na store selecionada apareçam como "Online agora".
 */
export function useStoreMemberPresence(
  activeStoreId: string | null | undefined,
  activeMemberId: string | null | undefined,
  enabled: boolean = true
) {
  const user = useAuthStore((state) => state.user);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(() => new Set());
  const [onlineMemberIds, setOnlineMemberIds] = useState<Set<string>>(() => new Set());
  const [presenceStatus, setPresenceStatus] = useState<PresenceStatus>('idle');
  const channelRef = useRef<RealtimeChannel | null>(null);

  const updatePresenceState = useCallback((channel: RealtimeChannel) => {
    const state = channel.presenceState<StoreMemberPresencePayload>();
    const userIds = new Set<string>();
    const memberIds = new Set<string>();

    Object.values(state).forEach((presences) => {
      if (Array.isArray(presences)) {
        presences.forEach((p) => {
          if (p?.user_id) userIds.add(String(p.user_id));
          if (p?.member_id) memberIds.add(String(p.member_id));
        });
      }
    });

    setOnlineUserIds(userIds);
    setOnlineMemberIds(memberIds);
  }, []);

  useEffect(() => {
    if (!enabled || !activeStoreId || !user?.id || !activeMemberId) {
      setOnlineUserIds(new Set());
      setOnlineMemberIds(new Set());
      setPresenceStatus('idle');
      return;
    }

    const tabId = getOrCreateSessionTabId();
    const channelName = `store:${activeStoreId}:member-presence`;

    // Evita duplicar canais no mesmo componente/store em React StrictMode
    if (channelRef.current) {
      const existing = channelRef.current;
      channelRef.current = null;
      activeStorePresenceChannels.delete(channelName);
      void existing.untrack().catch(() => {}).then(() => supabase.removeChannel(existing));
    }

    setPresenceStatus('connecting');

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: tabId,
        },
      },
    });

    channelRef.current = channel;
    activeStorePresenceChannels.set(channelName, channel);

    const payload: StoreMemberPresencePayload = {
      user_id: user.id,
      member_id: activeMemberId,
      store_id: activeStoreId,
      online_at: new Date().toISOString(),
      tab_id: tabId,
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        updatePresenceState(channel);
      })
      .on('presence', { event: 'join' }, () => {
        updatePresenceState(channel);
      })
      .on('presence', { event: 'leave' }, () => {
        updatePresenceState(channel);
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          setPresenceStatus('subscribed');
          void channel.track(payload);
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          setPresenceStatus('error');
          if (import.meta.env?.DEV) {
            console.warn(`[Realtime Presence] Canal ${channelName} alterou para ${status}:`, err);
          }
        }
      });

    return () => {
      activeStorePresenceChannels.delete(channelName);
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
      void channel.untrack().catch(() => {}).then(() => supabase.removeChannel(channel));
    };
  }, [activeStoreId, activeMemberId, user?.id, enabled, updatePresenceState]);

  const isMemberOnline = useCallback(
    (userId?: string | null, memberId?: string | null): boolean => {
      if (userId && onlineUserIds.has(String(userId))) return true;
      if (memberId && onlineMemberIds.has(String(memberId))) return true;
      return false;
    },
    [onlineUserIds, onlineMemberIds]
  );

  return {
    onlineUserIds,
    onlineMemberIds,
    presenceStatus,
    isMemberOnline,
  };
}
