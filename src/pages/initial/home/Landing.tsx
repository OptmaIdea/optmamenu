import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Truck, Store, TrendingUp, Smartphone, Zap, Palette } from 'lucide-react';
import { MetaTags } from '@/components/common/MetaTags';

export default function Landing() {
  useEffect(() => {
    // Set Favicon
    const faviconLink = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (faviconLink) {
      faviconLink.href = '/assets/OptmaMenuLogo.ico';
    } else {
      const newLink = document.createElement('link');
      newLink.rel = 'icon';
      newLink.href = '/assets/OptmaMenuLogo.ico';
      document.head.appendChild(newLink);
    }
  }, []);

  // Structured Data
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "OptmaMenu",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "BRL",
      "availability": "https://schema.org/InStock"
    },
    "description": "Solução de cardápio digital, gestão de pedidos e automação para lojas de delivery",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "150"
    },
    "featureList": [
      "Cardápio Digital",
      "Gestão de Pedidos",
      "WhatsApp Integration",
      "Controle de Estoque",
      "Programa de Fidelidade",
      "Delivery Management"
    ]
  };

  return (
    <>
      <MetaTags
        title="OptmaMenu | Solução em Cardápio Digital"
        description="Conecte sua loja ao mundo digital com nossa solução robusta de cardápio digital, gestão de pedidos e automação para delivery."
        keywords="cardápio digital, delivery, loja online, WhatsApp, gestão de pedidos, automação, sistema de pedidos, PWA"
        ogImage="/assets/OptmaMenuLogo.webp"
        ogUrl="https://optmamenu.com/"
        canonicalUrl="https://optmamenu.com/"
        schema={structuredData}
      />

      {/* Hero Section - CORRIGIDA */}
      <section className="bg-gradient-to-br from-brand-green to-brand-dark text-white px-[5%] py-20 md:py-28">
        <div className="max-w-4xl mx-auto">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-4 font-candara-bold leading-tight">
              Conecte sua loja ao mundo digital
            </h1>
            <p className="text-lg md:text-xl mb-8 opacity-90 font-candara max-w-xl">
              A solução robusta de cardápio digital, gestão de pedidos e automação para o seu delivery.
            </p>
            <Link
              to="/signup"
              className="inline-block button-primary text-white font-bold px-8 py-4 md:px-10 md:py-4 transition-all hover:shadow-xl hover:-translate-y-1 text-lg md:text-xl font-candara-bold"
            >
              Começar Agora
            </Link>
          </div>
        </div>
      </section>

      {/* Ideal para */}
      <div className="max-w-7xl mx-auto px-[5%] py-16 md:py-20">
        <h2 className="text-center text-3xl md:text-4xl font-black text-[#2D2A26] dark:text-white mb-12 font-candara-bold">
          Ideal para
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Delivery */}
          <div className="glass-card card-hover rounded-2xl p-8 text-center shadow-lg border-t-4 border-brand-green hover:-translate-y-1">
            <div className="mx-auto w-16 h-16 rounded-full bg-brand-green/10 flex items-center justify-center mb-6 text-brand-green">
              <Truck className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[#2D2A26] dark:text-white mb-3 font-candara-bold">Delivery</h3>
            <p className="text-[#6B6375] dark:text-gray-400 font-candara">
              Receba pedidos organizados diretamente no seu WhatsApp ou painel.
            </p>
          </div>

          {/* Loja Física */}
          <div className="glass-card card-hover rounded-2xl p-8 text-center shadow-lg border-t-4 border-brand-green hover:-translate-y-1">
            <div className="mx-auto w-16 h-16 rounded-full bg-brand-green/10 flex items-center justify-center mb-6 text-brand-green">
              <Store className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[#2D2A26] dark:text-white mb-3 font-candara-bold">Loja Física</h3>
            <p className="text-[#6B6375] dark:text-gray-400 font-candara">
              Cardápio QR Code para mesas e autoatendimento simplificado.
            </p>
          </div>

          {/* Escalabilidade */}
          <div className="glass-card card-hover rounded-2xl p-8 text-center shadow-lg border-t-4 border-brand-green hover:-translate-y-1">
            <div className="mx-auto w-16 h-16 rounded-full bg-brand-green/10 flex items-center justify-center mb-6 text-brand-green">
              <TrendingUp className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[#2D2A26] dark:text-white mb-3 font-candara-bold">Escalabilidade</h3>
            <p className="text-[#6B6375] dark:text-gray-400 font-candara">
              Gerencie múltiplas unidades com um único login administrativo.
            </p>
          </div>
        </div>

        {/* Características */}
        <h2 className="text-center text-3xl md:text-4xl font-black text-[#2D2A26] dark:text-white mt-20 mb-12 font-candara-bold">
          Principais características
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="glass-card card-hover rounded-2xl p-8 text-center shadow-lg hover:-translate-y-1">
            <div className="mx-auto w-16 h-16 rounded-full bg-brand-green/10 flex items-center justify-center mb-6 text-brand-green">
              <Smartphone className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[#2D2A26] dark:text-white mb-3 font-candara-bold">Design Responsivo</h3>
            <p className="text-[#6B6375] dark:text-gray-400 font-candara">
              Seus clientes acessam pelo celular, tablet ou computador com a mesma fluidez.
            </p>
          </div>

          <div className="glass-card card-hover rounded-2xl p-8 text-center shadow-lg hover:-translate-y-1">
            <div className="mx-auto w-16 h-16 rounded-full bg-brand-green/10 flex items-center justify-center mb-6 text-brand-green">
              <Zap className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[#2D2A26] dark:text-white mb-3 font-candara-bold">Rápido e Leve</h3>
            <p className="text-[#6B6375] dark:text-gray-400 font-candara">
              Tecnologia de ponta para carregar seu cardápio instantaneamente.
            </p>
          </div>

          <div className="glass-card card-hover rounded-2xl p-8 text-center shadow-lg hover:-translate-y-1">
            <div className="mx-auto w-16 h-16 rounded-full bg-brand-green/10 flex items-center justify-center mb-6 text-brand-green">
              <Palette className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[#2D2A26] dark:text-white mb-3 font-candara-bold">Personalizável</h3>
            <p className="text-[#6B6375] dark:text-gray-400 font-candara">
              Adapte as cores e identidade visual para combinar com a sua marca.
            </p>
          </div>
        </div>

        {/* CTA Final */}
        <div className="text-center mt-16">
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-brand-green hover:bg-brand-dark text-white font-bold px-8 py-4 rounded-full transition-all hover:shadow-xl text-lg font-candara-bold"
          >
            Comece agora
            <span className="text-xl">→</span>
          </Link>
        </div>
      </div>
    </>
  );
}