import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Cookie, FileText, Mail, ShieldCheck } from 'lucide-react';
import { PublicStorefrontService } from '@/services/publicStorefrontService';

type LegalDocument = 'terms' | 'privacy' | 'cookies';

type StoreSummary = {
    name: string;
    slug: string;
    email?: string;
};

const DOCUMENT_LABELS: Record<LegalDocument, string> = {
    terms: 'Termos de uso da loja',
    privacy: 'Política de privacidade da loja',
    cookies: 'Política de cookies da loja',
};

const DOCUMENT_NAVIGATION: Array<{ document: LegalDocument; label: string; segment: string }> = [
    { document: 'terms', label: 'Termos de uso', segment: 'termos' },
    { document: 'privacy', label: 'Privacidade', segment: 'privacidade' },
    { document: 'cookies', label: 'Cookies', segment: 'cookies' },
];

function documentIcon(document: LegalDocument) {
    if (document === 'privacy') return <ShieldCheck className="h-7 w-7" aria-hidden="true" />;
    if (document === 'cookies') return <Cookie className="h-7 w-7" aria-hidden="true" />;
    return <FileText className="h-7 w-7" aria-hidden="true" />;
}

function buildMailto(email: string, subject: string, body: string) {
    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function StoreLegalPage({ document }: { document: LegalDocument }) {
    const { storeSlug = '' } = useParams();
    const [store, setStore] = useState<StoreSummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        async function loadStore() {
            try {
                const result = await PublicStorefrontService.getStorefrontBySlug(storeSlug);
                if (!active) return;

                if (result.ok && result.store) {
                    setStore({
                        name: result.store.name,
                        slug: result.store.slug || storeSlug,
                        email: result.store.visual_config?.contact_email?.trim() || undefined,
                    });
                } else {
                    setStore(null);
                }
            } finally {
                if (active) setLoading(false);
            }
        }

        void loadStore();
        return () => { active = false; };
    }, [storeSlug]);

    const canonicalSlug = store?.slug || storeSlug;
    const encodedSlug = encodeURIComponent(canonicalSlug);
    const storePath = `/s/${encodedSlug}`;

    const openCookiePreferences = () => {
        window.dispatchEvent(new CustomEvent('optmamenu:open-cookie-preferences'));
    };

    const storeEmailUrl = useMemo(() => {
        if (!store?.email) return '';

        const subject = document === 'privacy'
            ? `Solicitação de privacidade — ${store.name}`
            : document === 'cookies'
                ? `Dúvida sobre cookies — ${store.name}`
                : `Dúvida sobre os termos de uso — ${store.name}`;

        const body = document === 'privacy'
            ? `Olá! Vim pelo catálogo online da ${store.name} e gostaria de tratar de uma solicitação relacionada aos meus dados pessoais.`
            : document === 'cookies'
                ? `Olá! Vim pelo catálogo online da ${store.name} e tenho uma dúvida sobre cookies e preferências.`
                : `Olá! Vim pelo catálogo online da ${store.name} e tenho uma dúvida sobre os termos de uso da loja.`;

        return buildMailto(store.email, subject, body);
    }, [document, store]);

    const content = useMemo(() => {
        const storeName = store?.name || 'esta loja';

        if (document === 'terms') {
            return (
                <>
                    <p>Estes termos regulam a utilização do catálogo público de {storeName}, incluindo consulta de produtos, montagem do carrinho, envio de pedidos e acompanhamento.</p>
                    <h2>Pedidos e preços</h2>
                    <p>Preços, descontos, disponibilidade e condições de atendimento apresentados no catálogo são confirmados novamente pelo sistema antes da conclusão. Alterações de quantidade podem modificar faixas promocionais e o valor final.</p>
                    <h2>Entrega, retirada e pagamento</h2>
                    <p>As modalidades disponíveis, áreas atendidas, pedido mínimo, taxas e formas de pagamento dependem das configurações publicadas pela loja no momento do pedido.</p>
                    <h2>Responsabilidade do cliente</h2>
                    <p>O cliente deve fornecer dados corretos de identificação, contato e entrega. Pedidos com informações incompletas podem depender de confirmação pela loja.</p>
                    <h2>Relação comercial</h2>
                    <p>A venda, o preparo, a separação, a entrega e o atendimento comercial são realizados pela própria loja. O OptmaMenu fornece a infraestrutura digital utilizada para catálogo, pedido e acompanhamento.</p>
                    <h2>Confirmação do pedido</h2>
                    <p>O envio pelo catálogo representa uma solicitação de compra. A loja poderá entrar em contato para confirmar disponibilidade, endereço, pagamento ou outras condições operacionais antes do atendimento.</p>
                </>
            );
        }

        if (document === 'privacy') {
            return (
                <>
                    <p>Esta política descreve como os dados informados no catálogo de {storeName} são usados para viabilizar o pedido e o atendimento.</p>
                    <h2>Dados utilizados</h2>
                    <p>Podem ser solicitados nome, telefone, endereço, referência de entrega, CPF opcional, observações e dados técnicos necessários ao funcionamento do serviço.</p>
                    <h2>Finalidades</h2>
                    <p>Os dados são usados para identificar o cliente, criar e acompanhar o pedido, organizar entrega ou retirada, registrar pagamento informado e permitir contato operacional.</p>
                    <h2>Responsáveis pelo tratamento</h2>
                    <p>A loja é responsável pelas decisões comerciais e pelo atendimento relacionado ao pedido. A OptmaIdea atua na operação técnica da plataforma OptmaMenu e no tratamento necessário para disponibilizar o serviço.</p>
                    <h2>Compartilhamento</h2>
                    <p>As informações do pedido ficam disponíveis à loja responsável pelo atendimento e aos prestadores técnicos necessários à operação da plataforma. Os dados não devem ser vendidos a anunciantes.</p>
                    <h2>Armazenamento local</h2>
                    <p>Carrinho, preferências e rascunho do checkout podem permanecer neste dispositivo para continuidade da experiência. O cliente pode limpar esses dados pelas configurações do navegador.</p>
                    <h2>Direitos</h2>
                    <p>Solicitações sobre acesso, correção ou eliminação devem ser dirigidas à loja quando relacionadas ao pedido e à OptmaIdea quando relacionadas à infraestrutura da plataforma.</p>
                </>
            );
        }

        return (
            <>
                <p>O catálogo de {storeName} utiliza armazenamento local e tecnologias semelhantes para manter funções essenciais e, mediante consentimento, recursos opcionais.</p>
                <h2>Essenciais</h2>
                <p>Mantêm carrinho, contexto da loja, sessão, segurança, tema e dados temporários do checkout. Permanecem ativos porque o serviço não funciona corretamente sem eles.</p>
                <h2>Analytics</h2>
                <p>Quando autorizado, pode ajudar a compreender desempenho, navegação e pontos de melhoria da experiência pública.</p>
                <h2>Marketing</h2>
                <p>Quando autorizado e configurado, pode apoiar medição de campanhas e recursos promocionais. A autorização pode ser revogada a qualquer momento.</p>
                <h2>Gerenciamento</h2>
                <p>As escolhas ficam vinculadas a este navegador e podem ser revistas a qualquer momento.</p>
            </>
        );
    }, [document, store?.name]);

    if (loading) {
        return <div className="flex min-h-[60vh] items-center justify-center text-slate-500">Carregando documento…</div>;
    }

    if (!store) {
        return (
            <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
                <h1 className="text-2xl font-black text-slate-950">Loja não encontrada</h1>
                <p className="mt-2 text-slate-500">Não foi possível carregar o documento desta loja.</p>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-900 sm:py-10">
            <article className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">
                <header className="border-b border-slate-100 bg-emerald-50 px-5 py-6 dark:border-slate-800 dark:bg-emerald-950/30 sm:px-8 sm:py-8">
                    <Link to={storePath} className="inline-flex items-center gap-2 text-sm font-black text-emerald-700 dark:text-emerald-300">
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar para {store.name}
                    </Link>
                    <div className="mt-5 flex items-start gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                            {documentIcon(document)}
                        </span>
                        <div>
                            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{store.name}</p>
                            <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">{DOCUMENT_LABELS[document]}</h1>
                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Versão pública específica desta loja · 01/08/2026</p>
                        </div>
                    </div>

                    <nav aria-label="Documentos legais da loja" className="mt-6 flex gap-2 overflow-x-auto pb-1">
                        {DOCUMENT_NAVIGATION.map((item) => (
                            <Link
                                key={item.document}
                                to={`/s/${encodedSlug}/legal/${item.segment}`}
                                aria-current={document === item.document ? 'page' : undefined}
                                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-black transition ${document === item.document
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700'}`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </header>

                <div className="space-y-5 px-5 py-7 text-sm leading-7 text-slate-600 dark:text-slate-300 sm:px-8 sm:text-base [&_h2]:pt-3 [&_h2]:text-lg [&_h2]:font-black [&_h2]:text-slate-950 dark:[&_h2]:text-white">
                    {content}

                    <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
                        <h2 className="!pt-0">Canais de contato</h2>
                        <p className="mt-2 text-sm leading-6">Use o e-mail principal da loja para dúvidas sobre pedidos, atendimento e dados vinculados à compra. Para questões sobre a infraestrutura do OptmaMenu, utilize o contato da OptmaIdea.</p>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                            {storeEmailUrl && (
                                <a href={storeEmailUrl} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700">
                                    <Mail className="h-4 w-4" aria-hidden="true" /> Enviar e-mail para {store.name}
                                </a>
                            )}
                            <a href="mailto:faleconosco@optmaidea.com.br" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900">
                                <Mail className="h-4 w-4" aria-hidden="true" /> Contatar a OptmaIdea
                            </a>
                            {document === 'cookies' && (
                                <button type="button" onClick={openCookiePreferences} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                                    <Cookie className="h-4 w-4" aria-hidden="true" /> Gerenciar preferências
                                </button>
                            )}
                        </div>
                        {!store.email && (
                            <p className="mt-3 text-xs leading-5 text-slate-500">A loja ainda não publicou um e-mail principal para contato neste catálogo.</p>
                        )}
                    </section>

                    <aside className="mt-8 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                        Este documento é uma versão operacional inicial e deverá passar por revisão jurídica antes da publicação definitiva.
                    </aside>
                </div>
            </article>
        </main>
    );
}
