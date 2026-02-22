import type { StoreConfig } from '@/types';
import { ShoppingBag, Menu, Search } from 'lucide-react';

interface StorePreviewProps {
    config: StoreConfig;
}

export default function StorePreview({ config }: StorePreviewProps) {
    const primary = config.visual_color_primary || '#00D65F';
    const secondary = config.visual_color_secondary || '#f9fafb';
    const text = config.visual_color_text || '#1f2937';
    const highlight = config.visual_color_highlight || '#fbbf24';

    return (
        <div className="border-8 border-gray-900 rounded-[2.5rem] overflow-hidden shadow-2xl bg-white max-w-[320px] mx-auto relative aspect-[9/19]">
            {/* Status Bar Fake */}
            <div className="bg-gray-900 text-white text-[10px] px-6 py-2 flex justify-between items-center z-10 relative select-none">
                <span>9:41</span>
                <div className="flex gap-1">
                    <div className="w-3 h-3 bg-white rounded-full opacity-20"></div>
                    <div className="w-3 h-3 bg-white rounded-full opacity-20"></div>
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                </div>
            </div>

            {/* App Header */}
            <div style={{ backgroundColor: primary }} className="p-4 pt-2 text-white shadow-sm transition-colors duration-300">
                <div className="flex justify-between items-center mb-4">
                    <div className="bg-white/20 p-2 rounded-lg">
                        <Menu size={18} />
                    </div>
                    <div className="font-bold text-sm tracking-wide truncate max-w-[150px]">
                        {config.visual_title || 'Nome da Loja'}
                    </div>
                    <div className="bg-white/20 p-2 rounded-lg relative">
                        <ShoppingBag size={18} />
                        <span style={{ backgroundColor: highlight }} className="absolute -top-1 -right-1 text-[8px] w-4 h-4 flex items-center justify-center rounded-full font-bold text-gray-900">2</span>
                    </div>
                </div>

                {/* Search Bar Fake */}
                <div className="bg-white/90 rounded-lg p-2.5 flex items-center gap-2 text-gray-400 text-xs">
                    <Search size={14} />
                    <span>Buscar produtos...</span>
                </div>
            </div>

            {/* Content Area */}
            <div style={{ backgroundColor: secondary, color: text }} className="h-full overflow-hidden flex flex-col transition-colors duration-300">

                {/* Banner Placeholder */}
                <div className="h-32 bg-gray-200 mx-4 mt-4 rounded-xl animate-pulse flex items-center justify-center text-gray-400 text-xs font-medium">
                    Banner Promocional
                </div>

                {/* Categories */}
                <div className="p-4 pb-2">
                    <h3 className="font-bold text-xs mb-3 flex items-center gap-2" style={{ color: text }}>
                        <span className="w-1 h-4 rounded-full" style={{ backgroundColor: highlight }}></span>
                        Categorias
                    </h3>
                    <div className="flex gap-3 overflow-hidden">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex-shrink-0 flex flex-col items-center gap-2">
                                <div className="w-14 h-14 rounded-full bg-gray-100 shadow-sm border border-gray-100"></div>
                                <div className="w-10 h-2 bg-gray-200 rounded-full"></div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Product List */}
                <div className="flex-1 p-4 pt-0 space-y-3">
                    <h3 className="font-bold text-xs mb-2 flex items-center gap-2" style={{ color: text }}>
                        <span className="w-1 h-4 rounded-full" style={{ backgroundColor: highlight }}></span>
                        Destaques
                    </h3>
                    {[1, 2].map((i) => (
                        <div key={i} className="bg-white p-3 rounded-xl shadow-sm border border-gray-50 flex gap-3">
                            <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0"></div>
                            <div className="flex-1 flex flex-col justify-between py-1">
                                <div className="w-24 h-3 bg-gray-100 rounded animate-pulse"></div>
                                <div className="w-full h-2 bg-gray-50 rounded animate-pulse"></div>
                                <div className="flex justify-between items-end mt-2">
                                    <div className="font-bold text-xs" style={{ color: highlight }}>R$ 29,90</div>
                                    <div style={{ backgroundColor: primary }} className="w-6 h-6 rounded-full flex items-center justify-center text-white">
                                        <span className="text-xs">+</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-900 rounded-b-2xl z-20"></div>
        </div>
    );
}
