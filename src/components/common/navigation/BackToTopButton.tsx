import { useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';

export default function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const scrollContainer = document.getElementById('main-scroll-container') || window;
    const isWindow = scrollContainer === window;

    const onScroll = (e: Event) => {
      const target = e.target as HTMLElement | Document;
      const scrollY = isWindow 
        ? window.scrollY 
        : (target as HTMLElement).scrollTop;
      setVisible(scrollY > 320);
    };

    scrollContainer.addEventListener('scroll', onScroll, { passive: true });
    // Trigger initial check
    if (isWindow) {
      setVisible(window.scrollY > 320);
    } else {
      setVisible((scrollContainer as HTMLElement).scrollTop > 320);
    }

    return () => scrollContainer.removeEventListener('scroll', onScroll);
  }, []);

  const handleClick = () => {
    const scrollContainer = document.getElementById('main-scroll-container') || window;
    if (scrollContainer === window) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      (scrollContainer as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Voltar ao topo"
      className={[
        'fixed bottom-5 right-5 z-[70] inline-flex h-11 w-11 items-center justify-center rounded-full',
        'bg-[#21A896] text-white shadow-lg transition-all duration-200',
        'hover:scale-[1.03] hover:shadow-xl',
        'focus:outline-none focus:ring-2 focus:ring-[#21A896]/40',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
      ].join(' ')}
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  );
}
