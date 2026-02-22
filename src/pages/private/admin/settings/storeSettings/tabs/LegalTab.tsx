import { User } from 'lucide-react';
import type { StoreData } from '../storeSettings.types';

type Props = {
    store: StoreData;
    setStore: (value: StoreData) => void;
    templatePrivacyPolicy: string;
    templateTermsOfUse: string;
    templateCookiePolicy: string;
};

export default function LegalTab({
    store,
    setStore,
    templatePrivacyPolicy,
    templateTermsOfUse,
    templateCookiePolicy,
}: Props) {
    return (
        <div className="block animate-fadeIn">
                                {/* DPO Section */}
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-100 dark:border-blue-800 mb-8">
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                        <User size={20} className="text-blue-600 dark:text-blue-400" />
                                        Encarregado de Dados (DPO)
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                        Informações de contato do responsável pela proteção de dados, exigido pela LGPD.
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">E-mail do DPO</label>
                                            <input
                                                type="email"
                                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                value={store.dpo_email || ''}
                                                onChange={e => setStore({ ...store, dpo_email: e.target.value })}
                                                placeholder="dpo@suaempresa.com"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Outro Contato (Telefone/Endereço)</label>
                                            <input
                                                type="text"
                                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                value={store.dpo_contact || ''}
                                                onChange={e => setStore({ ...store, dpo_contact: e.target.value })}
                                                placeholder="Ex: (11) 99999-9999"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Legal Documents */}
                                <div className="space-y-8">
                                    {/* Privacy Policy */}
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                                Política de Privacidade
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setStore({ ...store, privacy_policy_text: templatePrivacyPolicy.replace('[Nome da Loja]', store.name).replace('[Data atual]', new Date().toLocaleDateString()) })}
                                                className="text-xs text-brand-green hover:underline font-bold"
                                            >
                                                Preencher com Modelo Padrão
                                            </button>
                                        </div>
                                        <textarea
                                            className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none h-64 font-mono text-sm bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                                            value={store.privacy_policy_text || ''}
                                            onChange={e => setStore({ ...store, privacy_policy_text: e.target.value })}
                                            placeholder="# Política de Privacidade..."
                                        />
                                    </div>

                                    {/* Terms of Use */}
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                                Termos de Uso
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setStore({ ...store, terms_of_use_text: templateTermsOfUse.replace('[Nome da Loja]', store.name) })}
                                                className="text-xs text-brand-green hover:underline font-bold"
                                            >
                                                Preencher com Modelo Padrão
                                            </button>
                                        </div>
                                        <textarea
                                            className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none h-64 font-mono text-sm bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                                            value={store.terms_of_use_text || ''}
                                            onChange={e => setStore({ ...store, terms_of_use_text: e.target.value })}
                                            placeholder="# Termos de Uso..."
                                        />
                                    </div>

                                    {/* Cookie Policy */}
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                                Política de Cookies
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setStore({ ...store, cookie_policy_text: templateCookiePolicy })}
                                                className="text-xs text-brand-green hover:underline font-bold"
                                            >
                                                Preencher com Modelo Padrão
                                            </button>
                                        </div>
                                        <textarea
                                            className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none h-48 font-mono text-sm bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                                            value={store.cookie_policy_text || ''}
                                            onChange={e => setStore({ ...store, cookie_policy_text: e.target.value })}
                                            placeholder="# Política de Cookies..."
                                        />
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Consents e Declarações</h3>
                                    <div className="space-y-4">
                                        <label className="flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                            <input
                                                type="checkbox"
                                                className="mt-1 accent-brand-green w-5 h-5"
                                                checked={store.consents.terms_accepted}
                                                onChange={e => setStore({ ...store, consents: { ...store.consents, terms_accepted: e.target.checked } })}
                                            />
                                            <span className="text-sm text-gray-600 dark:text-gray-300">
                                                Declaro que li e aceito os Termos de Uso e a Política de Privacidade da plataforma.
                                            </span>
                                        </label>

                                        <label className="flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                            <input
                                                type="checkbox"
                                                className="mt-1 accent-brand-green w-5 h-5"
                                                checked={store.consents.responsibility_accepted}
                                                onChange={e => setStore({ ...store, consents: { ...store.consents, responsibility_accepted: e.target.checked } })}
                                            />
                                            <span className="text-sm text-gray-600 dark:text-gray-300">
                                                Reconheço que sou inteiramente responsável pelas informações cadastradas e pelos produtos vendidos.
                                            </span>
                                        </label>

                                        <label className="flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                            <input
                                                type="checkbox"
                                                className="mt-1 accent-brand-green w-5 h-5"
                                                checked={store.consents.no_illicit_accepted}
                                                onChange={e => setStore({ ...store, consents: { ...store.consents, no_illicit_accepted: e.target.checked } })}
                                            />
                                            <span className="text-sm text-gray-600 dark:text-gray-300">
                                                Declaro que não utilizarei a plataforma para fins ilícitos e que sou o único responsável pelo conteúdo inserido.
                                            </span>
                                        </label>
                                    </div>

                                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700 mt-4">
                                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Canais de Comunicação Autorizados:</p>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                                <input
                                                    type="checkbox"
                                                    checked={store.consents.channels.whatsapp}
                                                    onChange={e => setStore({ ...store, consents: { ...store.consents, channels: { ...store.consents.channels, whatsapp: e.target.checked } } })}
                                                    className="accent-brand-green"
                                                /> WhatsApp
                                            </label>
                                            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                                <input
                                                    type="checkbox"
                                                    checked={store.consents.channels.sms}
                                                    onChange={e => setStore({ ...store, consents: { ...store.consents, channels: { ...store.consents.channels, sms: e.target.checked } } })}
                                                    className="accent-brand-green"
                                                /> SMS
                                            </label>
                                            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                                <input
                                                    type="checkbox"
                                                    checked={store.consents.channels.email}
                                                    onChange={e => setStore({ ...store, consents: { ...store.consents, channels: { ...store.consents.channels, email: e.target.checked } } })}
                                                    className="accent-brand-green"
                                                /> E-mail
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
    );
}
