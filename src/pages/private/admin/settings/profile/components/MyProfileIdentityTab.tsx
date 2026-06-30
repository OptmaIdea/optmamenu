import React from 'react';
import { Camera, Loader, Mail, Phone, User, Plus, Save } from 'lucide-react';
import type { ProfileChangeRequestType } from '@/services/securityService';

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

interface MyProfileIdentityTabProps {
    profile: ProfileData;
    setProfile: React.Dispatch<React.SetStateAction<ProfileData>>;
    saving: boolean;
    savingAvatar: boolean;
    handleAvatarChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    canRequestProfileChanges: boolean;
    canEditGlobalProfile: boolean;
    openProfileRequestModal: (requestType: ProfileChangeRequestType) => void;
    handleSave: (e?: React.SyntheticEvent) => Promise<void>;
}

const getInitials = (name: string) => {
    return name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'U';
};

function onlyDigits(value: string): string {
    return value.replace(/\D/g, '');
}

function formatMobile(value: string): string {
    const digits = onlyDigits(value).slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatLandline(value: string): string {
    const digits = onlyDigits(value).slice(0, 10);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
}

export default function MyProfileIdentityTab({
    profile,
    setProfile,
    saving,
    savingAvatar,
    handleAvatarChange,
    canRequestProfileChanges,
    canEditGlobalProfile,
    openProfileRequestModal,
    handleSave,
}: MyProfileIdentityTabProps) {
    const handleMobileChange = (value: string) => {
        const formatted = formatMobile(value);
        setProfile((current) => ({
            ...current,
            mobile_phone: formatted,
            whatsapp_phone: current.whatsapp_same_as_mobile
                ? formatted
                : current.whatsapp_phone,
        }));
    };

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                void handleSave(e);
            }}
            className="space-y-8"
        >
            {/* Visual Avatar Block */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center gap-6">
                <div className="relative group">
                    <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-white dark:border-gray-700 shadow-md bg-[#19A999]/10 flex items-center justify-center">
                        {profile.avatar_url ? (
                            <img
                                src={profile.avatar_url}
                                alt="Avatar"
                                className="absolute inset-0 h-full w-full object-cover"
                            />
                        ) : (
                            <span className="text-3xl font-black text-[#19A999]">
                                {getInitials(profile.name)}
                            </span>
                        )}

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-full transition cursor-pointer">
                            <label htmlFor="avatar-upload" className="cursor-pointer text-white flex flex-col items-center">
                                <Camera size={18} />
                                <span className="text-[10px] font-bold mt-1">Alterar</span>
                            </label>
                        </div>
                    </div>

                    {savingAvatar && (
                        <div className="absolute inset-0 bg-white/70 dark:bg-gray-800/70 rounded-full flex items-center justify-center">
                            <Loader size={20} className="animate-spin text-[#19A999]" />
                        </div>
                    )}

                    <label
                        htmlFor="avatar-upload"
                        className="absolute bottom-0 right-0 bg-[#19A999] text-white p-1.5 rounded-full shadow-md cursor-pointer hover:brightness-110 transition"
                    >
                        <Camera size={14} />
                    </label>
                    <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                        disabled={savingAvatar}
                    />
                </div>

                <div className="flex-1 text-center sm:text-left">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">Foto de Perfil</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                        Carregue uma imagem quadrada para seu avatar.
                        <br />Formatos aceitos: JPG, PNG ou WEBP, máx. 2MB.
                    </p>
                </div>
            </div>

            {/* Identification Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                    <span className="flex items-center gap-2">
                        <User className="text-[#19A999]" size={20} /> Identificação e acesso
                    </span>
                    {canRequestProfileChanges && !canEditGlobalProfile && (
                        <button
                            type="button"
                            onClick={() => openProfileRequestModal('name_change')}
                            className="text-xs bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-950/50 cursor-pointer"
                        >
                            <Plus size={14} />
                            Solicitar Alteração de Dados
                        </button>
                    )}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Nome Completo <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#19A999] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                            value={profile.name}
                            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                            required
                            disabled={!canEditGlobalProfile}
                        />
                        {!canEditGlobalProfile && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 block">
                                O nome não pode ser alterado diretamente.{' '}
                                <button
                                    type="button"
                                    onClick={() => openProfileRequestModal('name_change')}
                                    className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-bold underline transition cursor-pointer"
                                >
                                    Solicitar alteração de nome.
                                </button>
                            </span>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Apelido <span className="text-xs text-gray-400 font-normal">(como prefere ser chamado)</span>
                        </label>
                        <input
                            type="text"
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#19A999] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                            value={profile.internal_alias}
                            onChange={(e) => setProfile({ ...profile, internal_alias: e.target.value })}
                            placeholder="Ex: Lucas"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">CPF</label>
                        <input
                            type="text"
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#19A999] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                            value={profile.cpf}
                            onChange={(e) => setProfile({ ...profile, cpf: e.target.value })}
                            disabled={!canEditGlobalProfile}
                            placeholder="000.000.000-00"
                        />
                        {!canEditGlobalProfile && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 block">
                                O CPF não pode ser alterado diretamente.{' '}
                                {canRequestProfileChanges && (
                                    <button
                                        type="button"
                                        onClick={() => openProfileRequestModal('cpf_change')}
                                        className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-bold underline transition cursor-pointer"
                                    >
                                        Solicitar alteração de CPF.
                                    </button>
                                )}
                            </span>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Data de Nascimento</label>
                        <input
                            type="date"
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#19A999] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                            value={profile.birthdate}
                            onChange={(e) => setProfile({ ...profile, birthdate: e.target.value })}
                            disabled={!canEditGlobalProfile}
                        />
                        {!canEditGlobalProfile && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 block">
                                A data de nascimento não pode ser alterada diretamente.{' '}
                                <button
                                    type="button"
                                    onClick={() => openProfileRequestModal('birthdate_change')}
                                    className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-bold underline transition cursor-pointer"
                                >
                                    Solicitar alteração.
                                </button>
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Contacts Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <User className="text-[#19A999]" size={20} /> Contatos e Acesso
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">E-mail de Contato</label>
                        <div className="relative">
                            <input
                                type="email"
                                className="w-full p-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#19A999] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={profile.member_email}
                                onChange={(e) => setProfile({ ...profile, member_email: e.target.value })}
                                placeholder="Ex: contato@empresa.com"
                            />
                            <Mail size={18} className="absolute right-3 top-3.5 text-gray-400" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Celular <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full p-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#19A999] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={profile.mobile_phone}
                                onChange={(e) => handleMobileChange(e.target.value)}
                                placeholder="Ex: (22) 99999-9999"
                            />
                            <Phone size={18} className="absolute right-3 top-3.5 text-gray-400" />
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                WhatsApp <span className="text-red-500">*</span>
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300 text-[#19A999] focus:ring-[#19A999]"
                                    checked={!!profile.whatsapp_same_as_mobile}
                                    onChange={(event) => {
                                        const checked = event.target.checked;
                                        setProfile((current) => ({
                                            ...current,
                                            whatsapp_same_as_mobile: checked,
                                            whatsapp_phone: checked ? current.mobile_phone : current.whatsapp_phone,
                                        }));
                                    }}
                                />
                                WhatsApp é o mesmo número do celular
                            </label>
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full p-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#19A999] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                value={profile.whatsapp_phone}
                                onChange={(event) =>
                                    setProfile((current) => ({
                                        ...current,
                                        whatsapp_phone: formatMobile(event.target.value),
                                    }))
                                }
                                disabled={profile.whatsapp_same_as_mobile}
                                placeholder="Ex: (22) 99999-9999"
                            />
                            <Phone size={18} className="absolute right-3 top-3.5 text-gray-400" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Telefone Fixo</label>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full p-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#19A999] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={profile.phone}
                                onChange={(e) => setProfile((current) => ({ ...current, phone: formatLandline(e.target.value) }))}
                                placeholder="Ex: (22) 3333-3333"
                            />
                            <Phone size={18} className="absolute right-3 top-3.5 text-gray-400" />
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
