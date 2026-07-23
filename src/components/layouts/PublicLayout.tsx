import { Outlet, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Home, ChevronUp, LogIn, UserPlus, Menu, X, FileText, Shield } from 'lucide-react';

export default function PublicLayout() {
  const [isDark, setIsDark] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Verifica tema do sistema e localStorage
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    } else {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    }

    // Set Favicon
    const faviconLink = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (faviconLink) {
      faviconLink.href = '/OptmaMenuLogo.ico';
    } else {
      const newLink = document.createElement('link');
      newLink.rel = 'icon';
      newLink.href = '/OptmaMenuLogo.ico';
      document.head.appendChild(newLink);
    }

    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 200);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fecha o menu mobile quando a tela for redimensionada para desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleDarkMode = () => {
    const isNowDark = document.documentElement.classList.toggle('dark');
    setIsDark(isNowDark);
    localStorage.setItem('theme', isNowDark ? 'dark' : 'light');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="min-h-screen bg-[#F8F6F2] dark:bg-gray-950 text-[#2D2A26] dark:text-gray-100 font-sans">
      {/* Header */}
      <header className="px-4 sm:px-[5%] py-2.5 flex justify-between items-center bg-white dark:bg-gray-900 border-b border-[#6B6375]/10 dark:border-gray-800 sticky top-0 z-[1000] shadow-sm transition-colors duration-300">
        {/* Logo - Tamanho proporcional */}
        <Link to="/" className="flex items-center shrink-0">
          <picture>
            <source srcSet="/assets/OptmaMenuLogo.webp" type="image/webp" />
            <img
              src="/assets/OptmaMenuLogo.webp"
              alt="OptmaMenu | Solução em Cardápio Digital"
              width={180}
              height={45}
              className="h-auto w-[100px] sm:w-[140px] transition-all duration-300"
              loading="eager"
            />
          </picture>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex gap-[15px] items-center">
          <button
            aria-label={isDark ? "Alternar para modo claro" : "Alternar para modo escuro"}
            className="cursor-pointer px-3 py-1.5 rounded-[20px] border border-gray-300 dark:border-gray-650 text-[13px] flex items-center gap-[5px] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors bg-transparent text-inherit focus:ring-2 focus:ring-brand-green focus:outline-none"
            onClick={toggleDarkMode}
          >
            {isDark ? (
              <>☀️ <span className="hidden sm:inline">Modo Claro</span></>
            ) : (
              <>🌙 <span className="hidden sm:inline">Modo Escuro</span></>
            )}
          </button>

          <Link
            to="/"
            className="inline-flex items-center text-brand-green hover:text-brand-dark transition-colors p-2 rounded-lg focus:ring-2 focus:ring-brand-green focus:outline-none focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            aria-label="Página inicial"
          >
            <Home className="w-5 h-5" />
          </Link>

          <Link
            to="/login"
            className="text-brand-green no-underline font-bold hover:text-brand-dark transition-colors px-3 py-2 rounded-lg"
          >
            Login
          </Link>

          <Link
            to="/signup"
            className="text-brand-green no-underline font-bold hover:text-brand-dark transition-colors px-3 py-2 rounded-lg"
          >
            Cadastre-se
          </Link>
        </div>

        {/* Mobile Navigation */}
        <div className="flex md:hidden items-center gap-2">
          {/* Botão Tema Mobile */}
          <button
            aria-label={isDark ? "Alternar para modo claro" : "Alternar para modo escuro"}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={toggleDarkMode}
          >
            {isDark ? '☀️' : '🌙'}
          </button>

          {/* Botão Menu Mobile */}
          <button
            onClick={toggleMobileMenu}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6 text-brand-green" />
            ) : (
              <Menu className="w-6 h-6 text-brand-green" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="fixed md:hidden top-[61px] left-0 right-0 bg-white dark:bg-gray-900 border-b border-[#6B6375]/10 dark:border-gray-800 shadow-lg z-[999] animate-slideDown">
          <div className="flex flex-col p-4 space-y-3">
            <Link
              to="/"
              className="flex items-center gap-3 px-4 py-3 text-[#6B6375] dark:text-gray-300 hover:bg-[#F8F6F2] dark:hover:bg-gray-800 rounded-lg transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <Home className="w-5 h-5 text-brand-green" />
              <span className="font-medium">Início</span>
            </Link>

            <Link
              to="/login"
              className="flex items-center gap-3 px-4 py-3 text-[#6B6375] dark:text-gray-300 hover:bg-[#F8F6F2] dark:hover:bg-gray-800 rounded-lg transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <LogIn className="w-5 h-5 text-brand-green" />
              <span className="font-medium">Login</span>
            </Link>

            <Link
              to="/signup"
              className="flex items-center gap-3 px-4 py-3 text-[#6B6375] dark:text-gray-300 hover:bg-[#F8F6F2] dark:hover:bg-gray-800 rounded-lg transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <UserPlus className="w-5 h-5 text-brand-green" />
              <span className="font-medium">Cadastre-se</span>
            </Link>

            {/* Links para termos e políticas - APENAS NO MOBILE */}
            <div className="pt-3 mt-2 border-t border-[#6B6375]/10 dark:border-gray-800">
              <Link
                to="/terms"
                className="flex items-center gap-3 px-4 py-3 text-[#6B6375] dark:text-gray-300 hover:bg-[#F8F6F2] dark:hover:bg-gray-800 rounded-lg transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <FileText className="w-5 h-5 text-brand-green" />
                <span className="font-medium">Termos de Uso</span>
              </Link>
              <Link
                to="/politica-privacidade"
                className="flex items-center gap-3 px-4 py-3 text-[#6B6375] dark:text-gray-300 hover:bg-[#F8F6F2] dark:hover:bg-gray-800 rounded-lg transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Shield className="w-5 h-5 text-brand-green" />
                <span className="font-medium">Política de Privacidade</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="pb-24 relative">
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-24 right-6 md:bottom-28 md:right-8 z-[1000] 
                     bg-brand-green hover:bg-brand-dark text-white
                     w-12 h-12 md:w-14 md:h-14 rounded-full shadow-lg 
                     flex items-center justify-center
                     transition-all duration-300 transform hover:scale-110
                     focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2
                     dark:focus:ring-offset-gray-900"
            aria-label="Voltar ao topo"
          >
            <ChevronUp className="w-6 h-6 md:w-7 md:h-7" />
          </button>
        )}
        <Outlet />
      </main>

      {/* Footer - SIMPLIFICADO: apenas copyright no mobile, completo no desktop */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-[#6B6375]/10 dark:border-gray-800 p-4 text-center z-[900]">
        <div className="flex flex-col md:flex-row justify-center items-center gap-4 text-sm text-[#6B6375] dark:text-gray-400 font-candara">
          <p>© {new Date().getFullYear()} <a href="https://www.optmaidea.com.br/" target="_blank" rel="noopener noreferrer" className="hover:underline">OptmaIdea</a>. Todos os direitos reservados.</p>

          {/* Links de termos - APENAS NO DESKTOP */}
          <div className="hidden md:flex gap-4">
            <Link to="/terms" className="hover:text-brand-green transition-colors">
              Termos de Uso
            </Link>
            <Link to="/politica-privacidade" className="hover:text-brand-green transition-colors">
              Política de Privacidade
            </Link>
          </div>
        </div>
      </footer>

      {/* Overlay para mobile quando menu está aberto */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-[998] md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}