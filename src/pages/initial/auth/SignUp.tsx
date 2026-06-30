import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, User, Phone, Store, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';

export default function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    storeName: '',
    storeSlug: '',
    acceptTerms: false
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'storeName' && {
        storeSlug: value.toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
      })
    }));
  };

  const validateStep1 = () => {
    if (!formData.name) return 'Nome é obrigatório';
    if (!formData.email) return 'E-mail é obrigatório';
    if (!formData.phone) return 'Telefone é obrigatório';
    if (!formData.password) return 'Senha é obrigatória';
    if (formData.password.length < 6) return 'Senha deve ter no mínimo 6 caracteres';
    if (formData.password !== formData.confirmPassword) return 'Senhas não conferem';
    return '';
  };

  /*   const validateStep2 = () => {
      if (!formData.storeName) return 'Nome da loja é obrigatório';
      if (!formData.storeSlug) return 'URL da loja é obrigatória';
      if (!formData.acceptTerms) return 'Você precisa aceitar os termos de uso';
      return '';
    }; */

  const handleNextStep = () => {
    const error = validateStep1();
    if (error) {
      setError(error);
      return;
    }
    setError('');
    setStep(2);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { /* data: authData,  */error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name,
            phone_number: formData.phone,
          },
          // Redireciona para o onboarding após confirmação
          emailRedirectTo: `${window.location.origin}/onboarding/create-store`,
        },
      });

      if (authError) throw authError;

      setSuccess('Cadastro realizado! Verifique seu e-mail para confirmar sua conta.');
      setTimeout(() => {
        navigate('/'); // ou para uma página de "verifique seu e-mail"
      }, 3000);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F6F2] dark:bg-gray-950 flex items-center justify-center p-4 py-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h2 className="mt-6 text-3xl font-black text-[#2D2A26] dark:text-white font-candara-bold">
            Criar sua conta
          </h2>
          <p className="mt-2 text-sm text-[#6B6375] dark:text-gray-400 font-candara">
            Comece a gerenciar seu delivery em minutos
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 flex items-center justify-center">
          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step >= 1
              ? 'bg-brand-green text-white'
              : 'bg-[#6B6375]/10 dark:bg-gray-800 text-[#6B6375] dark:text-gray-400'
              }`}>
              1
            </div>
            <div className={`w-16 h-1 mx-2 ${step >= 2
              ? 'bg-brand-green'
              : 'bg-[#6B6375]/10 dark:bg-gray-800'
              }`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step >= 2
              ? 'bg-brand-green text-white'
              : 'bg-[#6B6375]/10 dark:bg-gray-800 text-[#6B6375] dark:text-gray-400'
              }`}>
              2
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-[#6B6375]/10 dark:border-gray-800 p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
              <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400 font-candara">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-start gap-3">
              <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-600 dark:text-green-400 font-candara">{success}</p>
            </div>
          )}

          {step === 1 && (
            <form className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-[#6B6375] dark:text-gray-300 mb-2 font-candara">
                  Nome completo
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Seu nome"
                    className="w-full pl-10 pr-4 py-3 bg-[#F8F6F2] dark:bg-gray-800 border border-[#6B6375]/20 dark:border-gray-750 rounded-xl text-[#2D2A26] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green font-candara"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#6B6375] dark:text-gray-300 mb-2 font-candara">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="seu@email.com"
                    className="w-full pl-10 pr-4 py-3 bg-[#F8F6F2] dark:bg-gray-800 border border-[#6B6375]/20 dark:border-gray-750 rounded-xl text-[#2D2A26] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green font-candara"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#6B6375] dark:text-gray-300 mb-2 font-candara">
                  WhatsApp
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="(11) 99999-9999"
                    className="w-full pl-10 pr-4 py-3 bg-[#F8F6F2] dark:bg-gray-800 border border-[#6B6375]/20 dark:border-gray-750 rounded-xl text-[#2D2A26] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green font-candara"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#6B6375] dark:text-gray-300 mb-2 font-candara">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 bg-[#F8F6F2] dark:bg-gray-800 border border-[#6B6375]/20 dark:border-gray-750 rounded-xl text-[#2D2A26] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green font-candara"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#6B6375] dark:text-gray-300 mb-2 font-candara">
                  Confirmar senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    name="confirmPassword"
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 bg-[#F8F6F2] dark:bg-gray-800 border border-[#6B6375]/20 dark:border-gray-750 rounded-xl text-[#2D2A26] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green font-candara"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleNextStep}
                className="w-full py-3 px-4 bg-brand-green hover:bg-brand-dark text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 mt-6"
              >
                Continuar
                <ArrowRight size={18} />
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleSignup} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-[#6B6375] dark:text-gray-300 mb-2 font-candara">
                  Nome da sua loja
                </label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="storeName"
                    value={formData.storeName}
                    onChange={handleChange}
                    placeholder="Ex: Restaurante Sabor"
                    className="w-full pl-10 pr-4 py-3 bg-[#F8F6F2] dark:bg-gray-800 border border-[#6B6375]/20 dark:border-gray-750 rounded-xl text-[#2D2A26] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green font-candara"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#6B6375] dark:text-gray-300 mb-2 font-candara">
                  URL da sua loja
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-3 bg-[#F8F6F2] dark:bg-gray-800 border border-r-0 border-[#6B6375]/20 dark:border-gray-750 rounded-l-xl text-[#6B6375] dark:text-gray-400 text-sm">
                    /s/
                  </span>
                  <input
                    type="text"
                    name="storeSlug"
                    value={formData.storeSlug}
                    onChange={handleChange}
                    placeholder="restaurante-sabor"
                    className="flex-1 pl-3 pr-4 py-3 bg-[#F8F6F2] dark:bg-gray-800 border border-[#6B6375]/20 dark:border-gray-750 rounded-r-xl text-[#2D2A26] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green font-candara"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Seus clientes acessarão: seuapp.com/s/{formData.storeSlug || 'sua-loja'}
                </p>
              </div>

              <div className="pt-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    name="acceptTerms"
                    checked={formData.acceptTerms}
                    onChange={handleChange}
                    className="mt-1 w-4 h-4 rounded border-gray-350 text-brand-green focus:ring-brand-green"
                  />
                  <span className="text-sm text-[#6B6375] dark:text-gray-400 font-candara">
                    Li e aceito os{' '}
                    <Link to="/terms" className="text-brand-green hover:text-brand-dark hover:underline font-bold" target="_blank">
                      Termos de Uso
                    </Link>{' '}
                    e a{' '}
                    <Link to="/politica-privacidade" className="text-brand-green hover:text-brand-dark hover:underline font-bold" target="_blank">
                      Política de Privacidade
                    </Link>
                  </span>
                </label>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 px-4 bg-[#F8F6F2] dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 text-[#6B6375] dark:text-gray-300 font-bold rounded-xl transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 px-4 bg-brand-green hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Criar conta'
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-[#6B6375] dark:text-gray-400 font-candara">
              Já tem uma conta?{' '}
              <Link
                to="/login"
                className="font-bold text-brand-green hover:text-brand-dark transition-colors"
              >
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}