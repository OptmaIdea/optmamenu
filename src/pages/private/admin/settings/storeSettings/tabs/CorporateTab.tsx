import { ExternalLink } from 'lucide-react';
import type { StoreData } from '../storeSettings.types';

type Props = {
    store: StoreData;
    setStore: (value: StoreData) => void;
};

export default function CorporateTab({ store, setStore }: Props) {
    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex gap-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="radio"
                        name="doc_type"
                        checked={store.doc_type === 'PF'}
                        onChange={() => setStore({ ...store, doc_type: 'PF' })}
                        className="accent-brand-green w-5 h-5"
                    />
                    <span className="font-bold text-gray-700 dark:text-gray-200">Pessoa Física</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="radio"
                        name="doc_type"
                        checked={store.doc_type === 'PJ'}
                        onChange={() => setStore({ ...store, doc_type: 'PJ' })}
                        className="accent-brand-green w-5 h-5"
                    />
                    <span className="font-bold text-gray-700 dark:text-gray-200">Pessoa Jurídica</span>
                </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                        {store.doc_type === 'PF' ? 'Nome Completo' : 'Razão Social'} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                        value={store.legal_name || ''}
                        onChange={e => setStore({ ...store, legal_name: e.target.value })}
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                        {store.doc_type === 'PF' ? 'CPF' : 'CNPJ'} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                        value={store.document || ''}
                        placeholder={store.doc_type === 'PF' ? '000.000.000-00' : '00.000.000/0001-00'}
                        onChange={e => setStore({ ...store, document: e.target.value })}
                        required
                    />
                </div>

                {store.doc_type === 'PJ' && (
                    <>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nome Fantasia</label>
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={store.fantasy_name || ''}
                                onChange={e => setStore({ ...store, fantasy_name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Tipo de Estabelecimento</label>
                            <select
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                                value={store.establishment_type || ''}
                                onChange={e => setStore({ ...store, establishment_type: e.target.value })}
                            >
                                <option value="Matriz">Matriz</option>
                                <option value="Filial">Filial</option>
                                <option value="Depósito">Depósito</option>
                                <option value="Outros">Outros</option>
                            </select>
                        </div>
                    </>
                )}
            </div>

            <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Como sua loja aparece para o cliente</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Nome da Loja (Marca Visual) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                            value={store.name || ''}
                            onChange={e => setStore({ ...store, name: e.target.value })}
                            placeholder="Ex: Gelinhares"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Link da Loja (Slug) <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-2">
                            <div className="flex flex-1">
                                <span className="bg-gray-100 dark:bg-gray-800 border border-r-0 border-gray-300 dark:border-gray-600 p-3 rounded-l-lg text-gray-500 dark:text-gray-400 text-sm flex items-center select-none font-mono tracking-tighter">
                                    {typeof window !== 'undefined' ? window.location.host : ''}/s/
                                </span>
                                <input
                                    type="text"
                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-r-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition lowercase font-bold"
                                    value={store.slug || ''}
                                    onChange={e =>
                                        setStore({
                                            ...store,
                                            slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                                        })
                                    }
                                    placeholder="sua-loja"
                                    required
                                />
                            </div>
                            {store.slug && (
                                <a
                                    href={typeof window !== 'undefined' ? `${window.location.origin}/s/${store.slug}` : '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-brand-green/10 text-brand-green border border-brand-green/20 hover:bg-brand-green hover:text-white p-3 rounded-lg transition-colors flex items-center justify-center min-w-[3rem]"
                                    title="Acessar Cardápio"
                                >
                                    <ExternalLink size={20} />
                                </a>
                            )}
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Descrição Curta
                        </label>
                        <textarea
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none h-24 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                            value={store.description || ''}
                            onChange={e => setStore({ ...store, description: e.target.value })}
                            placeholder="Ex: O melhor açaí da região, entregue rapidinho!"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
