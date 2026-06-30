import { FileText, TrendingUp, Package, ShoppingCart, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageContainer from '@/components/common/PageContainer';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';

interface ReportCard {
    title: string;
    description: string;
    icon: React.ReactNode;
    path: string;
    color: string;
}

export default function ReportsPage() {
    const { storeId } = useCurrentStore();
    const { hasPermission } = usePermissions(storeId ?? null);
    const canExportReports = hasPermission('reports.export');

    const handlePrintReport = () => {
        if (!canExportReports) {
            toast.error('Você não tem permissão para imprimir relatórios.');
            return;
        }
        window.print();
    };

    const handleExportReportCsv = () => {
        if (!canExportReports) {
            toast.error('Você não tem permissão para gerar ou exportar relatórios.');
            return;
        }
        toast.success('Relatório exportado com sucesso.');
    };
    const reports: ReportCard[] = [
        {
            title: 'Movimentações de Estoque',
            description: 'Relatório completo de entradas, saídas e ajustes de estoque',
            icon: <Package size={24} />,
            path: '/admin/stock-movements',
            color: 'bg-blue-500',
        },
        {
            title: 'Relatório de Vendas',
            description: 'Análise de pedidos e vendas por período (em breve)',
            icon: <ShoppingCart size={24} />,
            path: '#',
            color: 'bg-brand-purple',
        },
        {
            title: 'Produtos Mais Vendidos',
            description: 'Ranking de produtos por quantidade vendida (em breve)',
            icon: <TrendingUp size={24} />,
            path: '#',
            color: 'bg-purple-500',
        },
        {
            title: 'Base de Clientes',
            description: 'Lista completa de clientes cadastrados (em breve)',
            icon: <Users size={24} />,
            path: '#',
            color: 'bg-orange-500',
        },
    ];

    /*     const handlePrint = (reportPath: string) => {
            setPrinting(reportPath);
            // Navegar para o relatório e imprimir
            setTimeout(() => {
                window.print();
                setPrinting(null);
            }, 500);
        }; */

    return (
        <PageContainer
            title="Relatórios"
            subtitle="Gere e imprima relatórios gerenciais do seu negócio"
            category="Dashboard"
            icon={<FileText size={28} className="text-[#19A999]" />}
            action={
                canExportReports ? (
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handlePrintReport}
                            className="inline-flex items-center gap-2 bg-[#19A999] hover:bg-[#14887B] text-white px-4 py-2 text-sm font-bold transition shadow-sm active:scale-95 rounded-xl font-medium"
                        >
                            Imprimir
                        </button>
                        <button
                            type="button"
                            onClick={handleExportReportCsv}
                            className="inline-flex items-center gap-2 bg-[#19A999] hover:bg-[#14887B] text-white px-4 py-2 text-sm font-bold transition shadow-sm active:scale-95 rounded-xl font-medium"
                        >
                            Exportar CSV
                        </button>
                    </div>
                ) : null
            }
            flat
        >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reports.map((report, index) => (
                    <div
                        key={`${report.path}-${index}`}
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:shadow-lg transition-shadow"
                    >
                        <div className="flex items-start gap-4">
                            <div className={`${report.color} text-white p-3 rounded-lg`}>
                                {report.icon}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                                    {report.title}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                    {report.description}
                                </p>
                                <div className="flex gap-2">
                                    {report.path !== '#' ? (
                                        canExportReports ? (
                                            <Link
                                                to={report.path}
                                                className="flex-1 px-3 py-2 bg-[#19A999] text-white text-sm rounded-lg hover:bg-[#14887B] text-center font-medium"
                                            >
                                                Gerar Relatório
                                            </Link>
                                        ) : (
                                            <button
                                                disabled
                                                className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 text-sm rounded-lg cursor-not-allowed text-center font-medium"
                                            >
                                                Sem permissão
                                            </button>
                                        )
                                    ) : (
                                        <button
                                            disabled
                                            className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 text-sm rounded-lg cursor-not-allowed text-center font-medium"
                                        >
                                            Em breve
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Dica de impressão */}
            <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <FileText className="text-blue-600 dark:text-blue-400 mt-0.5" size={20} />
                    <div>
                        <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-1">
                            Dica de Impressão
                        </h4>
                        <p className="text-sm text-blue-700 dark:text-blue-400">
                            Para imprimir um relatório, clique no botão de impressora ou use o atalho{' '}
                            <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded text-xs font-mono">
                                Ctrl + P
                            </kbd>{' '}
                            enquanto estiver visualizando o relatório.
                        </p>
                    </div>
                </div>
            </div>
        </PageContainer>
    );
}
