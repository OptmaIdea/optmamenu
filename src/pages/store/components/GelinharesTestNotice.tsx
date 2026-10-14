import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

const TEST_SLUG = 'gelinharessjn';
const CONSENT_KEY = 'optmamenu.gelinhares.homologacao.notice.v1';
const CONSENT_EVENT = 'optmamenu:gelinhares-test-acknowledged';

/**
 * Strictly limited to Gelinhares on homologation/preview domains.
 * Do not show this for other stores or for the public production site.
 */
export function isGelinharesTestEnvironment(slug?: string | null, hostname?: string): boolean {
    if (String(slug || '').trim().toLowerCase() !== TEST_SLUG) return false;
    const host = String(hostname || (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase();
    return host === 'homologacao.optmamenu.com.br'
        || host.endsWith('.vercel.app')
        || host === 'localhost'
        || host === '127.0.0.1';
}

export function hasAcknowledgedGelinharesTest(): boolean {
    try { return window.sessionStorage.getItem(CONSENT_KEY) === 'accepted'; }
    catch { return false; }
}

export function acknowledgeGelinharesTest(): void {
    try { window.sessionStorage.setItem(CONSENT_KEY, 'accepted'); }
    catch { /* Private browsing may block storage: current tab still receives the event. */ }
    window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function useGelinharesTestNotice(slug?: string | null) {
    const enabled = isGelinharesTestEnvironment(slug);
    const [accepted, setAccepted] = useState(() => hasAcknowledgedGelinharesTest());

    useEffect(() => {
        if (!enabled) return;
        const update = () => setAccepted(true);
        window.addEventListener(CONSENT_EVENT, update);
        return () => window.removeEventListener(CONSENT_EVENT, update);
    }, [enabled]);

    const accept = useCallback(() => { acknowledgeGelinharesTest(); setAccepted(true); }, []);
    return { enabled, accepted: !enabled || accepted, accept };
}

export function GelinharesTestNotice({ slug, compact = false }: { slug?: string | null; compact?: boolean }) {
    const { enabled, accepted, accept } = useGelinharesTestNotice(slug);
    if (!enabled) return null;

    return (
        <section role="note" aria-label="Aviso obrigatório: ambiente de testes" className="mx-auto w-full max-w-5xl rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950 shadow-sm dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100">
            <div className="flex items-start gap-3">
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-amber-700 dark:text-amber-300" />
                <div className="min-w-0">
                    <p className="text-sm font-black uppercase tracking-wide">Gelinhares — loja exclusiva de testes e demonstração</p>
                    <p className="mt-2 text-sm leading-6">
                        Este ambiente é usado para homologação por terceiros. Produtos, preços, pedidos,
                        pontos, prêmios, vouchers e entregas registrados aqui podem ser <strong>simulados</strong>.
                        Operações fictícias não constituem compra real nem geram direito a receber produtos
                        ou dinheiro correspondente aos pontos de teste.
                    </p>
                    {!compact && <p className="mt-2 text-sm leading-6">
                        <strong>Não realize pagamentos reais neste ambiente.</strong> Caso haja cobrança efetiva
                        ou pagamento real, contate o atendimento da loja: os direitos legais aplicáveis
                        continuam preservados. Este aviso não exclui direitos decorrentes de transações reais.
                    </p>}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                        {accepted ? (
                            <span className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                <CheckCircle2 className="h-4 w-4" /> Aviso de testes reconhecido nesta sessão
                            </span>
                        ) : (
                            <button type="button" onClick={accept} className="min-h-11 rounded-xl bg-amber-900 px-4 py-2 text-sm font-bold text-white hover:bg-amber-800">
                                Entendi: estou em uma loja de testes
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
