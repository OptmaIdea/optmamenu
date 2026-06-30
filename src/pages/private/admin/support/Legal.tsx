import { useState } from 'react';
import { Shield, FileText, Lock, Cookie, Scale, ChevronRight } from 'lucide-react';
import PageContainer from '@/components/common/PageContainer';

export default function Legal() {
    const [activeTab, setActiveTab] = useState('adesao');

    const tabs = [
        { id: 'adesao', label: 'Termos de Adesão', icon: FileText },
        { id: 'uso', label: 'Termos de Uso', icon: Scale },
        { id: 'privacidade', label: 'Política de Privacidade', icon: Shield },
        { id: 'cookies', label: 'Política de Cookies', icon: Cookie },
        { id: 'complementares', label: 'Termos Complementares', icon: Lock },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'adesao':
                return (
                    <div className="space-y-8 animate-fadeIn text-gray-600 dark:text-gray-300 leading-relaxed">
                        <div className="border-b border-gray-100 dark:border-gray-700 pb-4 mb-4">
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">1. Termos de Adesão ao Sistema OptmaMenu</h2>
                            <p className="text-sm text-gray-500">Última atualização: 09 de fevereiro de 2026</p>
                        </div>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">1.1. Objeto</h3>
                            <p className="text-justify">
                                Os presentes Termos de Adesão estabelecem as condições pelas quais <strong>OPTMA SOLUÇÕES DIGITAIS LTDA</strong> (doravante "OPTMA"), pessoa jurídica com CNPJ nº [CNPJ DA EMPRESA], disponibiliza ao <strong>LOJISTA</strong> (doravante "USUÁRIO" ou "LOJISTA") o acesso à plataforma <strong>OPTMAMENUSYS</strong> — sistema SaaS (Software as a Service) de Cardápio Digital Inteligente e Gestão de Pedidos.
                            </p>
                        </section>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">1.2. Aceitação dos Termos</h3>
                            <p className="mb-2">Ao realizar o cadastro e utilizar o sistema OPTMAMENUSYS, o LOJISTA declara expressamente que:</p>
                            <ul className="list-disc pl-6 space-y-1">
                                <li>Leu, compreendeu e aceita integralmente os presentes Termos de Adesão;</li>
                                <li>Possui capacidade jurídica para contratar;</li>
                                <li>É responsável legal pelo estabelecimento comercial que representa;</li>
                                <li>Concorda em cumprir todas as leis, regulamentos e políticas aplicáveis ao seu negócio.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">1.3. Descrição do Serviço</h3>
                            <p className="mb-2">O OPTMAMENUSYS é uma plataforma que permite ao LOJISTA:</p>
                            <ul className="list-disc pl-6 space-y-1">
                                <li>Criar e gerenciar um cardápio digital personalizado para seus clientes;</li>
                                <li>Gerenciar pedidos recebidos via WhatsApp, SMS ou diretamente no sistema;</li>
                                <li>Administrar base de clientes com programa de fidelidade integrado;</li>
                                <li>Configurar horários de funcionamento, taxas de entrega e disponibilidade de produtos;</li>
                                <li>Integrar comunicação transacional via gateway de SMS/WhatsApp (OptmaSMSGate);</li>
                                <li>Personalizar layout, cores, logotipo e informações da loja;</li>
                                <li>Acessar relatórios de vendas e comportamento do cliente.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">1.4. Tipos de Planos e Cobrança</h3>
                            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-200 mt-2 mb-1">1.4.1. Planos Disponíveis</h4>
                            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg mb-4">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 dark:bg-gray-700 text-xs uppercase">
                                        <tr>
                                            <th className="p-3 border-b dark:border-gray-600">Plano</th>
                                            <th className="p-3 border-b dark:border-gray-600">Recursos</th>
                                            <th className="p-3 border-b dark:border-gray-600">Faturamento</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        <tr>
                                            <td className="p-3 font-bold">Starter</td>
                                            <td className="p-3">Até 50 produtos, 1 usuário admin, fidelidade básica</td>
                                            <td className="p-3">Mensal</td>
                                        </tr>
                                        <tr>
                                            <td className="p-3 font-bold">Professional</td>
                                            <td className="p-3">Até 200 produtos, 3 usuários, fidelidade completa</td>
                                            <td className="p-3">Mensal/Anual</td>
                                        </tr>
                                        <tr>
                                            <td className="p-3 font-bold">Enterprise</td>
                                            <td className="p-3">Ilimitado, API dedicada, suporte prioritário</td>
                                            <td className="p-3">Anual</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-200 mt-2 mb-1">1.4.2. Formas de Pagamento</h4>
                            <ul className="list-disc pl-6 space-y-1">
                                <li><strong>Cartão de Crédito:</strong> Faturamento automático via gateway de pagamento integrado;</li>
                                <li><strong>Boleto Bancário:</strong> Disponível para planos anuais;</li>
                                <li><strong>Pix:</strong> Opção para pagamento à vista.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">1.5. Obrigações do Lojista</h3>
                            <p className="mb-2">O LOJISTA se compromete a:</p>
                            <ul className="list-disc pl-6 space-y-1">
                                <li>Utilizar o sistema exclusivamente para fins legais e éticos;</li>
                                <li>Manter a confidencialidade de suas credenciais de acesso;</li>
                                <li>Não compartilhar login/senha com terceiros não autorizados;</li>
                                <li>Respeitar direitos autorais de imagens e conteúdo inseridos no cardápio;</li>
                                <li>Manter dados cadastrais sempre atualizados;</li>
                                <li>Respeitar a LGPD no tratamento de dados de seus clientes;</li>
                                <li>Assumir total responsabilidade pelos produtos/serviços oferecidos.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">1.6. Obrigações da Optma</h3>
                            <ul className="list-disc pl-6 space-y-1">
                                <li>Manter o sistema disponível com uptime mínimo de 99% (exceto manutenções);</li>
                                <li>Proteger os dados armazenados conforme padrões de segurança da indústria;</li>
                                <li>Notificar o LOJISTA com 48 horas de antecedência sobre manutenções programadas;</li>
                                <li>Prestar suporte técnico conforme plano contratado;</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">1.7. Propriedade Intelectual</h3>
                            <p>O código-fonte, design, logotipos e funcionalidades do OPTMAMENUSYS são propriedade exclusiva da OPTMA. O LOJISTA adquire apenas o direito de uso da plataforma, não a propriedade. Conteúdo inserido pelo LOJISTA permanece de sua propriedade.</p>
                        </section>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">1.8. Limitação de Responsabilidade</h3>
                            <p>A OPTMA não será responsabilizada por perdas financeiras decorrentes de indisponibilidade temporária, danos causados por mau uso pelo LOJISTA, problemas de conexão de internet ou ações de terceiros.</p>
                        </section>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">1.9. Rescisão</h3>
                            <ul className="list-disc pl-6 space-y-1">
                                <li><strong>Pelo LOJISTA:</strong> Pode cancelar a qualquer momento. Dados mantidos por 90 dias.</li>
                                <li><strong>Pela OPTMA:</strong> Pode rescindir se houver uso ilegal, inadimplência {'>'} 30 dias ou violação dos termos.</li>
                            </ul>
                        </section>

                        <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl text-sm">
                            <h4 className="font-bold mb-1">Contato Jurídico</h4>
                            <p>E-mail: juridico@optmasolutions.com.br</p>
                        </div>
                    </div>
                );

            case 'uso':
                return (
                    <div className="space-y-8 animate-fadeIn text-gray-600 dark:text-gray-300 leading-relaxed">
                        <div className="border-b border-gray-100 dark:border-gray-700 pb-4 mb-4">
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">2. Termos de Uso do Sistema</h2>
                            <p className="text-sm text-gray-500">Última atualização: 09 de fevereiro de 2026</p>
                        </div>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">2.1. Acesso e Segurança</h3>
                            <ul className="list-disc pl-6 space-y-1">
                                <li>O LOJISTA é responsável pela guarda e sigilo de seu login e senha.</li>
                                <li>Recomenda-se alteração periódica da senha (a cada 90 dias).</li>
                                <li>A OPTMA utiliza criptografia para armazenamento de senhas.</li>
                                <li>Autenticação de Dois Fatores (2FA) é recomendada para maior segurança.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">2.2. Usuários e Permissões</h3>
                            <p className="mb-2">O LOJISTA é responsável por todas as ações realizadas por usuários (Administrador, Atendente, Caixa) sob sua gestão e deve revogar acessos de ex-funcionários imediatamente.</p>
                        </section>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">2.3. Conteúdo Inserido</h3>
                            <p>O LOJISTA é responsável pela precisão das informações de produtos, imagens e atualização de estoque. Deve também respeitar a LGPD no tratamento de dados de clientes, obtendo consentimento para marketing.</p>
                        </section>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">2.4. Integrações Externas</h3>
                            <ul className="list-disc pl-6 space-y-1">
                                <li><strong>SMS/WhatsApp:</strong> O LOJISTA é responsável pelo conteúdo das mensagens. Spam é proibido.</li>
                                <li><strong>ViaCEP:</strong> Dados de endereço são obtidos de fonte pública e podem requerer validação manual.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">2.5. Suporte Técnico</h3>
                            <p>O suporte cobre dúvidas de funcionalidade e problemas técnicos do sistema. Não cobre criação de conteúdo, treinamento personalizado (salvo contratado à parte) ou problemas na infraestrutura local do lojista.</p>
                        </section>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">2.6. Conduta Proibida</h3>
                            <p>É proibido: tentar acessar contas de terceiros, engenharia reversa, uso de bots, inserir conteúdo ofensivo/ilegal ou violar privacidade de clientes.</p>
                        </section>
                    </div>
                );

            case 'privacidade':
                return (
                    <div className="space-y-8 animate-fadeIn text-gray-600 dark:text-gray-300 leading-relaxed">
                        <div className="border-b border-gray-100 dark:border-gray-700 pb-4 mb-4">
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">3. Política de Privacidade e Proteção de Dados (LGPD)</h2>
                            <p className="text-sm text-gray-500">Conformidade com a Lei nº 13.709/2018</p>
                        </div>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">3.1. Dados Coletados</h3>
                            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-200 mt-2">Do Lojista:</h4>
                            <p>Razão social, CNPJ, contato, dados financeiros (para cobrança) e dados de acesso.</p>
                            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-200 mt-2">Dos Clientes do Lojista:</h4>
                            <p>Nome, telefone, endereço, histórico de pedidos. O OPTMAMENUSYS atua como Operadora de Dados e o LOJISTA como Controlador.</p>
                        </section>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">3.2. Compartilhamento de Dados</h3>
                            <p>Compartilhamos dados estritamente necessários com provedores de infraestrutura (Supabase, Vercel), gateways de pagamento e serviços de mensagem (OptmaSMSGate). Nunca vendemos dados para publicidade.</p>
                        </section>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">3.3. Direitos do Titular</h3>
                            <p>Os titulares têm direito a confirmação, acesso, correção, anonimização, portabilidade e exclusão de seus dados, conforme previsto na LGPD.</p>
                        </section>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">3.4. Segurança</h3>
                            <p>Utilizamos criptografia (HTTPS, bcrypt), controle de acesso rigoroso e backups diários para proteger os dados.</p>
                        </section>

                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-sm border border-blue-100 dark:border-blue-900/30">
                            <h4 className="font-bold mb-1 text-blue-800 dark:text-blue-200">Encarregado de Dados (DPO)</h4>
                            <p className="text-blue-700 dark:text-blue-300">dpo@optmasolutions.com.br</p>
                        </div>
                    </div>
                );

            case 'cookies':
                return (
                    <div className="space-y-8 animate-fadeIn text-gray-600 dark:text-gray-300 leading-relaxed">
                        <div className="border-b border-gray-100 dark:border-gray-700 pb-4 mb-4">
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">4. Política de Cookies</h2>
                            <p className="text-sm text-gray-500">Última atualização: 09 de fevereiro de 2026</p>
                        </div>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">4.1. O que são Cookies?</h3>
                            <p>Pequenos arquivos de texto armazenados no navegador para lembrar preferências, manter sessões ativas e analisar desempenho.</p>
                        </section>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">4.2. Tipos de Cookies Utilizados</h3>
                            <ul className="list-disc pl-6 space-y-1">
                                <li><strong>Essenciais:</strong> Autenticação, segurança. Não podem ser desativados.</li>
                                <li><strong>Preferência:</strong> Tema, idioma.</li>
                                <li><strong>Desempenho:</strong> Analytics anônimo.</li>
                                <li><strong>Marketing:</strong> Comunicações promocionais (requer consentimento).</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">4.3. Gestão de Cookies</h3>
                            <p>O LOJISTA pode gerenciar suas preferências de cookies nas configurações do sistema ou diretamente no navegador. Bloquear cookies essenciais pode afetar o funcionamento da plataforma.</p>
                        </section>
                    </div>
                );

            case 'complementares':
                return (
                    <div className="space-y-8 animate-fadeIn text-gray-600 dark:text-gray-300 leading-relaxed">
                        <div className="border-b border-gray-100 dark:border-gray-700 pb-4 mb-4">
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">5. Termos Legais Complementares</h2>
                        </div>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">5.1. Garantias e Isenção</h3>
                            <p>A OPTMA garante o funcionamento conforme documentação, mas não garante resultados comerciais ou compatibilidade com dispositivos obsoletos.</p>
                        </section>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">5.2. Indenização</h3>
                            <p>O LOJISTA concorda em indenizar a OPTMA por violações de direitos autorais, uso ilegal ou violação da LGPD decorrentes de sua conduta.</p>
                        </section>

                        <section>
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">5.3. Força Maior</h3>
                            <p>Nenhuma parte será responsabilizada por falhas decorrentes de desastres naturais, ataques cibernéticos, greves ou decisões governamentais.</p>
                        </section>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <PageContainer
            title="Termos Legais"
            subtitle="Leia os termos de serviço, políticas de privacidade e contratos de licença"
            category="Suporte"
            icon={<FileText size={28} className="text-[#19A999]" />}
            flat
        >
            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar Navigation */}
                <nav className="w-full md:w-64 flex flex-col gap-2 shrink-0">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center justify-between p-4 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id
                                ? 'bg-[#19A999] text-white shadow-lg shadow-[#19A999]/20'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <tab.icon size={18} />
                                {tab.label}
                            </div>
                            {activeTab === tab.id && <ChevronRight size={16} />}
                        </button>
                    ))}
                </nav>

                {/* Content Area */}
                <main className="flex-1 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 min-h-[600px]">
                    {renderContent()}
                </main>
            </div>
        </PageContainer>
    );
}
