import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatBRL } from '@/utils/pricing';

interface FloatingCartDockProps {
    checkoutPath: string;
    count: number;
    total: number;
    label?: string;
    desktopBottomClass?: string;
}

export function FloatingCartDock({
    checkoutPath,
    count,
    total,
    label = 'Carrinho',
    desktopBottomClass = 'lg:bottom-5',
}: FloatingCartDockProps) {
    const [expanded, setExpanded] = useState(false);
    const previousCountRef = useRef(count);

    useEffect(() => {
        if (count > previousCountRef.current) {
            setExpanded(true);
            const timer = window.setTimeout(() => setExpanded(false), 3200);
            previousCountRef.current = count;
            return () => window.clearTimeout(timer);
        }

        previousCountRef.current = count;
        return undefined;
    }, [count]);

    return (
        <div className={`fixed bottom-[3.55rem] left-1/2 z-[85] -translate-x-1/2 lg:left-auto lg:right-5 lg:translate-x-0 ${desktopBottomClass}`}>
            {expanded ? (
                <div className="flex max-w-[calc(100vw-2rem)] items-stretch overflow-hidden rounded-2xl bg-emerald-600 text-white shadow-2xl ring-1 ring-black/5">
                    <Link
                        to={checkoutPath}
                        className="flex min-h-14 items-center gap-3 px-3.5 py-2.5 transition hover:bg-emerald-700"
                        aria-label={count > 0 ? `Abrir ${label.toLowerCase()} com ${count} item(ns)` : `Abrir ${label.toLowerCase()}`}
                    >
                        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                            <ShoppingCart className="h-5 w-5" />
                            {count > 0 && (
                                <span className="absolute -right-2 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-emerald-600 bg-white px-1 text-[10px] font-black text-emerald-700">
                                    {count > 99 ? '99+' : count}
                                </span>
                            )}
                        </span>
                        <span className="min-w-0 pr-2">
                            <span className="block text-[11px] font-black uppercase tracking-wide text-emerald-50">
                                {label}
                            </span>
                            {count > 0 ? (
                                <span className="block whitespace-nowrap text-sm font-black">
                                    {count} {count === 1 ? 'item' : 'itens'} · R$ {formatBRL(total)}
                                </span>
                            ) : (
                                <span className="block whitespace-nowrap text-sm font-black">Vazio</span>
                            )}
                        </span>
                    </Link>
                    <button
                        type="button"
                        onClick={() => setExpanded(false)}
                        className="flex w-11 items-center justify-center border-l border-white/15 text-white/90 transition hover:bg-emerald-700 hover:text-white"
                        aria-label="Recolher carrinho"
                        title="Recolher"
                    >
                        <ChevronDown className="h-5 w-5" />
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-emerald-600 text-white shadow-2xl ring-1 ring-black/5 transition hover:bg-emerald-700 active:scale-95 dark:border-slate-950 lg:h-14 lg:w-14 lg:rounded-2xl lg:border-0"
                    aria-label={count > 0 ? `Expandir ${label.toLowerCase()} com ${count} item(ns)` : `Expandir ${label.toLowerCase()}`}
                    title={label}
                >
                    <ShoppingCart className="h-6 w-6" />
                    {count > 0 && (
                        <span className="absolute -right-2 -top-2 flex min-h-6 min-w-6 items-center justify-center rounded-full border-2 border-emerald-600 bg-white px-1 text-[10px] font-black text-emerald-700">
                            {count > 99 ? '99+' : count}
                        </span>
                    )}
                </button>
            )}
        </div>
    );
}
