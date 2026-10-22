// src/hooks/useIdleSessionTimeout.ts

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { getActiveStoreId } from '@/utils/activeStore';
import { untrackAllStorePresences } from '@/hooks/useStoreMemberPresence';

const ACTIVITY_EVENTS = [
    'mousemove',
    'mousedown',
    'keydown',
    'touchstart',
    'scroll',
    'click',
];

const LAST_ACTIVITY_KEY = 'optmamenu:lastActivityAt';
const ACTIVE_TAB_KEY = 'optmamenu:activeTabs';
const IDLE_LOGOUT_LOCK_KEY = 'optmamenu:idleLogoutAt';

function now() {
    return Date.now();
}

export function useIdleSessionTimeout() {
    const location = useLocation();
    const user = useAuthStore((state) => state.user);
    const activeStoreId = getActiveStoreId();

    const [settings, setSettings] = useState<{
        idle_timeout_enabled: boolean;
        idle_timeout_minutes: number;
    } | null>(null);

    const tabIdRef = useRef<string>(
        typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`
    );

    // Carrega configurações da loja ativa do Supabase
    const refreshStoreSecuritySettings = async () => {
        if (!activeStoreId) return;

        try {
            const { data, error } = await supabase.rpc('get_store_security_settings', {
                p_store_id: activeStoreId,
            });

            if (error) {
                console.error('Erro ao carregar configurações de inatividade:', error);
                return;
            }

            const settingsData = Array.isArray(data) ? data[0] : data;

            setSettings({
                idle_timeout_enabled: settingsData?.idle_timeout_enabled ?? true,
                idle_timeout_minutes: settingsData?.idle_timeout_minutes ?? 30,
            });
        } catch (err) {
            console.error('Erro ao carregar configurações de inatividade:', err);
        }
    };

    useEffect(() => {
        if (!activeStoreId || !user?.id) return;
        void refreshStoreSecuritySettings();
    }, [activeStoreId, user?.id]);

    const idleTimeoutEnabled = settings?.idle_timeout_enabled ?? true;
    const idleTimeoutMinutes = settings?.idle_timeout_minutes ?? 30;

    // Coordenador de abas (heartbeat)
    useEffect(() => {
        if (!activeStoreId || !user?.id) return;

        const tabId = tabIdRef.current;

        function readTabs(): Record<string, number> {
            try {
                return JSON.parse(localStorage.getItem(ACTIVE_TAB_KEY) || '{}');
            } catch {
                return {};
            }
        }

        function writeTabs(tabs: Record<string, number>) {
            localStorage.setItem(ACTIVE_TAB_KEY, JSON.stringify(tabs));
        }

        function heartbeat() {
            const tabs = readTabs();
            tabs[tabId] = now();

            // Limpa abas que sumiram há mais de 20 segundos
            const cutoff = now() - 20_000;
            Object.keys(tabs).forEach((id) => {
                if (tabs[id] < cutoff) {
                    delete tabs[id];
                }
            });

            writeTabs(tabs);
        }

        function removeTab() {
            const tabs = readTabs();
            delete tabs[tabId];
            writeTabs(tabs);
        }

        heartbeat();
        const interval = window.setInterval(heartbeat, 5000);
        window.addEventListener('beforeunload', removeTab);

        return () => {
            window.clearInterval(interval);
            removeTab();
            window.removeEventListener('beforeunload', removeTab);
        };
    }, [activeStoreId, user?.id]);

    // Registro de atividade do usuário nas abas
    useEffect(() => {
        if (!activeStoreId || !user?.id) return;
        if (!idleTimeoutEnabled) return;

        function markActivity() {
            localStorage.setItem(LAST_ACTIVITY_KEY, String(now()));
            localStorage.removeItem(IDLE_LOGOUT_LOCK_KEY);
        }

        if (!localStorage.getItem(LAST_ACTIVITY_KEY)) {
            markActivity();
        }

        ACTIVITY_EVENTS.forEach((eventName) => {
            window.addEventListener(eventName, markActivity, { passive: true });
        });

        return () => {
            ACTIVITY_EVENTS.forEach((eventName) => {
                window.removeEventListener(eventName, markActivity);
            });
        };
    }, [activeStoreId, user?.id, idleTimeoutEnabled]);

    // Loop de inatividade e encerramento da sessão.
    // A política vale para todo o painel; atividade em qualquer aba mantém a sessão viva
    // porque LAST_ACTIVITY_KEY é compartilhada pelo mesmo navegador.
    useEffect(() => {
        if (!activeStoreId || !user?.id) return;
        if (!idleTimeoutEnabled) return;

        const timeoutMs = idleTimeoutMinutes * 60 * 1000;
        let closing = false;

        async function closeByIdleTimeout() {
            if (closing) return;

            const previousLock = Number(localStorage.getItem(IDLE_LOGOUT_LOCK_KEY) || 0);
            if (Number.isFinite(previousLock) && now() - previousLock < 60_000) return;

            closing = true;
            localStorage.setItem(IDLE_LOGOUT_LOCK_KEY, String(now()));

            try {
                await supabase.rpc('log_user_session_event', {
                    p_store_id: activeStoreId,
                    p_action: 'idle_timeout',
                    p_details: {
                        source: 'idle_timeout',
                        reason: 'Sessão encerrada automaticamente por falta de atividades.',
                        pathname: location.pathname,
                        idle_timeout_minutes: idleTimeoutMinutes,
                    },
                    p_outcome: 'success',
                });
            } catch (error) {
                console.error('Erro ao registrar encerramento por inatividade:', error);
            }

            sessionStorage.removeItem('optmamenu.session_active');
            sessionStorage.removeItem('optmamenu.last_unload_timestamp');
            sessionStorage.removeItem('optmamenu.session.start');
            await untrackAllStorePresences();
            await supabase.auth.signOut();
        }

        function checkIdle() {
            const stored = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
            if (!Number.isFinite(stored) || stored <= 0) {
                localStorage.setItem(LAST_ACTIVITY_KEY, String(now()));
                return;
            }

            if (now() - stored >= timeoutMs) {
                void closeByIdleTimeout();
            }
        }

        checkIdle();
        const interval = window.setInterval(checkIdle, 15_000);

        return () => {
            window.clearInterval(interval);
        };
    }, [
        activeStoreId,
        user?.id,
        idleTimeoutEnabled,
        idleTimeoutMinutes,
        location.pathname,
    ]);
}
