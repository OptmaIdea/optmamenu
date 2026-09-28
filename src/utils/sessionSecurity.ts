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
async function validateSessionSecurityOnce(signOutFn: () => Promise<void>): Promise<boolean> {
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
        // Uma nova aba não herda obrigatoriamente o sessionStorage da aba de origem.
        // A autenticação Supabase já foi validada antes desta função; portanto,
        // ausência da flag local não deve invalidar uma sessão legítima.
        //
        // Mantemos o BroadcastChannel apenas como coordenação auxiliar, mas não
        // dependemos mais de um pong em poucos milissegundos (abas em background
        // podem ser throttled pelo navegador).
        const chan = getChannel();
        if (chan) {
            chan.postMessage({ type: 'ping' });
        }

        markSessionAsActive();
        return true;
    }
}


let sessionSecurityValidation: Promise<boolean> | null = null;

export async function validateSessionSecurity(
    signOutFn: () => Promise<void>
): Promise<boolean> {
    if (sessionSecurityValidation) {
        return sessionSecurityValidation;
    }

    sessionSecurityValidation = validateSessionSecurityOnce(signOutFn);

    try {
        return await sessionSecurityValidation;
    } finally {
        sessionSecurityValidation = null;
    }
}
