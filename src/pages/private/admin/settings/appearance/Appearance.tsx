import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { getActiveStoreId } from '@/utils/activeStore';
import {
    Save,
    Loader,
    Smartphone,
    Palette,
    Type,
    Image as ImageIcon,
    CheckCircle,
    AlertCircle,
    Upload,
    Globe,
    ExternalLink,
    Copy,
    Phone,
    Mail,
    Instagram,
    Facebook,
    LayoutTemplate,
    MessageCircle,
    Star
} from 'lucide-react';
import type { StoreConfig } from '@/types';
import StorePreview from '@/components/admin/StorePreview';
import PageContainer from '@/components/common/PageContainer';

interface ColorInputProps {
    label: string;
    value?: string;
    placeholder: string;
    disabled?: boolean;
    onChange: (newValue: string) => void;
}

const ColorInput = ({ label, value, placeholder, disabled = false, onChange }: ColorInputProps) => {
    const [localValue, setLocalValue] = useState(value?.replace('#', '') || '');

    useEffect(() => {
        setLocalValue(value?.replace('#', '') || '');
    }, [value]);

    const handleBlur = () => {
        if (disabled) return;

        let cleanHex = localValue.replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
        if (cleanHex.length > 6) cleanHex = cleanHex.slice(0, 6);
        onChange('#' + cleanHex);
    };

    return (
        <div
            className="flex flex-col gap-2"
            title={disabled ? 'Você não tem permissão para executar esta alteração.' : undefined}
        >
            <label className="text-xs font-bold text-gray-500 uppercase">{label}</label>
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg border border-gray-200 dark:border-gray-600 focus-within:ring-2 focus-within:ring-brand-green">
                <div className="relative">
                    <input
                        type="color"
                        value={value || '#000000'}
                        disabled={disabled}
                        onChange={(e) => {
                            if (disabled) return;
                            onChange(e.target.value.toUpperCase());
                        }}
                        className="h-10 w-10 rounded-lg cursor-pointer border-none bg-transparent disabled:cursor-not-allowed disabled:opacity-60"
                    />
                </div>

                <div className="flex items-center flex-1">
                    <span className="text-gray-400 font-mono select-none">#</span>
                    <input
                        type="text"
                        value={localValue}
                        disabled={disabled}
                        onChange={(e) => {
                            if (disabled) return;
                            setLocalValue(e.target.value);
                        }}
                        onBlur={handleBlur}
                        className="w-full bg-transparent text-sm font-mono font-bold outline-none text-gray-700 dark:text-gray-200 uppercase p-1 disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder={placeholder.replace('#', '')}
                    />
                </div>
            </div>
        </div>
    );
};

