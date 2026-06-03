import { Loader, Search } from 'lucide-react';
import type { IBGECity, IBGEState, StoreData } from '../storeSettings.types';

type Props = {
    store: StoreData;
    setStore: (value: StoreData) => void;
    states: IBGEState[];
    cities: IBGECity[];
    loadingCities: boolean;
    searchingCep: boolean;
    handleZipLookup: () => Promise<void>;
    disabled?: boolean;
};

export default function AddressTab({
    store,
    setStore,
    states,
    cities,
    loadingCities,
    searchingCep,
    handleZipLookup,
    disabled = false,
}: Props) {
    return (
        <div className="block grid grid-cols-1 md:grid-cols-4 gap-6 animate-fadeIn">
                        
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">CEP</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                            value={store.address.zip_code || ''}
                                            placeholder="00000-000"
                                            onChange={e => setStore({ ...store, address: { ...store.address, zip_code: e.target.value } })}
                                            onBlur={handleZipLookup}
                                            disabled={disabled}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleZipLookup}
                                            disabled={searchingCep || disabled}
                                            className="p-3 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition text-gray-600 dark:text-white disabled:opacity-50"
                                        >
                                            {searchingCep ? <Loader size={20} className="animate-spin" /> : <Search size={20} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Logradouro</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                        value={store.address.street || ''}
                                        onChange={e => setStore({ ...store, address: { ...store.address, street: e.target.value } })}
                                        disabled={disabled}
                                    />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Número</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                        value={store.address.number || ''}
                                        onChange={e => setStore({ ...store, address: { ...store.address, number: e.target.value } })}
                                        disabled={disabled}
                                    />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Complemento</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                        value={store.address.complement || ''}
                                        onChange={e => setStore({ ...store, address: { ...store.address, complement: e.target.value } })}
                                        disabled={disabled}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Bairro</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                        value={store.address.neighborhood || ''}
                                        onChange={e => setStore({ ...store, address: { ...store.address, neighborhood: e.target.value } })}
                                        disabled={disabled}
                                    />
                                </div>

                                <div className="md:col-span-1">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Estado (UF)</label>
                                    <select
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                        value={store.address.state || ''}
                                        onChange={e => setStore({ ...store, address: { ...store.address, state: e.target.value, city: '' } })}
                                        disabled={disabled}
                                    >
                                        <option value="">Selecione...</option>
                                        {states.map(uf => (
                                            <option key={uf.id} value={uf.sigla}>{uf.sigla}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex justify-between">
                                        Cidade
                                        {loadingCities && <span className="text-xs text-brand-green flex items-center gap-1"><Loader size={12} className="animate-spin" /> Carregando...</span>}
                                    </label>
                                    {store.address.state ? (
                                        <select
                                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-green outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                            value={store.address.city || ''}
                                            onChange={e => setStore({ ...store, address: { ...store.address, city: e.target.value } })}
                                            disabled={loadingCities || disabled}
                                        >
                                            <option value="">Selecione a cidade...</option>
                                            {cities.map(city => (
                                                <option key={city.id} value={city.nome}>{city.nome}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 disabled:opacity-60"
                                            value={store.address.city}
                                            placeholder="Selecione o estado primeiro"
                                            readOnly
                                            disabled={disabled}
                                        />
                                    )}
                                </div>
                            </div>
    );
}
