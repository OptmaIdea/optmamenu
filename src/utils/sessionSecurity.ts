
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
async function validateSessionSecurityOnce(_signOutFn: () => Promise<void>): Promise<boolean> {
    if (typeof window === 'undefined') return true;

    // O token Supabase já foi validado por App.tsx antes desta função.
    // sessionStorage é isolado por guia e não pode ser usado para invalidar
    // uma sessão legítima apenas porque a guia é nova, foi restaurada ou
    // ficou em background.
    //
    // O encerramento por inatividade é responsabilidade única de
    // useIdleSessionTimeout, respeitando o tempo configurado pela loja e
    // compartilhando a última atividade entre todas as guias.
    markSessionAsActive();

    const chan = getChannel();
    if (chan) {
        chan.postMessage({ type: 'ping' });
    }

    return true;
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
