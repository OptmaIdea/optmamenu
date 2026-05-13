interface StockFieldsProps {
    stockQuantity: number;
    onStockQuantityChange: (value: number) => void;
    minStock: number;
    onMinStockChange: (value: number) => void;
    maxStock: number;
    onMaxStockChange: (value: number) => void;
}

export const StockFields = ({
    stockQuantity,
    onStockQuantityChange,
    minStock,
    onMinStockChange,
    maxStock,
    onMaxStockChange,
}: StockFieldsProps) => {
    return (
        <>
            <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Quantidade em Estoque
                </label>
                <input
                    type="number"
                    value={stockQuantity}
                    onChange={(e) => onStockQuantityChange(parseInt(e.target.value) || 0)}
                    min="0"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896]/20 focus:border-[#21A896] outline-none bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white"
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Mínimo
                    </label>
                    <input
                        type="number"
                        value={minStock}
                        onChange={(e) => onMinStockChange(parseInt(e.target.value) || 0)}
                        min="0"
                        className="w-full p-3 border border-yellow-200 dark:border-yellow-900/30 rounded-lg focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 outline-none bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Máximo (Alvo)
                    </label>
                    <input
                        type="number"
                        value={maxStock}
                        onChange={(e) => onMaxStockChange(parseInt(e.target.value) || 0)}
                        min="0"
                        className="w-full p-3 border border-blue-200 dark:border-blue-900/30 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white"
                    />
                </div>
            </div>
        </>
    );
};