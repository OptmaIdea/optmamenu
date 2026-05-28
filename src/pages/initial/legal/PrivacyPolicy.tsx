import { Shield, Lock, Eye, Database, Mail, Globe } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-transparent">
      {/* Conteúdo */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-[#6B6258]/10 dark:border-gray-800 overflow-hidden">
          {/* Hero */}
          <div className="bg-gradient-to-br from-brand-green/10 to-brand-dark/10 px-8 py-12 border-b border-[#6B6258]/10 dark:border-gray-800">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-brand-green/15 rounded-2xl">
                <Shield size={32} className="text-brand-green" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-[#2D2A26] dark:text-white font-candara-bold">
                  Política de Privacidade
                </h1>
                <p className="text-[#6B6258] dark:text-gray-400 mt-1">
                  Última atualização: 11 de Fevereiro, 2026
                </p>
              </div>
            </div>
            <p className="text-[#6B6258] dark:text-gray-400 max-w-2xl">
              A sua privacidade é importante para nós. Esta política explica como coletamos,
              usamos, compartilhamos e protegemos suas informações.
            </p>
          </div>

          {/* Conteúdo da Política */}
          <div className="p-8 space-y-8">
            {/* Cards de Destaque */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-brand-orange/10 p-4 rounded-xl">
                <Lock size={24} className="text-brand-orange mb-2" />
                <h3 className="font-bold text-[#2D2A26] dark:text-white text-sm mb-1 font-candara-bold">Dados Protegidos</h3>
                <p className="text-xs text-[#6B6258] dark:text-gray-400 font-candara">Criptografia de ponta a ponta</p>
              </div>
              <div className="bg-brand-green/10 p-4 rounded-xl">
                <Eye size={24} className="text-brand-green mb-2" />
                <h3 className="font-bold text-[#2D2A26] dark:text-white text-sm mb-1 font-candara-bold">Seu Controle</h3>
                <p className="text-xs text-[#6B6258] dark:text-gray-400 font-candara">Você decide o que compartilhar</p>
              </div>
              <div className="bg-brand-purple/10 p-4 rounded-xl">
                <Database size={24} className="text-brand-purple mb-2" />
                <h3 className="font-bold text-[#2D2A26] dark:text-white text-sm mb-1 font-candara-bold">LGPD</h3>
                <p className="text-xs text-[#6B6258] dark:text-gray-400 font-candara">Em conformidade com a lei</p>
              </div>
            </div>

            <div className="prose prose-lg dark:prose-invert max-w-none">
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2A26] dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-green">1</span>
                  Informações que Coletamos
                </h2>

                <h3 className="text-lg font-bold text-[#2D2A26]/80 dark:text-gray-300 mb-3">1.1 Informações fornecidas por você:</h3>
                <ul className="list-disc pl-6 space-y-2 text-[#6B6258] dark:text-gray-400 mb-4">
                  <li><strong>Dados de cadastro:</strong> nome completo, e-mail, telefone, endereço</li>
                  <li><strong>Informações da loja:</strong> nome, descrição, logo, horário de funcionamento</li>
                  <li><strong>Dados de pagamento:</strong> informações de faturamento (processadas por gateways seguros)</li>
                  <li><strong>Conteúdo:</strong> cardápio, preços, imagens de produtos</li>
                  <li><strong>Comunicações:</strong> mensagens enviadas ao nosso suporte</li>
                </ul>

                <h3 className="text-lg font-bold text-[#2D2A26]/80 dark:text-gray-300 mb-3">1.2 Informações coletadas automaticamente:</h3>
                <ul className="list-disc pl-6 space-y-2 text-[#6B6258] dark:text-gray-400">
                  <li><strong>Dados de uso:</strong> interações com a plataforma, recursos utilizados</li>
                  <li><strong>Dados de dispositivo:</strong> endereço IP, tipo de navegador, sistema operacional</li>
                  <li><strong>Cookies:</strong> para melhorar sua experiência e lembrar preferências</li>
                  <li><strong>Localização:</strong> aproximada (cidade/estado) baseada no IP</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2A26] dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-green">2</span>
                  Como Utilizamos suas Informações
                </h2>
                <ul className="list-disc pl-6 space-y-2 text-[#6B6258] dark:text-gray-400">
                  <li><strong>Fornecer serviços:</strong> operar, manter e melhorar a plataforma</li>
                  <li><strong>Processar pedidos:</strong> gerenciar pedidos, entregas e pagamentos</li>
                  <li><strong>Comunicação:</strong> enviar notificações, atualizações e informações importantes</li>
                  <li><strong>Suporte:</strong> responder dúvidas e resolver problemas</li>
                  <li><strong>Segurança:</strong> detectar e prevenir fraudes, acessos não autorizados</li>
                  <li><strong>Análises:</strong> entender como você usa a plataforma para melhorá-la</li>
                  <li><strong>Conformidade:</strong> cumprir obrigações legais e regulatórias</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2A26] dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-green">3</span>
                  Compartilhamento de Informações
                </h2>
                <p className="text-[#6B6258] dark:text-gray-400 mb-4">
                  Não vendemos seus dados pessoais. Podemos compartilhar informações nas seguintes situações:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-[#6B6258] dark:text-gray-400">
                  <li><strong>Com seu consentimento:</strong> quando você autoriza explicitamente</li>
                  <li><strong>Prestadores de serviço:</strong> processadores de pagamento, serviços de nuvem, análise de dados</li>
                  <li><strong>Exigência legal:</strong> para cumprir obrigações legais, ordens judiciais</li>
                  <li><strong>Proteção de direitos:</strong> para investigar violações, proteger usuários</li>
                  <li><strong>Transferência de negócio:</strong> em caso de fusão, aquisição ou venda</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2A26] dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-green">4</span>
                  Cookies e Tecnologias Semelhantes
                </h2>
                <p className="text-[#6B6258] dark:text-gray-400 mb-4">
                  Utilizamos cookies para melhorar sua experiência:
                </p>
                <div className="bg-[#F8F6F2] dark:bg-gray-800/40 border border-[#6B6258]/10 dark:border-gray-850 rounded-xl p-6 mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#6B6258]/10 dark:border-gray-800">
                        <th className="text-left py-2 font-bold text-[#6B6258] dark:text-gray-300">Tipo</th>
                        <th className="text-left py-2 font-bold text-[#6B6258] dark:text-gray-300">Finalidade</th>
                        <th className="text-left py-2 font-bold text-[#6B6258] dark:text-gray-300">Duração</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-[#6B6258]/10 dark:border-gray-800">
                        <td className="py-2 text-[#6B6258] dark:text-gray-400">Essenciais</td>
                        <td className="py-2 text-[#6B6258] dark:text-gray-400">Autenticação, segurança</td>
                        <td className="py-2 text-[#6B6258] dark:text-gray-400">Sessão</td>
                      </tr>
                      <tr className="border-b border-[#6B6258]/10 dark:border-gray-800">
                        <td className="py-2 text-[#6B6258] dark:text-gray-400">Preferências</td>
                        <td className="py-2 text-[#6B6258] dark:text-gray-400">Idioma, tema, configurações</td>
                        <td className="py-2 text-[#6B6258] dark:text-gray-400">1 ano</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-[#6B6258] dark:text-gray-400">Analíticos</td>
                        <td className="py-2 text-[#6B6258] dark:text-gray-400">Uso da plataforma, melhorias</td>
                        <td className="py-2 text-[#6B6258] dark:text-gray-400">30 dias</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-[#6B6258] dark:text-gray-400">
                  Você pode gerenciar cookies nas configurações do seu navegador.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2A26] dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-green">5</span>
                  Seus Direitos (LGPD)
                </h2>
                <p className="text-[#6B6258] dark:text-gray-400 mb-4">
                  De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#F8F6F2] dark:bg-gray-800/20 border border-[#6B6258]/5 dark:border-gray-850 p-4 rounded-lg">
                    <h4 className="font-bold text-[#2D2A26] dark:text-white text-sm mb-2">Confirmar existência</h4>
                    <p className="text-xs text-[#6B6258] dark:text-gray-400">Saber se tratamos seus dados</p>
                  </div>
                  <div className="bg-[#F8F6F2] dark:bg-gray-800/20 border border-[#6B6258]/5 dark:border-gray-850 p-4 rounded-lg">
                    <h4 className="font-bold text-[#2D2A26] dark:text-white text-sm mb-2">Acessar dados</h4>
                    <p className="text-xs text-[#6B6258] dark:text-gray-400">Solicitar cópia das informações</p>
                  </div>
                  <div className="bg-[#F8F6F2] dark:bg-gray-800/20 border border-[#6B6258]/5 dark:border-gray-850 p-4 rounded-lg">
                    <h4 className="font-bold text-[#2D2A26] dark:text-white text-sm mb-2">Corrigir dados</h4>
                    <p className="text-xs text-[#6B6258] dark:text-gray-400">Atualizar informações incorretas</p>
                  </div>
                  <div className="bg-[#F8F6F2] dark:bg-gray-800/20 border border-[#6B6258]/5 dark:border-gray-850 p-4 rounded-lg">
                    <h4 className="font-bold text-[#2D2A26] dark:text-white text-sm mb-2">Anonimizar dados</h4>
                    <p className="text-xs text-[#6B6258] dark:text-gray-400">Bloquear ou eliminar dados</p>
                  </div>
                  <div className="bg-[#F8F6F2] dark:bg-gray-800/20 border border-[#6B6258]/5 dark:border-gray-850 p-4 rounded-lg">
                    <h4 className="font-bold text-[#2D2A26] dark:text-white text-sm mb-2">Portabilidade</h4>
                    <p className="text-xs text-[#6B6258] dark:text-gray-400">Transferir dados a outro fornecedor</p>
                  </div>
                  <div className="bg-[#F8F6F2] dark:bg-gray-800/20 border border-[#6B6258]/5 dark:border-gray-850 p-4 rounded-lg">
                    <h4 className="font-bold text-[#2D2A26] dark:text-white text-sm mb-2">Revogar consentimento</h4>
                    <p className="text-xs text-[#6B6258] dark:text-gray-400">Retirar autorização a qualquer momento</p>
                  </div>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2A26] dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-green">6</span>
                  Segurança dos Dados
                </h2>
                <p className="text-[#6B6258] dark:text-gray-400 mb-4">
                  Implementamos medidas de segurança técnicas e organizacionais para proteger seus dados:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-[#6B6258] dark:text-gray-400">
                  <li>Criptografia SSL/TLS em todas as comunicações</li>
                  <li>Autenticação de dois fatores (2FA)</li>
                  <li>Monitoramento 24/7 contra acessos não autorizados</li>
                  <li>Backups diários criptografados</li>
                  <li>Acesso restrito baseado em funções</li>
                  <li>Auditorias regulares de segurança</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2A26] dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-green">7</span>
                  Retenção de Dados
                </h2>
                <p className="text-[#6B6258] dark:text-gray-400">
                  Mantemos seus dados enquanto sua conta estiver ativa ou pelo tempo necessário
                  para fornecer os serviços. Após o encerramento da conta, os dados são
                  mantidos por até 180 dias para cumprimento de obrigações legais e então
                  permanentemente excluídos ou anonimizados.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2A26] dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-green">8</span>
                  Dados de Menores
                </h2>
                <p className="text-[#6B6258] dark:text-gray-400">
                  Nossos serviços são destinados a maiores de 18 anos. Não coletamos
                  intencionalmente informações de menores de idade. Se você é pai/mãe
                  ou responsável e acredita que seu filho nos forneceu dados, entre em
                  contato para que possamos removê-los.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2A26] dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-green">9</span>
                  Transferências Internacionais
                </h2>
                <p className="text-[#6B6258] dark:text-gray-400">
                  Seus dados podem ser transferidos e processados em países fora do Brasil,
                  sempre em conformidade com a LGPD e utilizando garantias adequadas como
                  cláusulas contratuais padrão.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2A26] dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-green">10</span>
                  Atualizações desta Política
                </h2>
                <p className="text-[#6B6258] dark:text-gray-400">
                  Podemos atualizar esta política periodicamente. Notificaremos sobre
                  mudanças significativas através do e-mail cadastrado ou por aviso
                  na plataforma. Recomendamos revisar esta página regularmente.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2A26] dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-green">11</span>
                  Contato do DPO
                </h2>
                <p className="text-[#6B6258] dark:text-gray-400 mb-4">
                  Para questões relacionadas à privacidade e proteção de dados, entre em contato com nosso
                  Encarregado de Proteção de Dados (DPO):
                </p>
                <div className="bg-[#F8F6F2] dark:bg-gray-800/30 border border-[#6B6258]/10 dark:border-gray-800 rounded-xl p-6">
                  <div className="flex items-center gap-4 mb-3">
                    <Mail size={20} className="text-brand-green" />
                    <span className="text-gray-700 dark:text-gray-300 font-candara">dpo@optmaidea.com</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Globe size={20} className="text-brand-green" />
                    <span className="text-gray-700 dark:text-gray-300 font-candara">www.optmaidea.com/privacy</span>
                  </div>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-[#2D2A26] dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-green">12</span>
                  Encarregado pela OptmaIdea
                </h2>
                <div className="bg-gradient-to-br from-brand-green/10 to-brand-dark/10 border border-brand-green/15 rounded-xl p-6">
                  <p className="text-gray-700 dark:text-gray-300 font-bold mb-2 font-candara-bold">OptmaIdea Tecnologia Ltda.</p>
                  <p className="text-[#6B6258] dark:text-gray-400 text-sm mb-1 font-candara">
                    CNPJ: 12.345.678/0001-90
                  </p>
                  <p className="text-[#6B6258] dark:text-gray-400 text-sm font-candara">
                    Av. Paulista, 1000 - São Paulo/SP - CEP: 01310-100
                  </p>
                </div>
              </section>

              <div className="bg-brand-green/10 border border-brand-green/20 rounded-xl p-6 mt-8">
                <div className="flex items-start gap-3">
                  <Shield size={24} className="text-brand-green flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-brand-dark dark:text-brand-green mb-2 font-candara-bold">
                      Seus dados estão seguros conosco
                    </h3>
                    <p className="text-brand-green dark:text-brand-green/80 text-sm font-candara">
                      Estamos comprometidos em proteger sua privacidade e ser transparentes
                      sobre como utilizamos seus dados. Esta política reflete nosso compromisso
                      com a segurança e conformidade com a LGPD.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}