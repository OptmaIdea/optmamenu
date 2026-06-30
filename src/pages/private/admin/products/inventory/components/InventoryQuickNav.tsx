/**
 * InventoryQuickNav
 *
 * Regras de exibição por página:
 *
 *  /admin/products           → Categorias + todos do módulo de estoque
 *  /admin/categories         → Produtos
 *  /admin/inventory          → módulo sem Categorias
 *  /admin/products/lifecycle → módulo sem Categorias (inclui Produtos)
 *  /admin/products/:id/...   → módulo sem Categorias (inclui Produtos)
 *  /admin/transfers          → módulo sem Categorias
 *  /admin/transfers/:id      → botão Voltar + módulo sem Categorias
 *  /admin/suppliers          → módulo sem Categorias
 *  /admin/suppliers/:id      → botão Voltar + módulo sem Categorias
 *  /admin/stock/*            → módulo sem Categorias
 *  /admin/stock-movements    → módulo sem Categorias
 */

import { Link, useLocation } from 'react-router-dom';
import {
  Package,
  Tag,
  Layers,
  Activity,
  ArrowRightLeft,
  Truck,
  ShoppingBag,
  BarChart2,
  FileText,
} from 'lucide-react';

type NavItem = {
  to: string;
  icon: React.ReactNode;
  label: string;
};

/** Itens do módulo de estoque (sem Categorias) */
const MODULE_ITEMS: NavItem[] = [
  { to: '/admin/products',                 icon: <Package size={18} />,        label: 'Produtos' },
  { to: '/admin/inventory',                icon: <Layers size={18} />,         label: 'Estoque' },
  { to: '/admin/products/lifecycle',       icon: <Activity size={18} />,       label: 'Vida do produto' },
  { to: '/admin/transfers',                icon: <ArrowRightLeft size={18} />, label: 'Transferências' },
  { to: '/admin/suppliers',                icon: <Truck size={18} />,          label: 'Fornecedores' },
  { to: '/admin/stock/purchase-documents', icon: <ShoppingBag size={18} />,    label: 'Compras' },
  { to: '/admin/stock/quotations',         icon: <FileText size={18} />,       label: 'Cotações' },
  { to: '/admin/stock-movements',          icon: <BarChart2 size={18} />,      label: 'Movimentações' },
];

const CATEGORIES_ITEM: NavItem = {
  to: '/admin/categories',
  icon: <Tag size={18} />,
  label: 'Categorias',
};

/**
 * Retorna os itens de navegação para a rota atual.
 *
 * - Na página de Categorias: apenas Produto.
 * - Na página de Produtos: inclui Categorias + todos os itens do módulo.
 * - Em todas as outras: apenas itens do módulo de estoque (sem Categorias).
 * - Em ambos os casos, exclui o item que corresponde à rota atual.
 */
function getNavItemsFor(pathname: string): NavItem[] {
  if (pathname.startsWith('/admin/categories')) {
    const productsItem = MODULE_ITEMS.find((i) => i.to === '/admin/products');
    return productsItem ? [productsItem] : [];
  }

  const isProductsRoot = pathname === '/admin/products';
  const pool = isProductsRoot ? [CATEGORIES_ITEM, ...MODULE_ITEMS] : MODULE_ITEMS;

  return pool.filter((item) => {
    if (item.to === '/admin/products/lifecycle') {
      return !pathname.startsWith('/admin/products/lifecycle');
    }
    
    if (item.to === '/admin/products') {
      if (pathname.startsWith('/admin/products/lifecycle')) return true;
      return !pathname.startsWith('/admin/products');
    }

    return !pathname.startsWith(item.to);
  });
}

type InventoryQuickNavProps = {
  /** Botão ou link extra renderizado antes dos atalhos (ex.: Voltar em páginas de detalhe). */
  extra?: React.ReactNode;
};

export function InventoryQuickNav({ extra }: InventoryQuickNavProps) {
  const { pathname } = useLocation();
  const items = getNavItemsFor(pathname);

  if (items.length === 0 && !extra) return null;

  return (
    <nav
      aria-label="Navegação rápida do módulo de estoque"
      className="flex items-center gap-1 flex-wrap"
    >
      {extra}

      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          title={item.label}
          aria-label={item.label}
          className="
            inline-flex items-center justify-center
            h-10 w-10
            rounded-xl
            border border-gray-200 dark:border-gray-700
            bg-white dark:bg-gray-800
            text-gray-500 dark:text-gray-400
            hover:text-[#19A999] hover:border-[#19A999]/40
            dark:hover:text-[#19A999]
            transition-colors
            shrink-0
          "
        >
          {item.icon}
        </Link>
      ))}
    </nav>
  );
}