export default function Config({ withoutHeader = false, disabled = false }: { withoutHeader?: boolean; disabled?: boolean } = {}) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [storeId, setStoreId] = useState<string | null>(null);
    const [storeSlug, setStoreSlug] = useState<string | null>(null);
    const [uploadingAbout, setUploadingAbout] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [config, setConfig] = useState<StoreConfig>({
        timer_duration_minutes: 10,
        extension_minutes: 10,
        visual_title: '',
        visual_icon_url: '',
        visual_color_primary: '#00D65F',
        visual_color_secondary: '#f9fafb',
        visual_color_text: '#1f2937',
        visual_color_highlight: '#fbbf24',
        visual_banner_url: '',
        visual_slogan: '',
        about_text: '',
        about_image_url: '',
        contact_phone: '',
        contact_email: '',
        contact_whatsapp_support: '',
        contact_address: '',
        contact_map_link: '', // ✅ você usa no JSX
        social_links: {
            instagram: '',
            facebook: '',
            website: '',
            twitter: '',
            tiktok: '',
            google_reviews: ''
        },
        footer_text: '',
        footer_show_contact: true
    });

    const [activeTab, setActiveTab] = useState<'visual' | 'institutional' | 'contact'>('visual');

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            setLoading(true);

            const activeStoreId = getActiveStoreId();

            if (!activeStoreId) {
                setMessage({ type: 'error', text: 'Nenhuma loja ativa selecionada.' });
                toast.error('Nenhuma loja ativa selecionada.');
                return;
            }

            const { data, error } = await supabase.rpc('get_store_settings_center', {
                p_store_id: activeStoreId,
            });

            if (error) throw error;

            const store = Array.isArray(data) ? data[0] : data;

            if (!store?.id) {
                setMessage({ type: 'error', text: 'Loja ativa não encontrada.' });
                toast.error('Loja ativa não encontrada.');
                return;
            }

            setStoreId(store.id);
            setStoreSlug(store.slug);

            setConfig(prev => ({
                ...prev,
                ...(store.config || {}),
                social_links: {
                    ...prev.social_links,
                    ...(store.config?.social_links || {}),
                },
            }));
        } catch (error) {
            console.error('Error fetching config:', error);
            setMessage({ type: 'error', text: 'Erro ao carregar configurações.' });
            toast.error('Erro ao carregar Aparência da Loja.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        const resolvedStoreId = storeId || getActiveStoreId();

        if (!resolvedStoreId) {
            toast.error('Loja ativa não encontrada. Atualize a página e tente novamente.');
            setMessage({ type: 'error', text: 'Loja ativa não encontrada.' });
            return;
        }

        if (disabled) {
            toast.error('Você não tem permissão para executar esta alteração.');
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            // ✅ UPDATE direto pode ficar (escrita)
            const { error } = await supabase
                .from('stores')
                .update({ config })
                .eq('id', resolvedStoreId);

            if (error) throw error;
            setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
            toast.success('Aparência da Loja salva com sucesso.');
        } catch (error: any) {
            console.error('Error saving config:', error);
            setMessage({ type: 'error', text: 'Erro ao salvar: ' + error.message });
            toast.error('Erro ao salvar Aparência da Loja.');
        } finally {
            setSaving(false);
        }
    };

    const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) {
            toast.error('Você não tem permissão para executar esta alteração.');
            return;
        }
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `favicon-${Math.random()}.${fileExt}`;
        const filePath = `store-assets/${fileName}`;

        try {
            setSaving(true);
            const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, file);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(filePath);

            setConfig(prev => ({ ...prev, visual_icon_url: publicUrl }));
            setMessage({ type: 'success', text: 'Ícone carregado! Clique em salvar.' });
        } catch (error: any) {
            setMessage({ type: 'error', text: 'Erro no upload: ' + error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) {
            toast.error('Você não tem permissão para executar esta alteração.');
            return;
        }
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `banner-${Math.random()}.${fileExt}`;
        const filePath = `store-assets/${fileName}`;

        try {
            setSaving(true);
            const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, file);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(filePath);

            setConfig(prev => ({ ...prev, visual_banner_url: publicUrl }));
            setMessage({ type: 'success', text: 'Banner carregado! Clique em salvar.' });
        } catch (error: any) {
            setMessage({ type: 'error', text: 'Erro no upload: ' + error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleAboutImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) {
            toast.error('Você não tem permissão para executar esta alteração.');
            return;
        }
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `about-${Math.random()}.${fileExt}`;
        const filePath = `store-assets/${fileName}`;

        try {
            setSaving(true);
            setUploadingAbout(true);

            const { error: uploadError } = await supabase.storage
                .from('logos')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(filePath);

            setConfig(prev => ({ ...prev, about_image_url: publicUrl }));
            setMessage({ type: 'success', text: 'Imagem "Quem Somos" carregada!' });
        } catch (error: any) {
            console.error('Upload error:', error);
            setMessage({ type: 'error', text: 'Erro no upload: ' + error.message });
        } finally {
            setSaving(false);
            setUploadingAbout(false);
            e.target.value = '';
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><Loader className="animate-spin text-brand-green" /></div>;

    return (
        <PageContainer
            title="Personalização"
            subtitle="Configure o comportamento e a aparência do seu App."
            category="Configurações"
            icon={<Smartphone className="text-[#21A896]" size={28} />}
            action={
                !disabled && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-[#21A896] hover:bg-[#1a867a] text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition disabled:opacity-70 cursor-pointer text-sm shadow-sm"
                    >
                        {saving ? <Loader className="animate-spin" size={16} /> : <Save size={16} />}
                        <span>Salvar Configurações</span>
                    </button>
                )
            }
            withoutHeader={withoutHeader}
            flat
        >

            {message && (
                <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 shadow-sm border animate-fade-in ${message.type === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-green-50 border-green-100 text-green-700'}`}>
                    {message.type === 'error' ? <AlertCircle size={24} /> : <CheckCircle size={24} />}
                    <span className="font-medium">{message.text}</span>
                </div>
            )}

            {/* Tabs Navigation */}
            {!disabled && (
                <div className="flex justify-end mb-6 animate-fadeIn">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-[#21A896] hover:bg-[#1a867a] text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition disabled:opacity-70 cursor-pointer text-sm shadow-sm"
                    >
                        {saving ? <Loader className="animate-spin" size={16} /> : <Save size={16} />}
                        <span>Salvar Aparência da Loja</span>
                    </button>
                </div>
            )}
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
                <button
                    onClick={() => setActiveTab('visual')}
                    className={`px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition flex items-center gap-2 ${activeTab === 'visual' ? 'bg-brand-green text-white shadow-lg shadow-green-200 dark:shadow-none' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50'}`}
                >
                    <Palette size={18} /> Personalizar catálogo
                </button>
                <button
                    onClick={() => setActiveTab('institutional')}
                    className={`px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition flex items-center gap-2 ${activeTab === 'institutional' ? 'bg-brand-green text-white shadow-lg shadow-green-200 dark:shadow-none' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50'}`}
                >
                    <LayoutTemplate size={18} /> Institucional
                </button>
                <button
                    onClick={() => setActiveTab('contact')}
                    className={`px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition flex items-center gap-2 ${activeTab === 'contact' ? 'bg-brand-green text-white shadow-lg shadow-green-200 dark:shadow-none' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50'}`}
                >
                    <Phone size={18} /> Contato e social
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Configuration Column */}
                <div className="lg:col-span-7 space-y-8">
                    {/* VISUAL & APP TAB */}
                    {activeTab === 'visual' && (
                        <div className="space-y-8 animate-fade-in">
                            {/* Basic Info */}
                            <section className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                                <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                                    <Type className="text-purple-500" size={20} /> Identidade
                                </h2>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nome do Aplicativo</label>
                                        <input
                                            type="text"
                                            value={config.visual_title}
                                            onChange={(e) => setConfig({ ...config, visual_title: e.target.value })}
                                            placeholder="Ex: Delivery do João"
                                            className="w-full p-4 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl font-medium focus:ring-2 focus:ring-purple-400 outline-none transition"
                                            disabled={disabled}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Logo / Favicon</label>
                                        <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-200 dark:border-gray-600 border-dashed">
                                            <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-lg shadow-sm flex items-center justify-center overflow-hidden">
                                                {config.visual_icon_url ? (
                                                    <img src={config.visual_icon_url} alt="Icon" className="w-full h-full object-cover" />
                                                ) : (
                                                    <ImageIcon className="text-gray-300" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                {!disabled && (
                                                    <label className="cursor-pointer bg-white dark:bg-gray-600 hover:bg-gray-50 text-gray-700 dark:text-white font-bold px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-500 shadow-sm transition inline-flex items-center gap-2 text-sm">
                                                        <Upload size={14} /> Carregar Imagem
                                                        <input type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
                                                    </label>
                                                )}
                                                <p className="text-xs text-gray-400 mt-2">Recomendado: 64x64px ou 128x128px</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Colors */}
                            <section className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                        <Palette className="text-brand-green" size={20} /> Paleta de Cores
                                    </h2>
                                    <a
                                        href="https://coolors.co/generate"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs font-bold text-gray-400 hover:text-brand-green flex items-center gap-1 transition"
                                    >
                                        Gerador <ExternalLink size={10} />
                                    </a>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <ColorInput label="Cor Principal (Header)" value={config.visual_color_primary} placeholder="#00D65F" disabled={disabled} onChange={(val) => setConfig({ ...config, visual_color_primary: val })} />
                                    <ColorInput label="Cor de Fundo" value={config.visual_color_secondary} placeholder="#F9FAFB" disabled={disabled} onChange={(val) => setConfig({ ...config, visual_color_secondary: val })} />
                                    <ColorInput label="Cor do Texto" value={config.visual_color_text} placeholder="#1F2937" disabled={disabled} onChange={(val) => setConfig({ ...config, visual_color_text: val })} />
                                    <ColorInput label="Cor de Destaque" value={config.visual_color_highlight} placeholder="#FBBF24" disabled={disabled} onChange={(val) => setConfig({ ...config, visual_color_highlight: val })} />
                                </div>
                            </section>

                            {/* Banner */}
                            <section className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                                <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                                    <ImageIcon className="text-pink-500" size={20} /> Banner Promocional
                                </h2>
                                <div className="space-y-4">
                                    <div className="relative w-full h-40 bg-gray-50 dark:bg-gray-700/50 rounded-xl overflow-hidden border-2 border-dashed border-gray-200 dark:border-gray-600 flex items-center justify-center group">
                                        {config.visual_banner_url ? (
                                            <>
                                                <img src={config.visual_banner_url} alt="Banner" className="w-full h-full object-cover" />
                                                {!disabled && (
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                                        <label className="cursor-pointer bg-white text-gray-800 font-bold px-4 py-2 rounded-lg shadow-lg transform scale-95 group-hover:scale-100 transition">
                                                            Trocar Banner
                                                            <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
                                                        </label>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            !disabled ? (
                                                <label className="cursor-pointer flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-brand-green transition">
                                                    <Upload size={32} />
                                                    <span className="font-bold text-sm">Carregar Banner (1200x400px)</span>
                                                    <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
                                                </label>
                                            ) : (
                                                <span className="font-bold text-sm text-gray-400">Sem Banner</span>
                                            )
                                        )}
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {/* INSTITUTIONAL TAB */}
                    {activeTab === 'institutional' && (
                        <div className="space-y-8 animate-fade-in">
                            <section className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                                <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                                    <LayoutTemplate className="text-blue-500" size={20} /> Cabeçalho e Rodapé
                                </h2>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Slogan (Aparece abaixo do nome)</label>
                                        <input
                                            type="text"
                                            value={config.visual_slogan || ''}
                                            onChange={(e) => setConfig({ ...config, visual_slogan: e.target.value })}
                                            placeholder="Ex: O melhor sabor da região"
                                            className="w-full p-4 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl font-medium focus:ring-2 focus:ring-blue-400 outline-none transition"
                                            disabled={disabled}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Frase do Rodapé</label>
                                        <input
                                            type="text"
                                            value={config.footer_text || ''}
                                            onChange={(e) => setConfig({ ...config, footer_text: e.target.value })}
                                            placeholder="Ex: Feito com amor para você."
                                            className="w-full p-4 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl font-medium focus:ring-2 focus:ring-blue-400 outline-none transition"
                                            disabled={disabled}
                                        />
                                    </div>
                                </div>
                            </section>

                            <section className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                                <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                                    <Globe className="text-teal-500" size={20} /> Quem Somos
                                </h2>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Foto da Seção (Opcional)</label>
                                        <div className="relative w-full h-40 bg-gray-50 dark:bg-gray-700/50 rounded-xl overflow-hidden border-2 border-dashed border-gray-200 dark:border-gray-600 flex items-center justify-center group">
                                            {uploadingAbout ? (
                                                <div className="flex flex-col items-center gap-2 text-brand-green">
                                                    <Loader className="animate-spin" size={32} />
                                                    <span className="text-xs font-bold">Enviando...</span>
                                                </div>
                                            ) : config.about_image_url ? (
                                                <>
                                                    <img src={config.about_image_url} alt="Quem Somos" className="w-full h-full object-cover" />
                                                    {!disabled && (
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                                            <label className="cursor-pointer bg-white text-gray-800 font-bold px-4 py-2 rounded-lg shadow-lg transform scale-95 group-hover:scale-100 transition">
                                                                Trocar Foto
                                                                <input type="file" accept="image/*" className="hidden" onChange={handleAboutImageUpload} />
                                                            </label>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                !disabled ? (
                                                    <label className="cursor-pointer flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-brand-green transition">
                                                        <Upload size={32} />
                                                        <span className="font-bold text-sm">Carregar Foto</span>
                                                        <input type="file" accept="image/*" className="hidden" onChange={handleAboutImageUpload} />
                                                    </label>
                                                ) : (
                                                    <span className="font-bold text-sm text-gray-400">Sem Imagem</span>
                                                )
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Texto "Sobre Nós" (Máx 500 caracteres)</label>
                                        <textarea
                                            value={config.about_text || ''}
                                            maxLength={500}
                                            onChange={(e) => {
                                                const text = e.target.value;
                                                setConfig({ ...config, about_text: text.slice(0, 500) });
                                            }}
                                            placeholder="Conte um pouco da sua história..."
                                            rows={5}
                                            className="w-full p-4 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl font-medium focus:ring-2 focus:ring-teal-400 outline-none transition resize-none"
                                            disabled={disabled}
                                        />
                                        <div className="text-right text-xs text-gray-400 mt-1">
                                            {(config.about_text || '').length}/500
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {/* CONTACT TAB */}
                    {activeTab === 'contact' && (
                        <div className="space-y-8 animate-fade-in">
                            <section className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                                <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                                    <Phone className="text-green-500" size={20} /> Canais de Contato
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">WhatsApp Fale Conosco</label>
                                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-xl border border-gray-200 dark:border-gray-600">
                                            <MessageCircle size={20} className="text-green-500 ml-2" />
                                            <input
                                                type="text"
                                                value={config.contact_whatsapp_support || ''}
                                                onChange={(e) => setConfig({ ...config, contact_whatsapp_support: e.target.value })}
                                                placeholder="5511999999999"
                                                className="w-full bg-transparent p-2 outline-none text-gray-700 dark:text-gray-300 font-mono"
                                                disabled={disabled}
                                            />
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">Aparecerá no botão flutuante.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Email de Contato</label>
                                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-xl border border-gray-200 dark:border-gray-600">
                                            <Mail size={20} className="text-gray-400 ml-2" />
                                            <input
                                                type="email"
                                                value={config.contact_email || ''}
                                                onChange={(e) => setConfig({ ...config, contact_email: e.target.value })}
                                                placeholder="contato@loja.com"
                                                className="w-full bg-transparent p-2 outline-none text-gray-700 dark:text-gray-300"
                                                disabled={disabled}
                                            />
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Endereço Completo</label>
                                        <input
                                            type="text"
                                            value={config.contact_address || ''}
                                            onChange={(e) => setConfig({ ...config, contact_address: e.target.value })}
                                            placeholder="Av. Paulista, 1000 - São Paulo, SP"
                                            className="w-full p-4 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl font-medium focus:ring-2 focus:ring-green-400 outline-none transition"
                                            disabled={disabled}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Link do Google Maps (Localização)</label>
                                        <input
                                            type="text"
                                            value={config.contact_map_link || ''}
                                            onChange={(e) => setConfig({ ...config, contact_map_link: e.target.value })}
                                            placeholder="Cole aqui o link de compartilhamento do Google Maps"
                                            className="w-full p-4 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl font-medium focus:ring-2 focus:ring-green-400 outline-none transition"
                                            disabled={disabled}
                                        />
                                        <p className="text-xs text-gray-400 mt-1">Vá no Google Maps, clique em "Compartilhar" e copie o link.</p>
                                    </div>
                                </div>
                            </section>

                            <section className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                                <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                                    <Globe className="text-indigo-500" size={20} /> Redes Sociais
                                </h2>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-xl border border-gray-200 dark:border-gray-600">
                                        <Instagram size={20} className="text-pink-600 ml-2" />
                                        <input
                                            type="text"
                                            value={config.social_links?.instagram || ''}
                                            onChange={(e) => setConfig({ ...config, social_links: { ...config.social_links, instagram: e.target.value } })}
                                            placeholder="instagram.com/sualoja"
                                            className="w-full bg-transparent p-2 outline-none text-gray-700 dark:text-gray-300"
                                            disabled={disabled}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-xl border border-gray-200 dark:border-gray-600">
                                        <Facebook size={20} className="text-blue-600 ml-2" />
                                        <input
                                            type="text"
                                            value={config.social_links?.facebook || ''}
                                            onChange={(e) => setConfig({ ...config, social_links: { ...config.social_links, facebook: e.target.value } })}
                                            placeholder="facebook.com/sualoja"
                                            className="w-full bg-transparent p-2 outline-none text-gray-700 dark:text-gray-300"
                                            disabled={disabled}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-xl border border-gray-200 dark:border-gray-600">
                                        <Globe size={20} className="text-gray-400 ml-2" />
                                        <input
                                            type="text"
                                            value={config.social_links?.website || ''}
                                            onChange={(e) => setConfig({ ...config, social_links: { ...config.social_links, website: e.target.value } })}
                                            placeholder="www.seusite.com.br"
                                            className="w-full bg-transparent p-2 outline-none text-gray-700 dark:text-gray-300"
                                            disabled={disabled}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-xl border border-gray-200 dark:border-gray-600">
                                        <div className="w-5 h-5 ml-2 flex items-center justify-center text-black dark:text-white font-bold text-xs">𝕏</div>
                                        <input
                                            type="text"
                                            value={config.social_links?.twitter || ''}
                                            onChange={(e) => setConfig({ ...config, social_links: { ...config.social_links, twitter: e.target.value } })}
                                            placeholder="twitter.com/sualoja"
                                            className="w-full bg-transparent p-2 outline-none text-gray-700 dark:text-gray-300"
                                            disabled={disabled}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-xl border border-gray-200 dark:border-gray-600">
                                        <div className="w-5 h-5 ml-2 flex items-center justify-center text-black dark:text-white font-bold text-xs">♪</div>
                                        <input
                                            type="text"
                                            value={config.social_links?.tiktok || ''}
                                            onChange={(e) => setConfig({ ...config, social_links: { ...config.social_links, tiktok: e.target.value } })}
                                            placeholder="tiktok.com/@sualoja"
                                            className="w-full bg-transparent p-2 outline-none text-gray-700 dark:text-gray-300"
                                            disabled={disabled}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-xl border border-gray-200 dark:border-gray-600">
                                        <Star size={20} className="text-yellow-500 ml-2" />
                                        <input
                                            type="text"
                                            value={config.social_links?.google_reviews || ''}
                                            onChange={(e) => setConfig({ ...config, social_links: { ...config.social_links, google_reviews: e.target.value } })}
                                            placeholder="Link do Google Maps para Avaliação"
                                            className="w-full bg-transparent p-2 outline-none text-gray-700 dark:text-gray-300"
                                            disabled={disabled}
                                        />
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}
                </div>

                {/* Preview Column */}
                <div className="lg:col-span-5">
                    <div className="sticky top-8">
                        <div className="flex flex-col items-center">
                            {storeSlug && (
                                <div className="mb-8 w-full bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-2 block text-center">Seu Link de Vendas</label>
                                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-xl border border-gray-200 dark:border-gray-600">
                                        <Globe size={16} className="text-gray-400" />
                                        <input
                                            readOnly
                                            value={`${window.location.origin}/s/${storeSlug}`}
                                            className="flex-1 bg-transparent text-xs font-mono text-gray-600 dark:text-gray-300 outline-none truncate"
                                            onClick={(e) => e.currentTarget.select()}
                                        />
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`${window.location.origin}/s/${storeSlug}`);
                                                    setMessage({ type: 'success', text: 'Link copiado!' });
                                                }}
                                                className="p-2 hover:bg-white dark:hover:bg-gray-600 rounded-lg text-gray-500 transition"
                                                title="Copiar Link"
                                            >
                                                <Copy size={14} />
                                            </button>
                                            <a
                                                href={`/s/${storeSlug}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="p-2 bg-brand-green text-white rounded-lg hover:bg-green-600 transition"
                                                title="Abrir Loja"
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <h3 className="font-bold text-gray-400 text-sm uppercase mb-4 tracking-wider">Preview ao Vivo</h3>
                            <StorePreview config={config} />
                            <p className="text-xs text-gray-400 mt-4 text-center max-w-xs">
                                Esta é uma simulação aproximada de como sua loja aparecerá para os clientes.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </PageContainer>
    );
}