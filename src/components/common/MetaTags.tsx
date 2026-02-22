import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface MetaTagsProps {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogUrl?: string;
  ogType?: string;
  twitterCard?: string;
  canonicalUrl?: string;
  schema?: Record<string, unknown>;
}

export function MetaTags({
  title,
  description,
  keywords,
  ogImage,
  ogUrl,
  ogType = 'website',
  twitterCard = 'summary_large_image',
  canonicalUrl,
  schema
}: MetaTagsProps) {
  const location = useLocation();

  useEffect(() => {
    // Update title
    document.title = title;

    // Meta tags to update
    const metaTags = [
      { name: 'description', content: description },
      { name: 'keywords', content: keywords || 'cardápio digital, delivery, loja online, WhatsApp, gestão de pedidos, automação' },
      { name: 'author', content: 'OptmaIdea' },
      { name: 'robots', content: 'index, follow' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:image', content: ogImage || '/assets/OptmaMenuLogo.webp' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:url', content: ogUrl || window.location.href },
      { property: 'og:type', content: ogType },
      { property: 'og:site_name', content: 'OptmaMenu' },
      { name: 'twitter:card', content: twitterCard },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: ogImage || '/assets/OptmaMenuLogo.webp' }
    ];

    // Remove existing meta tags
    metaTags.forEach(tag => {
      const existingTags = document.querySelectorAll(`meta[name="${tag.name}"], meta[property="${tag.property}"]`);
      existingTags.forEach(el => el.remove());
    });

    // Add new meta tags
    metaTags.forEach(tag => {
      if (tag.content) {
        const meta = document.createElement('meta');
        if (tag.name) meta.setAttribute('name', tag.name);
        if (tag.property) meta.setAttribute('property', tag.property);
        meta.setAttribute('content', tag.content);
        document.head.appendChild(meta);
      }
    });

    // Canonical URL
    if (canonicalUrl) {
      let canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
      }
      canonical.setAttribute('href', canonicalUrl);
    }

    // Structured Data
    if (schema) {
      let script = document.getElementById('structured-data') as HTMLScriptElement;
      if (script) script.remove();

      script = document.createElement('script');
      script.id = 'structured-data';
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    }

    // Cleanup on unmount
    return () => {
      metaTags.forEach(tag => {
        const existingTags = document.querySelectorAll(`meta[name="${tag.name}"], meta[property="${tag.property}"]`);
        existingTags.forEach(el => el.remove());
      });

      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) canonical.remove();

      const structuredData = document.getElementById('structured-data');
      if (structuredData) structuredData.remove();
    };
  }, [title, description, keywords, ogImage, ogUrl, ogType, twitterCard, canonicalUrl, schema, location.pathname]);

  return null;
}