import { BarChart2, Megaphone, Tag, TrendingUp } from 'lucide-react';

export default function Marketing() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mb-6 shadow-lg">
                        <Megaphone className="text-white" size={40} />
                    </div>
                    <h1 className="text-4xl font-black text-gray-800 dark:text-white mb-4">
                        Marketing & Promoções
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400">
                        Ferramentas poderosas para impulsionar suas vendas
                    </p>
                </div>

                {/* Coming Soon Card */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 md:p-12">
                    <div className="text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-bold mb-6">
                            <BarChart2 size={16} />
                            Em Desenvolvimento
                        </div>

                        <h2 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white mb-4">
                            🚀 Em Breve!
                        </h2>

                        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto">
                            Estamos trabalhando em ferramentas incríveis de marketing para ajudar você a vender mais.
                        </p>

                        {/* Features Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-2xl border border-purple-100 dark:border-purple-800">
                                <Tag className="text-purple-600 dark:text-purple-400 mb-3" size={32} />
                                <h3 className="font-bold text-gray-800 dark:text-white mb-2">Cupons de Desconto</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Crie e gerencie cupons promocionais
                                </p>
                            </div>

                            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800">
                                <TrendingUp className="text-blue-600 dark:text-blue-400 mb-3" size={32} />
                                <h3 className="font-bold text-gray-800 dark:text-white mb-2">Campanhas</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Campanhas de email e push notification
                                </p>
                            </div>

                            <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 p-6 rounded-2xl border border-orange-100 dark:border-orange-800">
                                <Megaphone className="text-orange-600 dark:text-orange-400 mb-3" size={32} />
                                <h3 className="font-bold text-gray-800 dark:text-white mb-2">Promoções</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Ofertas especiais e combos promocionais
                                </p>
                            </div>
                        </div>

                        {/* Progress Indicator */}
                        <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-700">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                                Progresso de desenvolvimento
                            </p>
                            <div className="w-full max-w-md mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full w-1/3 animate-pulse"></div>
                            </div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                                33% concluído
                            </p>
                        </div>
                    </div>
                </div>

                {/* Contact CTA */}
                <div className="text-center mt-8">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Tem sugestões?{' '}
                        <a
                            href="mailto:suporte@optmamenu.com.br"
                            className="text-purple-600 dark:text-purple-400 hover:underline font-bold"
                        >
                            Entre em contato conosco
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
