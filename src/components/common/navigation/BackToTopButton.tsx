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
        'fixed bottom-6 right-6 md:bottom-8 md:right-8 z-[1000]',
        'bg-[#19A999] hover:bg-[#14887B] text-white',
        'w-12 h-12 md:w-14 md:h-14 rounded-full shadow-lg',
        'flex items-center justify-center',
        'transition-all duration-300 transform hover:scale-110',
        'focus:outline-none focus:ring-2 focus:ring-[#19A999] focus:ring-offset-2 dark:focus:ring-offset-gray-900',
        visible ? 'translate-y-0 opacity-100 scale-100' : 'pointer-events-none translate-y-3 opacity-0 scale-75',
      ].join(' ')}
    >
      <ChevronUp className="w-6 h-6 md:w-7 md:h-7" />
    </button>
  );
}
