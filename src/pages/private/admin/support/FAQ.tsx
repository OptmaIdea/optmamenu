import { useState } from 'react';
import { HelpCircle, Search, ChevronDown, Users, Settings, CreditCard, Smartphone } from 'lucide-react';
import type { FAQItem } from '@/types';
import PageContainer from '@/components/common/PageContainer';

export default function FAQ() {
    const [searchTerm, setSearchTerm] = useState('');
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>('all');

    const faqs: FAQItem[] = [
        // ADMIN - Gestão de Produtos
        {
            category: 'admin',
            question: 'Como adiciono um novo produto ao cardápio?',
            answer: 'Acesse "Produtos > Produtos" no menu lateral, clique em "+ Novo Produto", preencha nome, descrição, preço, categoria e faça upload de imagens. Clique em "Salvar" para publicar.'
        },
        {
            category: 'admin',
            question: 'Como organizo produtos por categorias?',
            answer: 'Vá em "Produtos > Categorias", crie categorias (ex: Sorvetes, Picolés) e depois associe cada produto à sua categoria ao editar o produto.'
        },
        {
            category: 'admin',
            question: 'Como controlo o estoque de produtos?',
            answer: 'Em "Produtos > Estoque", você pode definir quantidade disponível de cada produto. Quando o estoque zerar, o produto fica automaticamente indisponível no cardápio.'
        },
        {
            category: 'admin',
            question: 'Posso desativar um produto temporariamente sem excluí-lo?',
            answer: 'Sim! Ao editar o produto, desmarque a opção "Ativo". O produto ficará oculto no cardápio, mas você pode reativá-lo a qualquer momento.'
        },

        // ADMIN - Pedidos
        {
            category: 'admin',
            question: 'Como gerencio os pedidos recebidos?',
            answer: 'Acesse "Comercial > Pedidos". Você verá os pedidos organizados em colunas (Reservado, Confirmado, Concluído). Arraste os cards entre as colunas para atualizar o status.'
        },
        {
            category: 'admin',
            question: 'Como confirmo um pedido?',
            answer: 'Clique no pedido, revise os detalhes e clique em "Confirmar Pedido". O cliente receberá uma notificação automática (se configurado).'
        },
        {
            category: 'admin',
            question: 'Posso cancelar um pedido?',
            answer: 'Sim. Abra o pedido e clique em "Cancelar Pedido". É recomendável informar o cliente sobre o motivo do cancelamento.'
        },

        // ADMIN - Clientes e Fidelidade
        {
            category: 'admin',
            question: 'Como funciona o programa de fidelidade?',
            answer: 'A cada R$ 10 gastos, o cliente ganha 1 ponto. Você pode configurar recompensas (ex: 50 pontos = 1 sorvete grátis) em "Comercial > Fidelidade".'
        },
        {
            category: 'admin',
            question: 'Como visualizo os dados dos meus clientes?',
            answer: 'Acesse "Comercial > Clientes". Você verá a lista completa com histórico de pedidos, pontos de fidelidade e dados de contato (protegidos por PIN).'
        },
        {
            category: 'admin',
            question: 'Como adiciono tags aos clientes?',
            answer: 'Ao visualizar um cliente, você pode adicionar tags personalizadas (ex: "VIP", "Alérgico a Leite") para segmentação e atendimento personalizado.'
        },

        // ADMIN - Configurações
        {
            category: 'admin',
            question: 'Como personalizo as cores e logo da minha loja?',
            answer: 'Vá em "Configurações > Pedido Online > Visual". Você pode alterar cores primárias, secundárias, fazer upload do logo e até adicionar um banner.'
        },
        {
            category: 'admin',
            question: 'Como configuro os horários de funcionamento?',
            answer: 'Acesse "Configurações > Horários". Defina horários de abertura/fechamento para cada dia da semana. Você também pode configurar tolerância para pedidos antecipados.'
        },
        {
            category: 'admin',
            question: 'Como ativo o envio automático de SMS/WhatsApp?',
            answer: 'Em "Configurações > Envio de Mensagens", configure o gateway OptmaSMSGate e ative as notificações desejadas (confirmação de pedido, status de entrega, etc.).'
        },
        {
            category: 'admin',
            question: 'Como adiciono redes sociais ao meu cardápio?',
            answer: 'Vá em "Configurações > Pedido Online > Contato e Redes", insira os links do Instagram, Facebook, TikTok, etc. Eles aparecerão no perfil do cliente.'
        },

        // ADMIN - Segurança
        {
            category: 'admin',
            question: 'Como altero minha senha de administrador?',
            answer: 'Acesse "Configurações > Senhas e Acesso", clique em "Alterar Senha", digite a senha atual e a nova senha duas vezes.'
        },
        {
            category: 'admin',
            question: 'O que é o PIN de segurança para visualizar CPF?',
            answer: 'É uma camada extra de proteção para dados sensíveis. O PIN padrão é "1234". Você pode configurar um PIN personalizado em "Configurações > Senhas e Acesso".'
        },

        // CLIENTES - Uso do Cardápio
        {
            category: 'customer',
            question: 'Como meus clientes acessam o cardápio digital?',
            answer: 'Compartilhe o link da sua loja (ex: optmasolutions.com.br/s/suasorveteria). Os clientes podem acessar pelo celular, tablet ou computador sem precisar instalar nada.'
        },
        {
            category: 'customer',
            question: 'Os clientes precisam criar conta para fazer pedidos?',
            answer: 'Sim, mas é super rápido! Eles só precisam informar telefone, criar uma senha e pronto. Isso permite acompanhar pedidos e acumular pontos de fidelidade.'
        },
        {
            category: 'customer',
            question: 'Como os clientes fazem um pedido?',
            answer: 'Eles navegam pelo cardápio, adicionam produtos ao carrinho, revisam o pedido, informam endereço de entrega (se aplicável) e finalizam. O pedido chega automaticamente no seu painel.'
        },
        {
            category: 'customer',
            question: 'Como os clientes acompanham o status do pedido?',
            answer: 'Após fazer o pedido, eles recebem notificações em tempo real (se ativado) e podem ver o status na aba "Histórico" do perfil.'
        },
        {
            category: 'customer',
            question: 'Os clientes podem salvar endereços favoritos?',
            answer: 'Sim! No perfil, eles podem cadastrar múltiplos endereços (casa, trabalho, etc.) e escolher qual usar em cada pedido.'
        },
        {
            category: 'customer',
            question: 'Como funciona o programa de fidelidade para os clientes?',
            answer: 'A cada compra, os clientes acumulam pontos automaticamente. Eles podem ver o saldo e resgatar recompensas na aba "Fidelidade" do perfil.'
        },

        // TÉCNICO
        {
            category: 'technical',
            question: 'O sistema funciona offline?',
            answer: 'Não. É necessário conexão com a internet para acessar o cardápio e fazer pedidos. Porém, o sistema é otimizado para funcionar bem mesmo em conexões lentas.'
        },
        {
            category: 'technical',
            question: 'Quais navegadores são suportados?',
            answer: 'Recomendamos Chrome, Firefox, Safari ou Edge nas versões mais recentes. O sistema também funciona perfeitamente em navegadores mobile.'
        },
        {
            category: 'technical',
            question: 'Posso instalar o cardápio como aplicativo no celular?',
            answer: 'Sim! O OptmaMenu é um PWA (Progressive Web App). No Chrome mobile, clique em "Adicionar à tela inicial" para ter um ícone como se fosse um app.'
        },
        {
            category: 'technical',
            question: 'Os dados dos clientes estão seguros?',
            answer: 'Sim! Utilizamos criptografia de ponta a ponta, armazenamento seguro no Supabase e estamos em conformidade com a LGPD. Dados sensíveis como CPF são protegidos por PIN.'
        },
        {
            category: 'technical',
            question: 'O que fazer se o sistema estiver lento?',
            answer: 'Verifique sua conexão de internet. Se o problema persistir, limpe o cache do navegador ou entre em contato com o suporte técnico.'
        },

        // COBRANÇA
        {
            category: 'billing',
            question: 'Como funciona a cobrança do sistema?',
            answer: 'A assinatura é mensal ou anual, dependendo do plano escolhido. O valor é cobrado automaticamente no cartão cadastrado na data de aniversário da assinatura.'
        },
        {
            category: 'billing',
            question: 'Posso mudar de plano a qualquer momento?',
            answer: 'Sim! Você pode fazer upgrade ou downgrade em "Configurações > Meus Dados > Plano". Mudanças entram em vigor no próximo ciclo de cobrança.'
        },
        {
            category: 'billing',
            question: 'Como cancelo minha assinatura?',
            answer: 'Acesse "Configurações > Meus Dados > Plano" e clique em "Cancelar Assinatura". Seus dados serão mantidos por 90 dias para exportação.'
        },
        {
            category: 'billing',
            question: 'Há período de teste gratuito?',
            answer: 'Sim! Novos usuários têm 14 dias de teste gratuito com acesso completo ao plano Professional. Não é necessário cartão de crédito para começar.'
        },
    ];

    const categories = [
        { id: 'all', label: 'Todas', icon: HelpCircle },
        { id: 'admin', label: 'Administração', icon: Settings },
        { id: 'customer', label: 'Orientação ao Cliente', icon: Users },
        { id: 'technical', label: 'Técnico', icon: Smartphone },
        { id: 'billing', label: 'Cobrança', icon: CreditCard },
    ];

    const filteredFaqs = faqs.filter(faq => {
        const matchesSearch = faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
            faq.answer.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <PageContainer
            title="FAQ"
            subtitle="Dúvidas frequentes e respostas sobre o funcionamento da plataforma"
            category="Suporte"
            icon={<HelpCircle size={28} className="text-[#21A896]" />}
            flat
        >
            {/* Search Bar */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Buscar pergunta..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-[#21A896] focus:border-transparent"
                />
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap gap-2 mb-8">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition ${activeCategory === cat.id
                            ? 'bg-[#21A896] text-white shadow-lg shadow-[#21A896]/20'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                            }`}
                    >
                        <cat.icon size={16} />
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* FAQ Accordion */}
            <div className="space-y-3">
                {filteredFaqs.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <HelpCircle size={48} className="mx-auto mb-4 opacity-50" />
                        <p>Nenhuma pergunta encontrada.</p>
                    </div>
                ) : (
                    filteredFaqs.map((faq, index) => (
                        <div
                            key={index}
                            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                        >
                            <button
                                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                            >
                                <span className="font-bold text-gray-800 dark:text-white pr-4">{faq.question}</span>
                                <ChevronDown
                                    size={20}
                                    className={`text-gray-400 shrink-0 transition-transform ${openIndex === index ? 'rotate-180' : ''
                                        }`}
                                />
                            </button>
                            {openIndex === index && (
                                <div className="px-4 pb-4 text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700 pt-4 animate-fadeIn">
                                    {faq.answer}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Contact Support */}
            <div className="mt-12 bg-gradient-to-r from-[#21A896]/10 to-blue-500/10 dark:from-[#21A896]/20 dark:to-blue-500/20 p-6 rounded-2xl border border-[#21A896]/20">
                <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">Não encontrou sua resposta?</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                    Nossa equipe de suporte está pronta para ajudar você!
                </p>
                <div className="flex flex-wrap gap-4 text-sm">
                    <a href="mailto:suporte@optmasolutions.com.br" className="text-[#21A896] font-bold hover:underline">
                        📧 suporte@optmasolutions.com.br
                    </a>
                    <a href="https://wa.me/5562982433802" target="_blank" rel="noopener noreferrer" className="text-[#21A896] font-bold hover:underline">
                        💬 WhatsApp: (62) 98243-3802
                    </a>
                </div>
            </div>
        </PageContainer>
    );
}
