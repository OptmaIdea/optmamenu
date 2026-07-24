const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function write(relativePath, content) {
  fs.writeFileSync(path.join(root, relativePath), content, 'utf8');
}

function replaceOnce(content, from, to, label) {
  if (!content.includes(from)) {
    throw new Error(`[pos-hardening] Trecho não encontrado: ${label}`);
  }
  return content.replace(from, to);
}

function ensureImport(content, importLine, anchor) {
  if (content.includes(importLine)) return content;
  return replaceOnce(content, anchor, `${anchor}\n${importLine}`, `import ${importLine}`);
}

const pdvPath = 'src/pages/private/admin/pdv/PdvPage.tsx';
let pdv = read(pdvPath);
pdv = ensureImport(
  pdv,
  "import { createClientUuid } from '@/utils/clientUuid';",
  "import { hasOnlyPdvOperationalAccess } from '@/utils/permissions';"
);
pdv = pdv.replaceAll('crypto.randomUUID()', 'createClientUuid()');

pdv = replaceOnce(
  pdv,
  `  const shortageLines = cart.filter(\n    (line) => line.quantity > line.product.available_stock\n  );`,
  `  const reservedConflictLines = cart.filter(\n    (line) =>\n      line.quantity > line.product.available_stock &&\n      line.product.reserved_stock > 0 &&\n      Math.max(line.product.on_hand_stock - line.quantity, 0) <\n        line.product.reserved_stock\n  );\n  const shortageLines = cart.filter(\n    (line) =>\n      line.quantity > line.product.available_stock &&\n      !reservedConflictLines.some(\n        (conflict) => conflict.product.id === line.product.id\n      )\n  );`,
  'separação entre falta física e conflito reservado'
);

pdv = replaceOnce(
  pdv,
  `    Boolean(paymentMethodCode) &&\n    (!shortageLines.length || shortageConfirmed) &&`,
  `    Boolean(paymentMethodCode) &&\n    reservedConflictLines.length === 0 &&\n    (!shortageLines.length || shortageConfirmed) &&`,
  'bloqueio de conflito reservado'
);

pdv = replaceOnce(
  pdv,
  `            const hasShortage = quantity > product.available_stock;`,
  `            const hasReservedConflict =\n              quantity > product.available_stock &&\n              product.reserved_stock > 0 &&\n              Math.max(product.on_hand_stock - quantity, 0) < product.reserved_stock;\n            const hasShortage =\n              quantity > product.available_stock && !hasReservedConflict;`,
  'diagnóstico da linha do carrinho'
);

pdv = replaceOnce(
  pdv,
  `                  hasShortage\n                    ? 'border-[#FBA93C]/60 bg-[#FBA93C]/10'`,
  `                  hasReservedConflict\n                    ? 'border-[#DC2626]/60 bg-[#DC2626]/10'\n                    : hasShortage\n                      ? 'border-[#FBA93C]/60 bg-[#FBA93C]/10'`,
  'estilo de conflito reservado'
);

pdv = replaceOnce(
  pdv,
  `                    {hasShortage && (\n                      <p className="mt-0.5 text-[10px] font-bold text-[#8A5A00] dark:text-amber-300">\n                        Divergência: {quantity - product.available_stock} sem saldo\n                      </p>\n                    )}`,
  `                    {hasReservedConflict && (\n                      <p className="mt-0.5 text-[10px] font-bold text-[#B91C1C] dark:text-red-300">\n                        Bloqueado: {product.reserved_stock} un. comprometidas com pedidos ativos\n                      </p>\n                    )}\n                    {hasShortage && (\n                      <p className="mt-0.5 text-[10px] font-bold text-[#8A5A00] dark:text-amber-300">\n                        Divergência física: {quantity - product.available_stock} sem saldo livre\n                      </p>\n                    )}`,
  'mensagem por tipo de divergência'
);

pdv = replaceOnce(
  pdv,
  `          {shortageLines.length > 0 && (`,
  `          {reservedConflictLines.length > 0 && (\n            <div className="rounded-xl border border-[#DC2626]/40 bg-[#DC2626]/10 p-3 text-xs font-semibold text-[#991B1B] dark:text-red-200">\n              Há produtos comprometidos com pedidos ativos. Remova esses itens ou trate as reservas antes de concluir a venda.\n            </div>\n          )}\n\n          {shortageLines.length > 0 && (`,
  'aviso global de reservas'
);

pdv = replaceOnce(
  pdv,
  `      const shortageItems = cart\n        .filter((line) => line.quantity > line.product.available_stock)`,
  `      const shortageItems = cart\n        .filter(\n          (line) =>\n            line.quantity > line.product.available_stock &&\n            !(\n              line.product.reserved_stock > 0 &&\n              Math.max(line.product.on_hand_stock - line.quantity, 0) <\n                line.product.reserved_stock\n            )\n        )`,
  'metadata apenas da divergência física'
);

write(pdvPath, pdv);

const directSalesPath = 'src/pages/private/admin/commercial/directSales/DirectSalesPage.tsx';
let directSales = read(directSalesPath);
directSales = ensureImport(
  directSales,
  "import { createClientUuid } from '@/utils/clientUuid';",
  "import QuickPosModal from './components/QuickPosModal';"
);
directSales = directSales.replaceAll('crypto.randomUUID()', 'createClientUuid()');
write(directSalesPath, directSales);

console.log('[pos-hardening] UUID compatível e conflito de reservas conectados.');
