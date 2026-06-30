// src/pages/initial/legal/Terms.tsx
import { FileText, AlertCircle } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-transparent">
      {/* Conteúdo */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-[#6B6375]/10 dark:border-gray-800 overflow-hidden">
          {/* Hero */}
          <div className="bg-gradient-to-br from-brand-green/10 to-brand-dark/10 px-8 py-12 border-b border-[#6B6375]/10 dark:border-gray-800">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-brand-green/15 rounded-2xl">
                <FileText size={32} className="text-brand-green" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-[#2D2A26] dark:text-white font-candara-bold">
                  Termos de Uso
                </h1>
                <p className="text-[#6B6375] dark:text-gray-400 mt-1">
                  Última atualização: 11 de Fevereiro, 2026
                </p>
              </div>
            </div>
          </div>

          {/* Conteúdo dos Termos */}
          <div className="p-8 space-y-8">
            <div className="prose prose-lg dark:prose-invert max-w-none">
              <div className="bg-brand-purple/10 border border-brand-purple/20 rounded-xl p-6 mb-8">
                <div className="flex items-start gap-3">
                  <AlertCircle size={24} className="text-brand-purple flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-brand-purple dark:text-brand-purple-light mb-2">Leia atentamente</h3>
                    <p className="text-brand-purple/80 dark:text-brand-purple-light/90">
                      Estes Termos de Uso regulam o uso da plataforma OptmaMenu. Ao criar uma conta, você concorda com todas as condições aqui estabelecidas.
                    </p>
                  </div>
                </div>
              </div>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2A26] dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-green">1</span>
                  Aceitação dos Termos
                </h2>
                <p className="text-[#6B6375] dark:text-gray-400 leading-relaxed">
                  Ao acessar ou usar a plataforma OptmaMenu, você concorda em cumprir e estar vinculado a estes Termos de Uso.
                  Se você não concordar com qualquer parte destes termos, não poderá acessar ou usar nossos serviços.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2A26] dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-green">2</span>
                  Descrição dos Serviços
                </h2>
                <p className="text-[#6B6375] dark:text-gray-400 leading-relaxed mb-4">
                  A OptmaMenu fornece uma plataforma de gestão para estabelecimentos de alimentação, incluindo:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-[#6B6375] dark:text-gray-400">
                  <li>Cardápio digital personalizável</li>
                  <li>Sistema de gestão de pedidos</li>
                  <li>Controle de estoque</li>
                  <li>Gestão de entregas</li>
                  <li>Relatórios e análises</li>
                  <li>Programa de fidelidade</li>
                  <li>Integração com meios de pagamento</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2A26] dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-green">3</span>
                  Cadastro e Conta
                </h2>
                <p className="text-[#6B6375] dark:text-gray-400 leading-relaxed mb-4">
                  Para utilizar nossos serviços, você deve criar uma conta fornecendo informações precisas e completas.
                  Você é responsável por:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-[#6B6375] dark:text-gray-400">
                  <li>Manter a confidencialidade de sua senha</li>
                  <li>Todas as atividades realizadas em sua conta</li>
                  <li>Notificar imediatamente sobre uso não autorizado</li>
                  <li>Fornecer informações verdadeiras e atualizadas</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2A26] dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-green">4</span>
                  Planos e Pagamentos
                </h2>
                <p className="text-[#6B6375] dark:text-gray-400 leading-relaxed mb-4">
                  Oferecemos diferentes planos de assinatura. Ao escolher um plano pago:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-[#6B6375] dark:text-gray-400">
                  <li>Os valores serão cobrados conforme o plano selecionado</li>
                  <li>As assinaturas são renovadas automaticamente</li>
                  <li>Você pode cancelar a qualquer momento</li>
                  <li>Não oferecemos reembolso para meses já pagos</li>
                  <li>Reservamo-nos o direito de alterar preços com aviso prévio</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2A26] dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-green">5</span>
                  Responsabilidades do Usuário
                </h2>
                <p className="text-[#6B6375] dark:text-gray-400 leading-relaxed mb-4">
                  Você concorda em não:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-[#6B6375] dark:text-gray-400">
                  <li>Utilizar a plataforma para atividades ilegais</li>
                  <li>Transferir sua conta sem autorização</li>
                  <li>Tentar burlar sistemas de segurança</li>
                  <li>Utilizar robôs ou scripts automatizados</li>
                  <li>Reproduzir, duplicar ou revender nossos serviços</li>
                  <li>Armazenar dados de cartão de crédito de clientes</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2A26] dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-green">6</span>
                  Propriedade Intelectual
                </h2>
                <p className="text-[#6B6375] dark:text-gray-400 leading-relaxed">
                  Todos os direitos, títulos e interesses na plataforma, incluindo software, design, logotipos,
                  e conteúdo visual são de propriedade exclusiva da OptmaIdea. Você não adquire nenhum direito
                  de propriedade sobre nossos serviços.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2A26] dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-green">7</span>
                  Limitação de Responsabilidade
                </h2>
                <p className="text-[#6B6375] dark:text-gray-400 leading-relaxed">
                  A OptmaIdea não será responsável por danos indiretos, incidentais ou consequenciais
                  decorrentes do uso ou incapacidade de usar nossos serviços. Nossa responsabilidade total
                  está limitada ao valor pago pelos serviços nos últimos 12 meses.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2A26] dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-green">8</span>
                  Cancelamento e Término
                </h2>
                <p className="text-[#6B6375] dark:text-gray-400 leading-relaxed mb-4">
                  Podemos suspender ou encerrar seu acesso aos serviços a qualquer momento, com ou sem causa,
                  com ou sem aviso prévio. Você pode cancelar sua conta a qualquer momento através do painel
                  administrativo ou entrando em contato com nosso suporte.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2A26] dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-green">9</span>
                  Alterações nos Termos
                </h2>
                <p className="text-[#6B6375] dark:text-gray-400 leading-relaxed">
                  Reservamo-nos o direito de modificar estes termos a qualquer momento. Notificaremos sobre
                  alterações significativas através do e-mail cadastrado ou por aviso na plataforma. O uso
                  continuado dos serviços após tais alterações constitui aceitação dos novos termos.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2A26] dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-green">10</span>
                  Contato
                </h2>
                <p className="text-[#6B6375] dark:text-gray-400 leading-relaxed">
                  Para questões relacionadas a estes Termos de Uso, entre em contato através do e-mail:{' '}
                  <a href="mailto:legal@optmaidea.com" className="text-brand-green hover:text-brand-dark hover:underline font-bold">
                    legal@optmaidea.com
                  </a>
                </p>
              </section>

              <h3 className="font-bold text-brand-dark dark:text-brand-green mb-2 font-candara-bold">Ao usar nossa plataforma</h3>
              <p className="text-brand-green dark:text-brand-green/80 font-candara">
                Você concorda em seguir todas as diretrizes de segurança e ética para garantir a melhor experiência para seus clientes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}