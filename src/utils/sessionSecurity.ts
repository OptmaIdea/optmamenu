import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';

// BroadcastChannel para comunicação entre abas
let channel: BroadcastChannel | null = null;

function getChannel() {
    if (typeof window === 'undefined') return null;
    if (!channel) {
        channel = new BroadcastChannel('optmamenu-session-channel');
        
        // Ouve mensagens de ping de outras abas
        channel.addEventListener('message', (e) => {
            if (e.data && e.data.type === 'ping') {
                if (sessionStorage.getItem('optmamenu.session_active') === 'true') {
                    getChannel()?.postMessage({ type: 'pong' });
                }
            }
        });
    }
    return channel;
}

// Inicializa o canal e o listener global para unload
if (typeof window !== 'undefined') {
    getChannel();
    
    window.addEventListener('beforeunload', () => {
        if (sessionStorage.getItem('optmamenu.session_active') === 'true') {
            sessionStorage.setItem('optmamenu.last_unload_timestamp', Date.now().toString());
        }
    });
}

async function logDisconnectedEvent(reason: string) {
    const storeId = getActiveStoreId();
    if (!storeId) return;
    try {
        await supabase.rpc('log_user_session_event', {
            p_store_id: storeId,
            p_action: 'session_disconnected',
            p_details: {
                source: 'session_security',
                reason: reason
            },
            p_outcome: 'success',
        });
    } catch (error) {
        console.warn('Não foi possível registrar log de desconexão:', error);
    }
}

/**
 * Marca a sessão atual como ativa no sessionStorage da aba.
 */
export function markSessionAsActive() {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem('optmamenu.session_active', 'true');
    sessionStorage.removeItem('optmamenu.last_unload_timestamp');
}

/**
 * Limpa as informações de segurança da sessão (usado no logout).
 */
export function clearSessionSecurity() {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem('optmamenu.session_active');
    sessionStorage.removeItem('optmamenu.last_unload_timestamp');
}

/**
 * Valida o estado de segurança da sessão.
 * Retorna true se a sessão estiver ativa e válida, false se tiver expirado e deslogado.
 */
export async function validateSessionSecurity(signOutFn: () => Promise<void>): Promise<boolean> {
    if (typeof window === 'undefined') return true;

    const sessionActive = sessionStorage.getItem('optmamenu.session_active');
    const lastUnload = sessionStorage.getItem('optmamenu.last_unload_timestamp');

    if (sessionActive === 'true') {
        if (lastUnload) {
            const timeDiff = Date.now() - Number(lastUnload);
            // Se a aba esteve descarregada por mais de 60 segundos
            if (timeDiff > 60000) {
                console.warn('[Session Security] Sessão expirou por inatividade/unload de mais de 60s.');
                await logDisconnectedEvent(`Conexão encerrada automaticamente por inatividade (tempo ausente: ${Math.round(timeDiff / 1000)}s).`);
                clearSessionSecurity();
                await signOutFn();
                return false;
            }
        }
        return true;
    } else {
        // Sem sessão ativa no sessionStorage desta aba (início frio ou nova aba).
        // Envia ping para outras abas ativas
        const chan = getChannel();
        if (!chan) return true;

        let hasOtherTabs = false;
        const handlePong = (e: MessageEvent) => {
            if (e.data && e.data.type === 'pong') {
                hasOtherTabs = true;
            }
        };

        chan.addEventListener('message', handlePong);
        chan.postMessage({ type: 'ping' });

        // Aguarda 200ms para obter resposta das outras abas
        await new Promise((resolve) => setTimeout(resolve, 200));
        chan.removeEventListener('message', handlePong);

        if (hasOtherTabs) {
            // Outra aba está logada, podemos adotar a sessão nesta aba
            markSessionAsActive();
            return true;
        } else {
            // Nenhuma outra aba está ativa. Foi um início frio total (navegador fechado).
            // Forçamos o logout para invalidar a persistência do localStorage
            console.warn('[Session Security] Início frio sem abas logadas ativas. Forçando deslogar.');
            await logDisconnectedEvent('Sessão encerrada devido ao fechamento do navegador ou todas as abas.');
            clearSessionSecurity();
            await signOutFn();
            return false;
        }
    }
}
