import React from 'react';
import { Info, Plus, Save } from 'lucide-react';
import { InfoCard } from '@/components/common/InfoCard';

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

interface MyProfileAdditionalInfoTabProps {
    profile: ProfileData;
    handleAddAdditionalInfo: () => void;
    handleUpdateAdditionalInfo: (index: number, field: keyof AdditionalInfo, value: string | boolean) => void;
    handleRemoveAdditionalInfo: (index: number) => void;
    canRequestProfileChanges: boolean;
    handleRequestRemoveAdditionalInfo: (index: number) => void;
    handleSave: (e?: React.SyntheticEvent) => Promise<void>;
    saving: boolean;
}

export default function MyProfileAdditionalInfoTab({
    profile,
    handleAddAdditionalInfo,
    handleUpdateAdditionalInfo,
    handleRemoveAdditionalInfo,
    canRequestProfileChanges,
    handleRequestRemoveAdditionalInfo,
    handleSave,
    saving,
}: MyProfileAdditionalInfoTabProps) {
    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                void handleSave(e);
            }}
            className="space-y-8"
        >
            {/* Additional Info Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <Info className="text-[#19A999]" size={20} /> Informações Adicionais
                </h3>

                <div className="space-y-4">
                    {profile.additionalInfo.map((item, index) => (
                        <InfoCard
                            key={item.id || index}
                            item={item}
                            index={index}
                            onUpdate={handleUpdateAdditionalInfo}
                            onRemove={handleRemoveAdditionalInfo}
                            onRemoveRequest={canRequestProfileChanges ? handleRequestRemoveAdditionalInfo : undefined}
                        />
                    ))}

                    <button
                        type="button"
                        onClick={handleAddAdditionalInfo}
                        className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-[#19A999] hover:text-[#19A999] transition-colors w-full justify-center"
                    >
                        <Plus size={18} />
                        Adicionar Informação
                    </button>
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
