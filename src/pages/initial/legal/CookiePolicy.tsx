import { ArrowLeft, BarChart3, Cookie, Megaphone, Settings2, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const POLICY_VERSION = '1.0';
const UPDATED_AT = '1 de agosto de 2026';

export default function CookiePolicy() {
  const openPreferences = () => {
    window.dispatchEvent(new CustomEvent('optmamenu:open-cookie-preferences'));
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-white sm:py-12">
      <main className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <header className="border-b border-slate-200 bg-gradient-to-br from-emerald-50 to-white px-6 py-8 dark:border-slate-800 dark:from-emerald-950/30 dark:to-slate-900 sm:px-10 sm:py-12">
          <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:underline dark:text-emerald-300">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <Cookie className="h-8 w-8" />
            </span>
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Política de Cookies</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Versão {POLICY_VERSION} · Atualizada em {UPDATED_AT}</p>
            </div>
          </div>
          <p className="mt-6 max-w-2xl leading-7 text-slate-600 dark:text-slate-300">
            Esta política explica como o OptmaMenu usa cookies e tecnologias locais semelhantes para manter a plataforma funcionando, preservar escolhas e, somente quando autorizado, medir uso ou apoiar comunicações promocionais.
          </p>
        </header>

        <div className="space-y-10 px-6 py-8 sm:px-10 sm:py-10">
          <section>
            <h2 className="text-2xl font-black">1. O que são cookies e tecnologias semelhantes</h2>
            <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">
              Cookies são pequenos registros armazenados pelo navegador. A plataforma também usa armazenamento local do dispositivo para manter informações como carrinho, sessão, preferências de interface e dados preliminares do checkout até a conclusão do pedido.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black">2. Categorias utilizadas</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <article className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
                <ShieldCheck className="h-7 w-7 text-emerald-600" />
                <h3 className="mt-3 font-black">Essenciais</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Necessários para carrinho, autenticação, segurança, preferências básicas e continuidade do checkout. Não podem ser desativados pelo painel de consentimento.
                </p>
              </article>
              <article className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
                <BarChart3 className="h-7 w-7 text-blue-600" />
                <h3 className="mt-3 font-black">Analytics</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Ajudam a entender uso, desempenho e pontos de melhoria. Permanecem desativados até autorização expressa do usuário.
                </p>
              </article>
              <article className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
                <Megaphone className="h-7 w-7 text-orange-600" />
                <h3 className="mt-3 font-black">Marketing</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Podem apoiar recursos promocionais e medição de campanhas quando tais integrações estiverem configuradas. Também dependem de autorização.
                </p>
              </article>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-black">3. Informações mantidas localmente</h2>
            <ul className="mt-4 list-disc space-y-2 pl-6 leading-7 text-slate-600 dark:text-slate-300">
              <li>itens e contexto do carrinho por loja;</li>
              <li>modalidade de recebimento escolhida;</li>
              <li>rascunho de dados do checkout até a conclusão do pedido;</li>
              <li>tema e preferências visuais;</li>
              <li>decisão de consentimento e sua versão.</li>
            </ul>
            <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:bg-amber-950/30 dark:text-amber-200">
              Preferências pessoais sensíveis previstas para filtros futuros da loja pública deverão permanecer somente no dispositivo e não serão usadas como orientação médica nem como garantia sobre alergênicos ou contaminação cruzada.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black">4. Como registrar e alterar sua escolha</h2>
            <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">
              A escolha é registrada com versão, categorias autorizadas e data da decisão. Uma nova versão relevante desta política ou do modelo de consentimento pode solicitar sua escolha novamente.
            </p>
            <button type="button" onClick={openPreferences} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-black text-white hover:bg-emerald-700">
              <Settings2 className="h-5 w-5" /> Gerenciar preferências de cookies
            </button>
          </section>

          <section>
            <h2 className="text-2xl font-black">5. Retenção e limpeza</h2>
            <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">
              Registros locais permanecem até serem substituídos, expirarem conforme a regra do recurso, serem removidos pela própria aplicação ou apagados nas configurações do navegador. Ao rejeitar categorias opcionais, a aplicação tenta remover cookies opcionais conhecidos.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black">6. Relação com a política de privacidade</h2>
            <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">
              Esta política complementa a <Link to="/politica-privacidade" className="font-bold text-emerald-700 hover:underline dark:text-emerald-300">Política de Privacidade</Link>, que apresenta informações mais amplas sobre tratamento de dados, segurança e direitos dos titulares.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
