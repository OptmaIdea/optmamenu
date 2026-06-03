import { CreditCard, Wallet, ShieldCheck } from 'lucide-react';
import PageContainer from '@/components/common/PageContainer';

export default function Payments() {
    return (
        <PageContainer
            title="Pagamentos & Financeiro"
            subtitle="Gerencie suas vendas e recebimentos em um só lugar."
            category="Configurações"
            icon={<CreditCard className="text-[#21A896]" size={28} />}
            flat
        >

                {/* Coming Soon Card */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 md:p-12">
                    <div className="text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-bold mb-6">
                            <CreditCard size={16} />
                            Em Desenvolvimento
                        </div>

                        <h2 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white mb-4">
                            🚀 Em Breve!
                        </h2>

                        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto">
                            Estamos criando um sistema completo de pagamentos para você controlar todas as suas transações financeiras.
                        </p>

                        {/* Features Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 rounded-2xl border border-green-100 dark:border-green-800">
                                <CreditCard className="text-green-600 dark:text-green-400 mb-3" size={32} />
                                <h3 className="font-bold text-gray-800 dark:text-white mb-2">Pix Automático</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Receba pagamentos via Pix com baixa automática
                                </p>
                            </div>

                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800">
                                <Wallet className="text-blue-600 dark:text-blue-400 mb-3" size={32} />
                                <h3 className="font-bold text-gray-800 dark:text-white mb-2">Cartões</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Aceite cartões de crédito e débito online
                                </p>
                            </div>

                            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-2xl border border-purple-100 dark:border-purple-800">
                                <ShieldCheck className="text-purple-600 dark:text-purple-400 mb-3" size={32} />
                                <h3 className="font-bold text-gray-800 dark:text-white mb-2">Relatórios</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Acompanhamento financeiro detalhado
                                </p>
                            </div>
                        </div>

                        {/* Progress Indicator */}
                        <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-700">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                                Progresso de desenvolvimento
                            </p>
                            <div className="w-full max-w-md mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                <div className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full w-1/4 animate-pulse"></div>
                            </div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                                25% concluído
                            </p>
                        </div>
                    </div>
                </div>

                {/* Contact CTA */}
                <div className="text-center mt-8">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Tem sugestões de integração?{' '}
                        <a
                            href="mailto:suporte@optmamenu.com.br"
                            className="text-green-600 dark:text-green-400 hover:underline font-bold"
                        >
                            Entre em contato conosco
                        </a>
                    </p>
                </div>
        </PageContainer>
    );
}
