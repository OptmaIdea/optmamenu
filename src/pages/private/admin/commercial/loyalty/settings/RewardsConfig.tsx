import { useState, useEffect, useCallback, memo } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader, Plus, Trash2, Upload, Image as ImageIcon, Search, Box, AlertCircle, Edit, ArrowLeft, LayoutList, Save, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { applyImageFallback, imageOrFallback, IMAGE_FALLBACKS } from '@/lib/imageFallbacks';

const DEFAULT_REWARD_IMAGE = IMAGE_FALLBACKS.reward;

// --- Types ---
interface Reward {
    id: string;
    program_id: string;
    title: string;
    description: string;
    points_cost: number;
    type: 'discount' | 'product' | 'free_shipping' | 'other' | 'money_plus_points' | 'product_plus_money';
    discount_amount?: number;
    discount_percentage?: number;
    max_discount_value?: number;
    min_order_value?: number;
    product_id?: string;
    product_quantity?: number;
    is_active: boolean;
    stock_quantity: number | null;
    max_redemptions_per_customer: number | null;
    voucher_validity_days: number;
    image_url?: string;
    additional_cash_cost?: number;
    offer_valid_until?: string;
}

interface Product {
    id: string;
    name: string;
    images?: string[];
    price: number;
    description?: string;
    active: boolean;
    category?: {
        name: string;
    };
}

interface RewardsConfigProps {
    storeId: string;
    programId: string;
}

// --- Helpers ---
const getDaysUntilExpiration = (dateString?: string) => {
    if (!dateString) return null;
    const today = new Date();
    const expiry = new Date(dateString);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
};

// --- Image Upload Helper ---
const uploadRewardImage = async (file: File, storeId: string): Promise<string | null> => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${storeId}/${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('reward-images')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('reward-images').getPublicUrl(filePath);
        return data.publicUrl;
    } catch (error) {
        console.error('Error uploading image:', error);
        toast.error('Erro ao fazer upload da imagem.');
        return null;
    }
};

const deleteRewardImage = async (imageUrl: string) => {
    try {
        // Protected images check
        if (!imageUrl) return;
        if (imageUrl === DEFAULT_REWARD_IMAGE || imageUrl.startsWith('/fallbacks/')) return;
        if (!imageUrl.includes('/reward-images/')) return; // Likely a product image or external

        const path = imageUrl.split('/reward-images/')[1];
        if (path) {
            await supabase.storage.from('reward-images').remove([path]);
        }
    } catch (e) {
        console.error("Error cleaning up image", e);
    }
}

