import { Truck, Store, MapPin, Clock } from 'lucide-react';
import PageContainer from '@/components/common/PageContainer';

export default function Delivery({ withoutHeader = false, disabled = false }: { withoutHeader?: boolean; disabled?: boolean } = {}) {
    return (
        <PageContainer
            title="Entregas & Retiradas"
            subtitle="Configure as opções de entrega e retirada para seus clientes"
            category="Comercial"
            icon={<Truck size={28} className="text-[#19A999]" />}
            withoutHeader={withoutHeader}
            flat
        >
            {disabled && (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 mb-6 animate-fadeIn">
                    Você pode visualizar estas configurações, mas não possui permissão para alterá-los.
                </div>
            )}
            {/* Coming Soon Card */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 md:p-12">
                <div className="text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-sm font-bold mb-6">
                        <MapPin size={16} />
                        Em Desenvolvimento
                    </div>

                    <h2 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white mb-4">
                        🚀 Em Breve!
                    </h2>

                    <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto">
                        Sistema completo para gerenciar entregas e retiradas de pedidos com flexibilidade e controle.
                    </p>

                    {/* Features Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                        <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 p-6 rounded-2xl border border-orange-100 dark:border-orange-800">
                            <Truck className="text-orange-600 dark:text-orange-400 mb-3" size={32} />
                            <h3 className="font-bold text-gray-800 dark:text-white mb-2">Taxas de Entrega</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Configure taxas por bairro, CEP ou distância
                            </p>
                        </div>

                        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800">
                            <Store className="text-blue-600 dark:text-blue-400 mb-3" size={32} />
                            <h3 className="font-bold text-gray-800 dark:text-white mb-2">Retirada no Local</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Opção de retirada grátis na loja
                            </p>
                        </div>

                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 rounded-2xl border border-green-100 dark:border-green-800">
                            <MapPin className="text-green-600 dark:text-green-400 mb-3" size={32} />
                            <h3 className="font-bold text-gray-800 dark:text-white mb-2">Áreas de Entrega</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Defina regiões atendidas e limites
                            </p>
                        </div>

                        <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-2xl border border-purple-100 dark:border-purple-800">
                            <Clock className="text-purple-600 dark:text-purple-400 mb-3" size={32} />
                            <h3 className="font-bold text-gray-800 dark:text-white mb-2">Tempo de Entrega</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Estime prazos de entrega e retirada
                            </p>
                        </div>
                    </div>

                    {/* Progress Indicator */}
                    <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                            Progresso de desenvolvimento
                        </p>
                        <div className="w-full max-w-md mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                            <div className="bg-gradient-to-r from-orange-500 to-red-500 h-3 rounded-full w-[15%] animate-pulse"></div>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                            15% concluído
                        </p>
                    </div>
                </div>
            </div>

            {/* Contact CTA */}
            <div className="text-center mt-8">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Tem sugestões de integração com entregadores?{' '}
                    <a
                        href="mailto:suporte@optmamenu.com.br"
                        className="text-orange-600 dark:text-orange-400 hover:underline font-bold"
                    >
                        Entre em contato conosco
                    </a>
                </p>
            </div>
        </PageContainer>
    );
}
