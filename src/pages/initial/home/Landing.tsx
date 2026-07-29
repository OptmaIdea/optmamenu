import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Boxes,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  ShoppingCart,
  Store,
  Users,
} from 'lucide-react';
import { MetaTags } from '@/components/common/MetaTags';

const capabilities = [
  {
    icon: ShoppingCart,
    title: 'Venda no seu ritmo',
    description:
      'Loja online, WhatsApp, PDV de balcão e pedidos presenciais usando o mesmo catálogo.',
    tone: 'bg-[#F1613A]/10 text-[#D94F2E]',
  },
  {
    icon: Boxes,
    title: 'Estoque que acompanha a operação',
    description:
      'Saldo por local, transferências, compras e histórico completo de cada produto.',
    tone: 'bg-[#19A999]/10 text-[#14887B]',
  },
  {
    icon: CircleDollarSign,
    title: 'Caixa sem planilhas paralelas',
    description:
      'Livro Diário, conferência do fechamento, formas de pagamento e plano de contas.',
    tone: 'bg-[#FAA832]/15 text-[#9A6100]',
  },
  {
    icon: Users,
    title: 'Clientes e fornecedores em contexto',
    description:
      'Histórico, relacionamento, fidelidade e visão 360° para decisões melhores.',
    tone: 'bg-[#7B2D8E]/10 text-[#7B2D8E]',
  },
];

const operationalSteps = [
  {
    number: '01',
    title: 'Configure a loja',
    description:
      'Cadastre produtos, categorias, horários, pagamentos, entregas e a identidade da sua marca.',
  },
  {
    number: '02',
    title: 'Comece a vender',
    description:
      'Divulgue sua página, receba pedidos pelo WhatsApp e opere o balcão com o OptmaPDV.',
  },
  {
    number: '03',
    title: 'Acompanhe e evolua',
    description:
      'Consulte estoque, caixa, clientes e indicadores sem perder a simplicidade do atendimento.',
  },
];