// --- List Item Component (Row) ---
const RewardRow = ({ reward, onEdit }: { reward: Reward, onEdit: (r: Reward) => void }) => {
    let typeLabel = 'Outro';
    let typeColor = 'bg-gray-100 text-gray-600';

    if (reward.type === 'discount') { typeLabel = 'Desconto'; typeColor = 'bg-yellow-100 text-yellow-700'; }
    else if (reward.type === 'product') {
        if ((reward.additional_cash_cost || 0) > 0) { typeLabel = 'Produto+'; typeColor = 'bg-blue-100 text-blue-800 border-blue-200'; }
        else { typeLabel = 'Produto'; typeColor = 'bg-blue-100 text-blue-700'; }
    }
    else if (reward.type === 'other') {
        if ((reward.additional_cash_cost || 0) > 0) { typeLabel = 'Prêmio+'; typeColor = 'bg-purple-100 text-purple-700'; }
        else { typeLabel = 'Brinde'; typeColor = 'bg-purple-100 text-purple-600'; }
    }

    const daysLeft = getDaysUntilExpiration(reward.offer_valid_until);
    const isExpired = daysLeft !== null && daysLeft < 0;

    return (
        <div className="group flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition gap-4">
            {/* Image Avatar */}
            <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex-shrink-0 overflow-hidden relative border border-gray-200 dark:border-gray-600">
                {reward.image_url ? (
                    <img src={imageOrFallback(reward.image_url, 'reward')} onError={(event) => applyImageFallback(event, 'reward')} alt={reward.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ImageIcon size={20} />
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-gray-900 dark:text-gray-100 truncate text-sm">{reward.title}</h4>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide border border-transparent ${typeColor}`}>
                        {typeLabel}
                    </span>
                    {isExpired && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">EXPIRADO</span>}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span className="font-bold text-brand-green flex items-center gap-1">
                        {reward.points_cost} Pts
                    </span>
                    {reward.additional_cash_cost ? (
                        <span className="font-bold text-gray-700 dark:text-gray-300">
                            + R$ {reward.additional_cash_cost.toFixed(2)}
                        </span>
                    ) : null}

                    <span className="text-gray-300 hidden sm:inline">•</span>

                    {/* Stock Display */}
                    <span className={`flex items-center gap-1 ${reward.stock_quantity === 0 ? "text-red-500 font-bold" : ""}`}>
                        <Box size={10} />
                        Estoque: {reward.stock_quantity === null ? '∞' : reward.stock_quantity}
                    </span>

                    {/* Expiration Display */}
                    {daysLeft !== null && !isExpired && (
                        <>
                            <span className="text-gray-300 hidden sm:inline">•</span>
                            <span className={`flex items-center gap-1 ${daysLeft <= 3 ? 'text-orange-500 font-bold' : ''}`}>
                                <Clock size={10} />
                                Expira em {daysLeft} dias
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Actions */}
            <button
                onClick={() => onEdit(reward)}
                className="p-2 text-gray-400 hover:text-brand-green hover:bg-green-50 rounded-lg transition"
                title="Editar"
            >
                <Edit size={18} />
            </button>
        </div>
    );
};


// --- Reward Form ---
const RewardForm = memo(({ initialData, onSave, onDelete, products, onCancel, isNew }: {
    initialData: Reward,
    onSave: (data: Reward, imageFile: File | null) => Promise<void>,
    onDelete: (id: string, imageUrl?: string) => void,
    products: Product[],
    onCancel: () => void,
    isNew: boolean
}) => {
    // Local State
    const [formData, setFormData] = useState<Reward>(initialData);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>(imageOrFallback(initialData.image_url, 'reward'));
    const [saving, setSaving] = useState(false);

    // Group Products by Category
    const productsByCategory = products.reduce((acc, product) => {
        const catName = product.category?.name || 'Sem Categoria';
        if (!acc[catName]) acc[catName] = [];
        acc[catName].push(product);
        return acc;
    }, {} as Record<string, Product[]>);

    // Determine "UI Type"
    const getUiTypeFromReward = (r: Reward) => {
        if (r.type === 'discount') return 'discount';
        if (r.type === 'product') return (r.additional_cash_cost || 0) > 0 ? 'product_plus' : 'product';
        if (r.type === 'other') return (r.additional_cash_cost || 0) > 0 ? 'gift_plus' : 'gift';
        return 'other';
    };

    const [uiType, setUiType] = useState(() => getUiTypeFromReward(initialData));

    // Handle Image Selection (Local Preview only)
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setImageFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    };

    // Handle UI Type Change
    const handleUiTypeChange = (newUiType: string) => {
        setUiType(newUiType);
        let updates: Partial<Reward> = {};
        if (newUiType === 'discount') {
            updates = { type: 'discount', product_id: undefined, additional_cash_cost: 0 };
        } else if (newUiType === 'product') {
            updates = { type: 'product', additional_cash_cost: 0 };
        } else if (newUiType === 'product_plus') {
            updates = { type: 'product' };
        } else if (newUiType === 'gift') {
            updates = { type: 'other', product_id: undefined, additional_cash_cost: 0 };
        } else if (newUiType === 'gift_plus') {
            updates = { type: 'other', product_id: undefined };
        }
        setFormData(prev => ({ ...prev, ...updates }));
    };

    // Handle Product Selection
    const handleProductSelect = (prodId: string) => {
        const prod = products.find(p => p.id === prodId);
        if (prod) {
            const prodImage = (prod.images && prod.images.length > 0) ? prod.images[0] : undefined;
            setFormData(prev => ({
                ...prev,
                product_id: prod.id,
                title: prev.title === 'Novo Prêmio' || !prev.title ? prod.name : prev.title,
                image_url: prodImage || prev.image_url // Use product image if available
            }));

            // If they haven't uploaded a custom file, show the product image
            if (!imageFile && prodImage) {
                setPreviewUrl(prodImage);
            }
        } else {
            setFormData(prev => ({ ...prev, product_id: undefined }));
        }
    };

    const handleSaveClick = async () => {
        setSaving(true);
        try {
            await onSave(formData, imageFile);
        } catch (error) {
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="animate-slideIn max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={onCancel}
                    className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-500"
                    title="Cancelar"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        {formData.title || 'Novo Prêmio'}
                    </h2>
                    <p className="text-xs text-gray-500">{isNew ? 'Criando novo prêmio' : 'Editando informações'}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {!isNew && (
                        <button
                            onClick={() => onDelete(formData.id, formData.image_url)}
                            className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 shadow-sm transition text-sm font-bold flex items-center gap-2"
                        >
                            <Trash2 size={16} /> <span className="hidden sm:inline">Excluir</span>
                        </button>
                    )}
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition text-sm font-bold"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSaveClick}
                        disabled={saving}
                        className="px-4 py-2 bg-brand-green text-white rounded-lg hover:bg-green-600 shadow-sm transition text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                    >
                        {saving ? <Loader className="animate-spin" size={16} /> : <Save size={16} />}
                        Salvar
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
                {/* Image Area */}
                <div className="relative w-full aspect-video bg-gray-50 dark:bg-gray-900/50 rounded-xl mb-6 overflow-hidden group/image border border-gray-100 dark:border-gray-700">
                    {previewUrl ? (
                        <img src={imageOrFallback(previewUrl, 'reward')} onError={(event) => applyImageFallback(event, 'reward')} alt={formData.title} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 dark:text-gray-600">
                            <ImageIcon size={48} className="mb-2 opacity-50" />
                            <span className="text-xs font-bold">Sem Foto</span>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition flex items-center justify-center backdrop-blur-sm">
                        <label className="cursor-pointer bg-white text-gray-900 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-gray-50 transition transform hover:scale-105 shadow-lg">
                            <Upload size={16} />
                            Alterar Imagem
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageSelect} />
                        </label>
                    </div>
                </div>

                {/* Content Form */}
                <div className="space-y-6">

                    {/* Type Selector */}
                    <div>
                        <label className="text-xs font-bold uppercase text-gray-500 mb-2 block">Tipo de Recompensa</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {['discount', 'product', 'product_plus', 'gift', 'gift_plus'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => handleUiTypeChange(type)}
                                    className={`p-3 rounded-xl border text-left text-sm font-medium transition flex items-center gap-2
                                        ${uiType === type
                                            ? 'border-brand-green bg-brand-green/5 text-brand-green ring-1 ring-brand-green'
                                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                        }`}
                                >
                                    {type === 'discount' && 'Descontos'}
                                    {type === 'product' && 'Produtos grátis'}
                                    {type === 'product_plus' && 'Produtos + valor'}
                                    {type === 'gift' && 'Brindes e outros'}
                                    {type === 'gift_plus' && 'Brindes + valor'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* PRODUCT Selection */}
                    {(uiType === 'product' || uiType === 'product_plus') && (
                        <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30">
                            <div>
                                <label className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 mb-1 block">Produto Vinculado</label>
                                <select
                                    value={formData.product_id || ''}
                                    onChange={(e) => handleProductSelect(e.target.value)}
                                    className="w-full bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                                >
                                    <option value="">Selecione um produto...</option>
                                    {Object.entries(productsByCategory).map(([category, prods]) => (
                                        <optgroup key={category} label={category}>
                                            {prods.map(p => (
                                                <option key={p.id} value={p.id}>{p.name} - R$ {p.price.toFixed(2)}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-24">
                                    <label className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 mb-1 block">Quantidade</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.product_quantity || 1}
                                        onChange={(e) => setFormData(prev => ({ ...prev, product_quantity: Number(e.target.value) }))}
                                        className="w-full p-2 text-center bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg text-gray-900 dark:text-white font-bold"
                                    />
                                </div>
                                <p className="text-xs text-blue-400 mt-5 flex-1 leading-tight">Este item será descontado do estoque do produto ao ser resgatado.</p>
                            </div>
                        </div>
                    )}

                    {/* DISCOUNT Rules */}
                    {uiType === 'discount' && (
                        <div className="space-y-3 p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl border border-yellow-100 dark:border-yellow-800/30">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-yellow-600 dark:text-yellow-400 mb-1 block">% Desconto</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={formData.discount_percentage || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, discount_percentage: Number(e.target.value) }))}
                                            className="w-full p-2 pr-8 text-center bg-white dark:bg-gray-800 border border-yellow-200 dark:border-yellow-800 rounded-lg text-gray-900 dark:text-white font-bold"
                                        />
                                        <span className="absolute right-3 top-2 text-yellow-500 font-bold">%</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-yellow-600 dark:text-yellow-400 mb-1 block">Teto Máx (R$)</label>
                                    <input
                                        type="number"
                                        placeholder="Sem limite"
                                        value={formData.max_discount_value || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, max_discount_value: Number(e.target.value) }))}
                                        className="w-full p-2 text-center bg-white dark:bg-gray-800 border border-yellow-200 dark:border-yellow-800 rounded-lg text-gray-900 dark:text-white font-bold"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase text-yellow-600 dark:text-yellow-400 mb-1 block">Pedido Mínimo (R$)</label>
                                <input
                                    type="number"
                                    placeholder="0,00"
                                    value={formData.min_order_value || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, min_order_value: Number(e.target.value) }))}
                                    className="w-full p-2 bg-white dark:bg-gray-800 border border-yellow-200 dark:border-yellow-800 rounded-lg text-gray-900 dark:text-white font-bold"
                                />
                            </div>
                        </div>
                    )}

                    {/* COMMON FIELDS */}
                    <div>
                        <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Nome do Prêmio</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Nome do voucher..."
                            className="w-full p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-bold text-lg outline-none focus:border-brand-green"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase text-gray-400 mb-1 block">Regras / Detalhes</label>
                        <textarea
                            value={formData.description || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Ex: Válido apenas para consumo na loja..."
                            className="w-full p-3 h-24 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-300 text-sm resize-none outline-none focus:border-brand-green"
                        />
                    </div>

                    {/* Cost Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-brand-green/5 rounded-lg p-3 border border-brand-green/20">
                            <label className="text-[10px] font-bold uppercase text-brand-green mb-1 block">Custo em Pontos</label>
                            <input
                                type="number"
                                value={formData.points_cost}
                                onChange={(e) => setFormData(prev => ({ ...prev, points_cost: Number(e.target.value) }))}
                                className="w-full bg-transparent text-2xl font-black text-brand-green outline-none"
                            />
                        </div>
                        {(uiType.includes('plus') || uiType === 'discount') && (
                            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                                <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">+ Custo em Dinheiro (R$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={formData.additional_cash_cost || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, additional_cash_cost: Number(e.target.value) }))}
                                    className="w-full bg-transparent text-2xl font-bold text-gray-800 dark:text-white outline-none"
                                />
                            </div>
                        )}
                    </div>

                    {/* LIMITS SECTION */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                        <div>
                            <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block flex items-center gap-1"><Box size={12} /> Estoque Total</label>
                            <input
                                type="number"
                                placeholder="Ilimitado"
                                value={formData.stock_quantity ?? ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, stock_quantity: e.target.value ? Number(e.target.value) : null }))}
                                className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white font-bold"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block flex items-center gap-1"><AlertCircle size={12} /> Limite/Cliente</label>
                            <input
                                type="number"
                                placeholder="Ilimitado"
                                value={formData.max_redemptions_per_customer ?? ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, max_redemptions_per_customer: e.target.value ? Number(e.target.value) : null }))}
                                className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white font-bold"
                            />
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Validade Voucher</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={formData.voucher_validity_days || 15}
                                    onChange={(e) => setFormData(prev => ({ ...prev, voucher_validity_days: Number(e.target.value) }))}
                                    className="w-full p-2 pr-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white font-bold"
                                />
                                <span className="absolute right-3 top-2 text-xs text-gray-400 font-bold">dias</span>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Oferta Válida Até</label>
                            <input
                                type="date"
                                value={formData.offer_valid_until ? formData.offer_valid_until.split('T')[0] : ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, offer_valid_until: e.target.value ? new Date(e.target.value).toISOString() : undefined }))}
                                className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white font-bold"
                            />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
});


// --- MAIN Rewards Component ---
export default function RewardsConfig({ storeId, programId }: RewardsConfigProps) {
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'product' | 'discount' | 'gift'>('all');

    // UI State
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        if (programId && storeId) {
            fetchData();
        }
    }, [programId, storeId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Rewards
            const { data: rw, error: rwError } = await supabase
                .from('fidelity_rewards')
                .select('*')
                .eq('program_id', programId)
                .order('created_at', { ascending: false });

            if (rwError) throw rwError;
            setRewards(rw || []);

            // Fetch Products with Categories
            const { data: pr, error: prError } = await supabase
                .from('products')
                .select('id, name, images, price, description, active, category:categories(name)')
                .eq('store_id', storeId)
                .eq('active', true);

            if (prError) console.error("Error fetching products", prError);

            // Parse images
            const parsedProducts: Product[] = (pr || []).map((p: any) => {
                let parsedImages: string[] = [];
                if (Array.isArray(p.images)) {
                    parsedImages = p.images;
                } else if (typeof p.images === 'string') {
                    try {
                        if (p.images.startsWith('{')) {
                            parsedImages = p.images.replace(/^{|}$/g, '').split(',');
                        } else {
                            parsedImages = JSON.parse(p.images);
                        }
                    } catch (e) {
                        parsedImages = [];
                    }
                }
                return { ...p, images: parsedImages };
            });

            setProducts(parsedProducts);

        } catch (error) {
            console.error(error);
            toast.error("Erro ao carregar prêmios");
        } finally {
            setLoading(false);
        }
    };

    const handleAddReward = () => {
        setEditingId('new');
    };

    const handleSaveReward = async (data: Reward, imageFile: File | null) => {
        let finalImageUrl = data.image_url;

        // 1. Handle File Upload
        if (imageFile) {
            const uploadedUrl = await uploadRewardImage(imageFile, storeId);
            if (uploadedUrl) {
                finalImageUrl = uploadedUrl;
            }
        }

        // 2. Logic for Default/Product Image if NO file uploaded
        if (!imageFile) {
            if (!finalImageUrl) {
                finalImageUrl = DEFAULT_REWARD_IMAGE;
            }
        }

        const payload = {
            ...data,
            image_url: finalImageUrl,
            program_id: programId
        };

        const { id, ...insertPayload } = payload;

        if (editingId === 'new') {
            const { data: newRecord, error } = await supabase.from('fidelity_rewards').insert([insertPayload]).select().maybeSingle();
            if (error) {
                toast.error('Erro ao criar: ' + error.message);
            } else {
                setRewards(prev => [newRecord, ...prev]);
                toast.success('Prêmio criado com sucesso!');
                setEditingId(null);
            }
        } else {
            const { error } = await supabase.from('fidelity_rewards').update(payload).eq('id', editingId);
            if (error) {
                toast.error('Erro ao atualizar: ' + error.message);
            } else {
                setRewards(prev => prev.map(r => r.id === editingId ? { ...r, ...payload } : r));
                toast.success('Prêmio atualizado!');
                setEditingId(null);
            }
        }
    };

    const handleDeleteReward = useCallback(async (id: string, imageUrl?: string) => {
        if (!confirm('Tem certeza que deseja excluir esta recompensa?')) return;

        if (imageUrl) {
            await deleteRewardImage(imageUrl);
        }

        const { error } = await supabase.from('fidelity_rewards').delete().eq('id', id);
        if (error) {
            toast.error('Erro ao excluir: ' + error.message);
        } else {
            setRewards(prev => prev.filter(r => r.id !== id));
            setEditingId(null);
            toast.success('Recompensa excluída');
        }
    }, []);

    // Filter Rewards
    const filteredRewards = rewards.filter(reward => {
        const matchesSearch = (reward.title?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        let matchesType = true;
        if (filterType === 'product') matchesType = reward.type === 'product';
        if (filterType === 'discount') matchesType = reward.type === 'discount';
        if (filterType === 'gift') matchesType = reward.type === 'other';
        return matchesSearch && matchesType;
    });

    const activeReward = editingId === 'new'
        ? {
            id: '',
            program_id: programId,
            title: '',
            description: '',
            points_cost: 100,
            type: 'discount' as const,
            is_active: true,
            stock_quantity: null,
            max_redemptions_per_customer: null,
            voucher_validity_days: 15,
            additional_cash_cost: 0,
            image_url: undefined
        }
        : rewards.find(r => r.id === editingId);

    // --- VIEW RENDER ---
    if (editingId && activeReward) {
        return (
            <RewardForm
                initialData={activeReward}
                onSave={handleSaveReward}
                onDelete={handleDeleteReward}
                products={products}
                onCancel={() => setEditingId(null)}
                isNew={editingId === 'new'}
            />
        );
    }

    return (
        <div className="animate-fadeIn space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
                    <button onClick={() => setFilterType('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${filterType === 'all' ? 'bg-brand-green text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>Todos</button>
                    <button onClick={() => setFilterType('product')} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${filterType === 'product' ? 'bg-brand-green text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>Produtos</button>
                    <button onClick={() => setFilterType('discount')} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${filterType === 'discount' ? 'bg-brand-green text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>Descontos</button>
                    <button onClick={() => setFilterType('gift')} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${filterType === 'gift' ? 'bg-brand-green text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>Brindes</button>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full p-2 pl-9 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
                        />
                    </div>
                    <button
                        onClick={handleAddReward}
                        className="bg-brand-green text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-md hover:bg-green-600 transition whitespace-nowrap text-sm"
                    >
                        <Plus size={16} /> Novo Prêmio
                    </button>
                </div>
            </div>

            {/* List Header/Legend */}
            {filteredRewards.length > 0 && (
                <div className="px-4 text-[10px] uppercase font-bold text-gray-400 grid grid-cols-[50px_1fr_40px] gap-4">
                    <span>Img</span>
                    <span>Detalhes do Prêmio</span>
                    <span></span>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-10"><Loader className="animate-spin text-brand-green" /></div>
            ) : filteredRewards.length === 0 ? (
                <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <LayoutList size={40} className="mx-auto mb-2 opacity-50" />
                    <p>Nenhuma recompensa encontrada</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredRewards.map(reward => (
                        <RewardRow
                            key={reward.id}
                            reward={reward}
                            onEdit={(r) => setEditingId(r.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
