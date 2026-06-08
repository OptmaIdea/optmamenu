// src/hooks/useIdleSessionTimeout.ts

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { getActiveStoreId } from '@/utils/activeStore';

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

function now() {
    return Date.now();
}

function routeMatches(pathname: string, route: string) {
    if (route === '/admin') {
        return pathname === '/admin';
    }
    return pathname === route || pathname.startsWith(`${route}/`);
}

export function useIdleSessionTimeout() {
    const location = useLocation();
    const user = useAuthStore((state) => state.user);
    const activeStoreId = getActiveStoreId();

    const [settings, setSettings] = useState<{
        idle_timeout_enabled: boolean;
        idle_timeout_minutes: number;
        idle_timeout_exempt_routes: string[];
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
                idle_timeout_exempt_routes: settingsData?.idle_timeout_exempt_routes ?? [
                    '/admin',
                    '/admin/dashboard',
                    '/admin/orders',
                    '/admin/recent-activities',
                    '/admin/products',
                    '/admin/stock',
                    '/admin/stock-locations',
                    '/admin/stock-movements',
                ],
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

    const exemptRoutes = useMemo(() => {
        return settings?.idle_timeout_exempt_routes ?? [
            '/admin',
            '/admin/dashboard',
            '/admin/orders',
            '/admin/recent-activities',
            '/admin/products',
            '/admin/stock',
            '/admin/stock-locations',
            '/admin/stock-movements',
        ];
    }, [settings]);

    const isExemptRoute = useMemo(() => {
        return exemptRoutes.some((route) => routeMatches(location.pathname, route));
    }, [exemptRoutes, location.pathname]);

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
        }

        markActivity();

        ACTIVITY_EVENTS.forEach((eventName) => {
            window.addEventListener(eventName, markActivity, { passive: true });
        });

        return () => {
            ACTIVITY_EVENTS.forEach((eventName) => {
                window.removeEventListener(eventName, markActivity);
            });
        };
    }, [activeStoreId, user?.id, idleTimeoutEnabled]);

    // Loop de inatividade e encerramento da sessão
    useEffect(() => {
        if (!activeStoreId || !user?.id) return;
        if (!idleTimeoutEnabled) return;
        if (isExemptRoute) return;

        const timeoutMs = idleTimeoutMinutes * 60 * 1000;

        async function closeByIdleTimeout() {
            try {
                // Registrar log de desconexão por inatividade no Supabase
                await supabase.rpc('log_user_session_event', {
                    p_store_id: activeStoreId,
                    p_action: 'session_disconnected',
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

            // Limpa as flags do sessionStorage e executa signOut
            sessionStorage.removeItem('optmamenu.session_active');
            sessionStorage.removeItem('optmamenu.last_unload_timestamp');
            await supabase.auth.signOut();
        }

        const interval = window.setInterval(() => {
            const lastActivityAt = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || now());
            const inactiveFor = now() - lastActivityAt;

            if (inactiveFor >= timeoutMs) {
                window.clearInterval(interval);
                void closeByIdleTimeout();
            }
        }, 30_000);

        return () => {
            window.clearInterval(interval);
        };
    }, [
        activeStoreId,
        user?.id,
        idleTimeoutEnabled,
        idleTimeoutMinutes,
        isExemptRoute,
        location.pathname,
    ]);
}
