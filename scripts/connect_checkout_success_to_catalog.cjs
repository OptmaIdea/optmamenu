#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src/pages/store/Catalog.tsx');
if (!fs.existsSync(file)) {
  console.error('[checkout-success] Catalog.tsx não encontrado.');
  process.exit(1);
}

let source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

source = source.replace(
  "import { useParams } from 'react-router-dom';",
  "import { useLocation, useNavigate, useParams } from 'react-router-dom';",
);

if (!source.includes('const location = useLocation();')) {
  source = source.replace(
    'export default function Catalog() {\n    const { storeSlug, tableCode } = useParams();',
    'export default function Catalog() {\n    const { storeSlug, tableCode } = useParams();\n    const location = useLocation();\n    const navigate = useNavigate();',
  );
}

if (!source.includes('location.state?.orderSuccess')) {
  const marker = `    useEffect(() => {\n        if (!orderSuccess) return;\n        const timer = window.setTimeout(() => setOrderSuccess(null), 5000);\n        return () => window.clearTimeout(timer);\n    }, [orderSuccess]);`;

  if (!source.includes(marker)) {
    console.error('[checkout-success] Efeito atual de sucesso não encontrado.');
    process.exit(1);
  }

  const addition = `${marker}\n\n    useEffect(() => {\n        const checkoutSuccess = location.state?.orderSuccess;\n        if (!checkoutSuccess) return;\n\n        setOrderSuccess(checkoutSuccess);\n        navigate(location.pathname, { replace: true, state: null });\n    }, [location.pathname, location.state, navigate]);`;

  source = source.replace(marker, addition);
}

if (!source.includes('useLocation, useNavigate, useParams')) {
  console.error('[checkout-success] Imports de navegação não foram aplicados.');
  process.exit(1);
}

fs.writeFileSync(file, source, 'utf8');
console.log('[checkout-success] Retorno do checkout conectado ao aviso do catálogo.');
