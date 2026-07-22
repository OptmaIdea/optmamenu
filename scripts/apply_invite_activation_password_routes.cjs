#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const routesPath = path.join(root, 'src/AppRoutes.tsx');
const authPages = [
  path.join(root, 'src/pages/initial/auth/ActivateInvite.tsx'),
  path.join(root, 'src/pages/initial/auth/ForgotPassword.tsx'),
  path.join(root, 'src/pages/initial/auth/ResetPassword.tsx'),
];

function fail(message) {
  console.error(`\n[invite-auth-routes] ${message}\n`);
  process.exit(1);
}

function read(filePath) {
  if (!fs.existsSync(filePath)) fail(`Arquivo não encontrado: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

let routes = read(routesPath);

const lazyAnchor = "const Signup = lazy(() => import('@/pages/initial/auth/SignUp'));";
const lazyBlock = `${lazyAnchor}\nconst ActivateInvite = lazy(() => import('@/pages/initial/auth/ActivateInvite'));\nconst ForgotPassword = lazy(() => import('@/pages/initial/auth/ForgotPassword'));\nconst ResetPassword = lazy(() => import('@/pages/initial/auth/ResetPassword'));`;

if (!routes.includes(lazyAnchor)) fail('Âncora de páginas públicas não encontrada em AppRoutes.tsx.');
if (!routes.includes('const ActivateInvite = lazy(')) {
  routes = routes.replace(lazyAnchor, lazyBlock);
}

const routeAnchor = '          <Route path="/signup" element={<Signup />} />';
const routeBlock = `${routeAnchor}\n          <Route path="/activate-invite" element={<ActivateInvite />} />\n          <Route path="/forgot-password" element={<ForgotPassword />} />\n          <Route path="/reset-password" element={<ResetPassword />} />`;

if (!routes.includes(routeAnchor)) fail('Âncora da rota /signup não encontrada em AppRoutes.tsx.');
if (!routes.includes('path="/activate-invite"')) {
  routes = routes.replace(routeAnchor, routeBlock);
}

fs.writeFileSync(routesPath, routes, 'utf8');

for (const pagePath of authPages) {
  let source = read(pagePath);
  source = source.replace(
    "import { FormEvent, useEffect, useMemo, useState } from 'react';",
    "import { useEffect, useMemo, useState } from 'react';\nimport type { FormEvent } from 'react';",
  );
  source = source.replace(
    "import { FormEvent, useState } from 'react';",
    "import { useState } from 'react';\nimport type { FormEvent } from 'react';",
  );
  fs.writeFileSync(pagePath, source, 'utf8');
}

console.log('[invite-auth-routes] Rotas públicas de convite e recuperação adicionadas.');
console.log('[invite-auth-routes] Imports type-only ajustados para verbatimModuleSyntax.');
console.log('[invite-auth-routes] Rode npm run build.');
