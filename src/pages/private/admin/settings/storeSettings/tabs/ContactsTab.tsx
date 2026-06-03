import { Mail } from 'lucide-react';
import type { StoreData } from '../storeSettings.types';

type Props = {
    store: StoreData;
    setStore: (value: StoreData) => void;
    disabled?: boolean;
};

export default function ContactsTab({ store, setStore, disabled = false }: Props) {
    return (
        <div className="block grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">E-mail Principal</label>
                                    <div className="relative">
                                        <input
                                            type="email"
                                            className="w-full p-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-500 disabled:opacity-60"
                                            value={store.contacts.main_email}
                                            readOnly
                                            disabled={disabled}
                                        />
                                        {store.contacts.main_email && (
                                            <a
                                                href={`mailto:${store.contacts.main_email}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="absolute right-3 top-3 text-brand-green hover:text-brand-green/80"
                                                title="Enviar E-mail"
                                            >
                                                <Mail size={20} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">E-mails Secundários</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                        value={store.contacts.secondary_emails}
                                        onChange={e => setStore({ ...store, contacts: { ...store.contacts, secondary_emails: e.target.value } })}
                                        placeholder="Separe por vírgula"
                                        disabled={disabled}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nome do Responsável</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                        value={store.contacts.name_responsible}
                                        onChange={e => setStore({ ...store, contacts: { ...store.contacts, name_responsible: e.target.value } })}
                                        disabled={disabled}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Celular do Responsável</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                        value={store.contacts.phone_responsible}
                                        onChange={e => setStore({ ...store, contacts: { ...store.contacts, phone_responsible: e.target.value } })}
                                        disabled={disabled}
                                    />
                                </div>
                                <div className="md:col-span-2 border-t border-gray-100 dark:border-gray-700 mt-2 pt-4">
                                    {/* SMS Gateway Integration moved to MessageSettings */}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">WhatsApp Adicional (Atendimento)</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                        value={store.contacts.whatsapp_contact}
                                        onChange={e => setStore({ ...store, contacts: { ...store.contacts, whatsapp_contact: e.target.value } })}
                                        disabled={disabled}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Site / Rede Social</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                        value={store.contacts.social_media}
                                        onChange={e => setStore({ ...store, contacts: { ...store.contacts, social_media: e.target.value } })}
                                        disabled={disabled}
                                    />
                                </div>
                            </div>
    );
}
