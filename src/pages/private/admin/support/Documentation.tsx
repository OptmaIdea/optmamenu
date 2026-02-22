import { BookOpen, Server, Shield, Smartphone, Zap } from 'lucide-react';

export default function Documentation() {
    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 animate-fadeIn pb-24 md:pb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 dark:text-white mb-2 tracking-tight flex items-center gap-3">
                        <BookOpen className="text-brand-green" size={32} />
                        Documentação do Sistema
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">Guia técnico e visão geral da plataforma OptmaMenu.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Tech Stack */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                        <Zap className="text-yellow-500" /> Tecnologias
                    </h2>
                    <ul className="space-y-3">
                        <li className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                            <span className="font-bold text-blue-500">React + Vite</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">Frontend Core</span>
                        </li>
                        <li className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                            <span className="font-bold text-cyan-500">Tailwind CSS</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">Estilização</span>
                        </li>
                        <li className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                            <span className="font-bold text-green-500">Supabase</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">Backend & Database</span>
                        </li>
                        <li className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                            <span className="font-bold text-orange-500">PWA</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">Progressive Web App</span>
                        </li>
                    </ul>
                </div>

                {/* Architecture */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                        <Server className="text-purple-500" /> Arquitetura
                    </h2>
                    <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
                        <p>
                            O sistema utiliza uma arquitetura <strong>Serverless</strong> baseada no Supabase, com autenticação, banco de dados em tempo real e storage integrados.
                        </p>
                        <p>
                            O frontend é hospedado estaticamente (Vercel/Netlify) e se comunica diretamente com o Supabase via <strong>Client SDK</strong>.
                        </p>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-100 dark:border-blue-900/30">
                            <strong>Nota:</strong> Todas as regras de segurança (RLS - Row Level Security) são aplicadas diretamente no banco de dados para garantir isolamento entre lojas (Multi-tenant).
                        </div>
                    </div>
                </div>
            </div>

            {/* Features */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                    <Smartphone className="text-brand-green" /> Funcionalidades Principais
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-brand-green/50 transition">
                        <h3 className="font-bold text-gray-800 dark:text-white mb-2">Pedido Online</h3>
                        <p className="text-sm text-gray-500">Catálogo digital completo com carrinho, variações de produtos e checkout via WhatsApp/Integração.</p>
                    </div>
                    <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-brand-green/50 transition">
                        <h3 className="font-bold text-gray-800 dark:text-white mb-2">Painel Administrativo</h3>
                        <p className="text-sm text-gray-500">Gestão completa de pedidos (Kanban), produtos, categorias, estoque e configurações da loja.</p>
                    </div>
                    <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-brand-green/50 transition">
                        <h3 className="font-bold text-gray-800 dark:text-white mb-2">Fidelidade & CRM</h3>
                        <p className="text-sm text-gray-500">Sistema de pontos automático, cadastro de clientes e histórico de pedidos.</p>
                    </div>
                </div>
            </div>

            {/* Security */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl">
                        <Shield size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Segurança e Privacidade</h2>
                        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300 list-disc pl-5">
                            <li>Dados sensíveis de clientes (CPF, Telefone) são protegidos e requerem autenticação administrativa para visualização.</li>
                            <li>Autenticação via Supabase Auth (Email/Senha, Magic Link).</li>
                            <li>Comunicação criptografada (SSL/TLS).</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="mt-8 text-center text-sm text-gray-400">
                <p>Versão do Sistema: <strong>1.0.0-beta</strong></p>
                <p>Build: {new Date().toLocaleDateString()}</p>
            </div>
        </div>
    );
}