export default function Landing() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'OptmaMenu',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'Gestão comercial e operacional para pequenos comércios, com loja online, PDV, estoque, clientes e financeiro.',
    featureList: [
      'Loja online por endereço próprio',
      'Pedidos e atendimento por WhatsApp',
      'PDV de balcão',
      'Controle de estoque por local',
      'Compras e fornecedores',
      'Livro Diário e fechamento de caixa',
      'Clientes e fidelidade',
      'Usuários e permissões',
    ],
  };

  return (
    <>
      <MetaTags
        title="OptmaMenu | Venda, estoque e gestão em um só lugar"
        description="Uma gestão simples para o comércio local e preparada para acompanhar seu crescimento: loja online, WhatsApp, PDV, estoque, clientes e financeiro."
        keywords="gestão para pequeno comércio, loja online, PDV, estoque, WhatsApp, pedidos, fechamento de caixa"
        ogImage="/assets/OptmaMenuLogo.webp"
        ogUrl="https://optmamenu.optmaidea.com.br/"
        canonicalUrl="https://optmamenu.optmaidea.com.br/"
        schema={structuredData}
      />

      <section className="relative overflow-hidden bg-[#173F3A] px-[5%] py-16 text-white sm:py-20 lg:py-28">
        <div className="pointer-events-none absolute -right-28 -top-32 h-96 w-96 rounded-full bg-[#19A999]/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 left-1/4 h-80 w-80 rounded-full bg-[#F1613A]/20 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.08fr_0.92fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-[#BFF4ED] backdrop-blur">
              <Store size={17} aria-hidden="true" />
              Feito para o comércio real
            </div>

            <h1 className="max-w-4xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Venda mais. Controle melhor.
              <span className="block text-[#FAA832]">
                Cresça sem perder a simplicidade.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/80 sm:text-xl">
              O OptmaMenu reúne loja online, WhatsApp, PDV, estoque, clientes e
              financeiro em uma operação clara — simples para uma loja local e
              preparada para novas unidades.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/signup"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#F1613A] px-7 py-3 font-black text-white shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[#D94F2E]"
              >
                Começar agora
                <ArrowRight size={19} aria-hidden="true" />
              </Link>
              <Link
                to="/login"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 bg-white/5 px-7 py-3 font-bold text-white transition hover:bg-white/10"
              >
                Já uso o OptmaMenu
              </Link>
            </div>

            <div className="mt-8 grid gap-3 text-sm text-white/75 sm:grid-cols-3">
              {[
                'Acesso pelo navegador',
                'Permissões por função',
                'Dados separados por loja',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2
                    size={17}
                    className="shrink-0 text-[#67D9CB]"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="rounded-[2rem] border border-white/15 bg-white/10 p-4 shadow-2xl shadow-black/25 backdrop-blur">
              <div className="rounded-3xl bg-[#F8F6F2] p-5 text-[#2D2A26] sm:p-7">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#14887B]">
                      Hoje na operação
                    </p>
                    <p className="mt-1 text-xl font-black">Tudo no mesmo fluxo</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#19A999] text-white">
                    <ClipboardList size={25} aria-hidden="true" />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  {[
                    ['Pedidos', 'Online e balcão', ShoppingCart],
                    ['Estoque', 'Por local', PackageCheck],
                    ['Caixa', 'Conferido', CircleDollarSign],
                    ['Equipe', 'Acesso controlado', ShieldCheck],
                  ].map(([title, subtitle, Icon]) => (
                    <div
                      key={String(title)}
                      className="rounded-2xl border border-[#6B6375]/10 bg-white p-4 shadow-sm"
                    >
                      <Icon
                        size={21}
                        className="text-[#19A999]"
                        aria-hidden="true"
                      />
                      <p className="mt-3 font-black">{String(title)}</p>
                      <p className="mt-1 text-xs text-[#6B6375]">
                        {String(subtitle)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#173F3A] p-4 text-white">
                  <MessageCircle
                    size={24}
                    className="shrink-0 text-[#67D9CB]"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-black">WhatsApp como canal principal</p>
                    <p className="mt-0.5 text-xs text-white/70">
                      Sem tirar o lojista do ritmo do atendimento.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#F8F6F2] px-[5%] py-16 dark:bg-gray-950 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#14887B]">
              Menos ferramentas soltas
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-[#2D2A26] dark:text-white sm:text-4xl">
              A operação conversa do pedido ao fechamento
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-[#6B6375] dark:text-gray-300">
              Cada venda atualiza o contexto certo: pedido, produto, estoque,
              cliente e caixa permanecem ligados para você entender o que aconteceu.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {capabilities.map(({ icon: Icon, title, description, tone }) => (
              <article
                key={title}
                className="rounded-3xl border border-[#6B6375]/10 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-8"
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}
                >
                  <Icon size={24} aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-xl font-black text-[#2D2A26] dark:text-white">
                  {title}
                </h3>
                <p className="mt-2 leading-relaxed text-[#6B6375] dark:text-gray-300">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-[5%] py-16 dark:bg-gray-900 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#14887B]">
                Comece pequeno, cresça organizado
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-[#2D2A26] dark:text-white sm:text-4xl">
                Uma loja hoje. Novas unidades amanhã.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-[#6B6375] dark:text-gray-300">
                Quem tem uma única loja vê apenas o que precisa. Quando a operação
                crescer, o mesmo produto poderá organizar unidades, equipes,
                estoques, caixas e páginas públicas separadas.
              </p>
              <div className="mt-6 rounded-2xl border border-[#19A999]/20 bg-[#19A999]/5 p-5">
                <p className="font-black text-[#173F3A] dark:text-[#67D9CB]">
                  Complexidade sob demanda
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[#5A635F] dark:text-gray-300">
                  Recursos de grupo e matriz aparecem somente para quem realmente
                  opera mais de uma unidade.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-[#173F3A] p-6 text-white">
                <Store size={28} className="text-[#67D9CB]" aria-hidden="true" />
                <h3 className="mt-5 text-xl font-black">Comércio local</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  Catálogo, balcão, estoque, caixa e relacionamento sem linguagem
                  complicada de ERP.
                </p>
              </div>
              <div className="rounded-3xl bg-[#FAA832] p-6 text-[#3E2A00]">
                <Building2 size={28} aria-hidden="true" />
                <h3 className="mt-5 text-xl font-black">Rede de unidades</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5B3E00]">
                  Visão consolidada do grupo com autonomia e isolamento da operação
                  local.
                </p>
              </div>
              <div className="rounded-3xl border border-[#6B6375]/10 bg-[#F8F6F2] p-6 dark:border-gray-700 dark:bg-gray-800 sm:col-span-2">
                <div className="flex items-start gap-4">
                  <ShieldCheck
                    size={28}
                    className="shrink-0 text-[#14887B]"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="text-xl font-black text-[#2D2A26] dark:text-white">
                      Cada pessoa vê o que precisa
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#6B6375] dark:text-gray-300">
                      Proprietário, gerente e operador trabalham com acessos
                      adequados à função e à unidade vinculada.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#F8F6F2] px-[5%] py-16 dark:bg-gray-950 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#14887B]">
              Um caminho simples
            </p>
            <h2 className="mt-3 text-3xl font-black text-[#2D2A26] dark:text-white sm:text-4xl">
              Da configuração ao primeiro pedido
            </h2>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {operationalSteps.map((step) => (
              <article
                key={step.number}
                className="relative rounded-3xl border border-[#6B6375]/10 bg-white p-7 dark:border-gray-800 dark:bg-gray-900"
              >
                <span className="text-4xl font-black text-[#19A999]/25">
                  {step.number}
                </span>
                <h3 className="mt-5 text-xl font-black text-[#2D2A26] dark:text-white">
                  {step.title}
                </h3>
                <p className="mt-2 leading-relaxed text-[#6B6375] dark:text-gray-300">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#173F3A] px-[5%] py-16 text-white sm:py-20">
        <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#19A999]">
            <Store size={28} aria-hidden="true" />
          </div>
          <h2 className="mt-6 text-3xl font-black tracking-tight sm:text-4xl">
            Sua operação mais clara desde o primeiro dia
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/75">
            Comece com o essencial para vender e controlar. Ative novos recursos
            conforme o negócio realmente precisar.
          </p>
          <Link
            to="/signup"
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#F1613A] px-8 py-3 font-black text-white transition hover:-translate-y-0.5 hover:bg-[#D94F2E]"
          >
            Criar minha loja
            <ArrowRight size={19} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
