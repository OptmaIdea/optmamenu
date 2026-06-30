import React from 'react';
import { Loader, Search, MapPin, Globe, Instagram, Facebook, Save } from 'lucide-react';

export interface AdditionalInfo {
    id: string;
    title: string;
    text: string;
    sensitive: boolean;
    created_at?: string;
    isNew?: boolean;
}

export interface ProfileData {
    name: string;
    internal_alias: string;
    phone: string;
    mobile_phone: string;
    whatsapp_phone: string;
    whatsapp_same_as_mobile: boolean;
    birthdate: string;
    zip_code: string;
    address: string;
    address_number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
    instagram_url: string;
    facebook_url: string;
    website_url: string;
    avatar_url: string;
    cpf: string;
    member_email: string;
    additionalInfo: AdditionalInfo[];
}

export interface IBGEState {
    id: number;
    sigla: string;
    nome: string;
}

export interface IBGECity {
    id: number;
    nome: string;
}

interface MyProfileAddressTabProps {
    profile: ProfileData;
    setProfile: React.Dispatch<React.SetStateAction<ProfileData>>;
    saving: boolean;
    states: IBGEState[];
    cities: IBGECity[];
    loadingCities: boolean;
    searchingCep: boolean;
    handleZipLookup: () => Promise<void>;
    canEditGlobalProfile: boolean;
    handleSave: (e?: React.SyntheticEvent) => Promise<void>;
}

function onlyDigits(value: string): string {
    return value.replace(/\D/g, '');
}

function formatCep(value: string): string {
    const digits = onlyDigits(value).slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export default function MyProfileAddressTab({
    profile,
    setProfile,
    saving,
    states,
    cities,
    loadingCities,
    searchingCep,
    handleZipLookup,
    canEditGlobalProfile,
    handleSave,
}: MyProfileAddressTabProps) {
    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                void handleSave(e);
            }}
            className="space-y-8"
        >
            {/* Address Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <MapPin className="text-[#19A999]" size={20} /> Endereço Residencial
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="md:col-span-1">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">CEP</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#19A999] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={profile.zip_code}
                                placeholder="00000-000"
                                onChange={(e) =>
                                    setProfile((current) => ({
                                        ...current,
                                        zip_code: formatCep(e.target.value),
                                    }))
                                }
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        void handleZipLookup();
                                    }
                                }}
                                onBlur={() => {
                                    void handleZipLookup();
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    void handleZipLookup();
                                }}
                                disabled={searchingCep}
                                className="p-3 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition text-gray-600 dark:text-white disabled:opacity-50"
                            >
                                {searchingCep ? <Loader size={18} className="animate-spin" /> : <Search size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="md:col-span-3">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Endereço (Rua/Avenida)</label>
                        <input
                            type="text"
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#19A999] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                            value={profile.address}
                            onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                        />
                    </div>

                    <div className="md:col-span-1">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Número</label>
                        <input
                            type="text"
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#19A999] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                            value={profile.address_number}
                            onChange={(e) => setProfile({ ...profile, address_number: e.target.value })}
                        />
                    </div>

                    <div className="md:col-span-1">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Complemento</label>
                        <input
                            type="text"
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#19A999] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                            value={profile.complement}
                            onChange={(e) => setProfile({ ...profile, complement: e.target.value })}
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Bairro</label>
                        <input
                            type="text"
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#19A999] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                            value={profile.district}
                            onChange={(e) => setProfile({ ...profile, district: e.target.value })}
                        />
                    </div>

                    <div className="md:col-span-1">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Estado (UF)</label>
                        <select
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#19A999] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                            value={profile.state}
                            onChange={(e) => setProfile({ ...profile, state: e.target.value, city: '' })}
                        >
                            <option value="">Selecione...</option>
                            {states.map((uf) => (
                                <option key={uf.id} value={uf.sigla}>
                                    {uf.sigla}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="md:col-span-3">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex justify-between">
                            Cidade
                            {loadingCities && (
                                <span className="text-xs text-[#19A999] flex items-center gap-1">
                                    <Loader size={12} className="animate-spin" /> Carregando...
                                </span>
                            )}
                        </label>
                        {profile.state ? (
                            <select
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#19A999] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={profile.city}
                                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                                disabled={loadingCities}
                            >
                                <option value="">Selecione a cidade...</option>
                                {cities.map((city) => (
                                    <option key={city.id} value={city.nome}>
                                        {city.nome}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500"
                                value={profile.city}
                                placeholder="Selecione o UF primeiro"
                                readOnly
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Social Media Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <Globe className="text-[#19A999]" size={20} /> Redes Sociais e Canais
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Instagram</label>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full p-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#19A999] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                value={profile.instagram_url}
                                onChange={(e) => setProfile({ ...profile, instagram_url: e.target.value })}
                                placeholder="Ex: @seuusername"
                                disabled={!canEditGlobalProfile}
                            />
                            <Instagram size={18} className="absolute right-3 top-3.5 text-gray-400" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Facebook</label>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full p-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#19A999] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                value={profile.facebook_url}
                                onChange={(e) => setProfile({ ...profile, facebook_url: e.target.value })}
                                placeholder="Ex: facebook.com/perfil"
                                disabled={!canEditGlobalProfile}
                            />
                            <Facebook size={18} className="absolute right-3 top-3.5 text-gray-400" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Site Pessoal</label>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full p-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#19A999] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                value={profile.website_url}
                                onChange={(e) => setProfile({ ...profile, website_url: e.target.value })}
                                placeholder="Ex: www.seusite.com"
                                disabled={!canEditGlobalProfile}
                            />
                            <Globe size={18} className="absolute right-3 top-3.5 text-gray-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
                <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-3 bg-[#19A999] text-white px-8 py-3 rounded-xl font-bold text-lg hover:brightness-95 shadow-md hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save size={24} />
                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
            </div>
        </form>
    );
}
