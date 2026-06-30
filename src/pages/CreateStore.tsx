import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Building, Loader, User, Briefcase, Phone } from 'lucide-react';

export default function CreateStore() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [docType, setDocType] = useState<'PF' | 'PJ'>('PF');

    // Campos comuns
    const [storeName, setStoreName] = useState('');
    const [slug, setSlug] = useState('');
    const [phone, setPhone] = useState('');

    // PF
    const [fullName, setFullName] = useState('');
    const [cpf, setCpf] = useState('');

    // PJ
    const [legalName, setLegalName] = useState('');
    const [fantasyName, setFantasyName] = useState('');
    const [cnpj, setCnpj] = useState('');

    // Consentimentos
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [acceptCommunications, setAcceptCommunications] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');

            // Validações básicas
            if (!storeName) throw new Error('Nome da loja é obrigatório');
            if (!slug) throw new Error('Link da loja é obrigatório');
            if (docType === 'PF' && !fullName) throw new Error('Nome completo é obrigatório');
            if (docType === 'PJ' && !legalName) throw new Error('Razão social é obrigatória');

            // Montar objeto de consents
            const consents = {
                terms_accepted: acceptTerms,
                communications_accepted: acceptCommunications,
                accepted_at: new Date().toISOString(),
            };

            // Chamar RPC para criar loja
            const { data, error } = await supabase.rpc('create_store', {
                p_user_id: user.id,
                p_name: storeName,
                p_slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                p_phone_number: phone || null,
                p_doc_type: docType,
                p_legal_name: docType === 'PF' ? fullName : legalName,
                p_document: docType === 'PF' ? cpf || null : cnpj || null,
                p_fantasy_name: docType === 'PJ' ? fantasyName || null : null,
                p_consents: consents
            });

            if (error) throw error;
            if (!data || data.length === 0) throw new Error('Erro ao criar loja');

            toast.success('Loja criada com sucesso!');
            navigate('/admin');
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <img src="/assets/OptmaMenuLogo.webp" alt="OptmaMenu" className="h-12 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Bem-vindo!</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">Antes de começar, configure sua loja.</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700">
                    <div className="space-y-4">
                        {/* Tipo de pessoa */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                Você é:
                            </label>
                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setDocType('PF')}
                                    className={`flex-1 py-3 px-4 rounded-lg border-2 font-bold flex items-center justify-center gap-2 transition ${docType === 'PF'
                                        ? 'border-[#19A999] bg-[#19A999]/10 text-[#19A999]'
                                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                                        }`}
                                >
                                    <User size={18} />
                                    Pessoa Física
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDocType('PJ')}
                                    className={`flex-1 py-3 px-4 rounded-lg border-2 font-bold flex items-center justify-center gap-2 transition ${docType === 'PJ'
                                        ? 'border-[#19A999] bg-[#19A999]/10 text-[#19A999]'
                                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                                        }`}
                                >
                                    <Briefcase size={18} />
                                    Pessoa Jurídica
                                </button>
                            </div>
                        </div>

                        {/* Campos PF */}
                        {docType === 'PF' && (
                            <>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        Nome Completo <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#19A999] outline-none"
                                        placeholder="Ex: João da Silva"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        CPF (opcional)
                                    </label>
                                    <input
                                        type="text"
                                        value={cpf}
                                        onChange={(e) => setCpf(e.target.value)}
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#19A999] outline-none"
                                        placeholder="000.000.000-00"
                                    />
                                </div>
                            </>
                        )}

                        {/* Campos PJ */}
                        {docType === 'PJ' && (
                            <>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        Razão Social <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={legalName}
                                        onChange={(e) => setLegalName(e.target.value)}
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#19A999] outline-none"
                                        placeholder="Ex: Empresa Ltda"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        Nome Fantasia (opcional)
                                    </label>
                                    <input
                                        type="text"
                                        value={fantasyName}
                                        onChange={(e) => setFantasyName(e.target.value)}
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#19A999] outline-none"
                                        placeholder="Ex: Nome Fantasia"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        CNPJ (opcional)
                                    </label>
                                    <input
                                        type="text"
                                        value={cnpj}
                                        onChange={(e) => setCnpj(e.target.value)}
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#19A999] outline-none"
                                        placeholder="00.000.000/0001-00"
                                    />
                                </div>
                            </>
                        )}

                        {/* Telefone/WhatsApp (comum) */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                <Phone size={16} /> Telefone / WhatsApp (opcional)
                            </label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#19A999] outline-none"
                                placeholder="(11) 99999-9999"
                            />
                        </div>

                        {/* Nome da Loja (Marca) */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                Nome da sua loja <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={storeName}
                                onChange={(e) => setStoreName(e.target.value)}
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#19A999] outline-none"
                                placeholder="Ex: Gelinhares"
                                required
                            />
                        </div>

                        {/* Slug */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                Link da sua loja <span className="text-red-500">*</span>
                            </label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 bg-gray-100 dark:bg-gray-600 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-xl text-gray-500 dark:text-gray-400 text-sm">
                                    /s/
                                </span>
                                <input
                                    type="text"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                                    className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-r-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#19A999] outline-none lowercase"
                                    placeholder="sua-loja"
                                    required
                                />
                            </div>
                        </div>

                        {/* Consentimentos */}
                        <div className="space-y-2 pt-2">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={acceptTerms}
                                    onChange={(e) => setAcceptTerms(e.target.checked)}
                                    className="mt-1 w-4 h-4 text-[#19A999] rounded border-gray-300 focus:ring-[#19A999]"
                                />
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                    Li e aceito os <Link to="/terms" target="_blank" className="text-[#19A999] hover:underline font-bold">Termos de Uso</Link> e a <Link to="/politica-privacidade" target="_blank" className="text-[#19A999] hover:underline font-bold">Política de Privacidade</Link>.
                                </span>
                            </label>
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={acceptCommunications}
                                    onChange={(e) => setAcceptCommunications(e.target.checked)}
                                    className="mt-1 w-4 h-4 text-[#19A999] rounded border-gray-300 focus:ring-[#19A999]"
                                />
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                    Aceito receber comunicações sobre pedidos e novidades via WhatsApp e e-mail.
                                </span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 bg-[#19A999] hover:bg-[#14887B] text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader className="animate-spin" size={18} /> : <Building size={18} />}
                            {loading ? 'Criando...' : 'Criar Loja'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}