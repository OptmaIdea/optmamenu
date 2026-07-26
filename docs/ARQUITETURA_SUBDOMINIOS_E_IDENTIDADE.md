# 🌐 Arquitetura de Subdomínios Dinâmicos (Wildcard) e Personalização de Identidade Visual Multi-Tenant

Este documento descreve detalhadamente como estruturar o **OptmaMenu** para oferecer URLs amigáveis baseadas em subdomínios dinâmicos (ex: `https://gelinharessjn.optmaidea.com.br`), bem como o sistema de personalização da identidade visual para cada estabelecimento.

---

## 📌 1. Visão Geral da Solução

Atualmente, o acesso ao cardápio público ocorre via caminho (`/s/`):
```txt
https://optmamenu.optmaidea.com.br/s/gelinharessjn
```

Com a arquitetura de **Subdomínios Wildcard**, cada lojista passa a ter um endereço limpo, exclusivo e amigável no domínio principal `optmaidea.com.br`:

```txt
https://gelinharessjn.optmaidea.com.br
```

### Mapeamento de Domínios do Ecossistema:
| Endereço | Função |
|---|---|
| `https://optmaidea.com.br` | Site institucional principal da empresa OptmaIdea |
| `https://optmamenu.optmaidea.com.br` ou `https://app.optmaidea.com.br` | Painel Administrativo do SaaS / Login dos Lojistas |
| `https://<slug-da-loja>.optmaidea.com.br` | Cardápio Público do Estabelecimento (ex: `gelinharessjn`, `pizzariadoze`) |

---

## 🛠️ 2. Configuração da Infraestrutura (Registro.br + Vercel)

Como o domínio `optmaidea.com.br` está registrado no **Registro.br**, a configuração é dividida em duas etapas simples:

### Etapa A: Configuração no Registro.br (ou Servidor de DNS / Cloudflare)
Para permitir que qualquer subdomínio dinâmico (ex: `qualquercoisa.optmaidea.com.br`) responda na Vercel:

1. Acesse o painel do **Registro.br** no domínio `optmaidea.com.br`.
2. Vá em **Editar Zona DNS**.
3. Adicione uma nova entrada do tipo **CNAME Wildcard**:
   - **Nome / Host:** `*` *(ou `*.optmaidea.com.br`)*
   - **Tipo:** `CNAME`
   - **Valor / Destino:** `cname.vercel-dns.com` *(ou o alias da Vercel fornecido no seu projeto)*

> 💡 **Nota:** Se você utilizar o Cloudflare como gerenciador de DNS do domínio `optmaidea.com.br`, adicione uma entrada `CNAME` com nome `*` apontando para `cname.vercel-dns.com` mantendo a nuvem laranja (Proxy) ou cinza (DNS Only).

### Etapa B: Configuração no Projeto da Vercel
1. Acesse o painel da **Vercel** -> Selecione o projeto `optmamenu`.
2. Acesse **Settings** -> **Domains**.
3. Adicione o domínio com caractere coringa (Wildcard): `*.optmaidea.com.br`.
4. A Vercel automaticamente emitirá um certificado SSL/TLS (HTTPS) gratuito válido para qualquer subdomínio.

---

## 🧠 3. Como o Frontend (React / Vite) Reconhece o Lojista pelo Subdomínio

No projeto React, a detecção da loja ocorre de forma transparente inspecionando `window.location.hostname`.

### 1. Utilitário de Extração do Tenant (`src/utils/tenant.ts`)
```typescript
export function getStoreSlugFromDomain(): string | null {
  const hostname = window.location.hostname; // Ex: 'gelinharessjn.optmaidea.com.br' ou 'localhost'
  
  // Lista de subdomínios reservados da plataforma que NÃO são lojas
  const reservedSubdomains = [
    'optmamenu',
    'app',
    'admin',
    'www',
    'api',
    'staging',
    'localhost',
    '127.0.0.1'
  ];

  const parts = hostname.split('.');

  // Se o hostname for "gelinharessjn.optmaidea.com.br" (3 partes)
  if (parts.length >= 3) {
    const subdomain = parts[0].toLowerCase();
    
    // Se o subdomínio não for uma palavra reservada da plataforma, é o slug da loja
    if (!reservedSubdomains.includes(subdomain)) {
      return subdomain; // Retorna 'gelinharessjn'
    }
  }

  return null;
}
```

### 2. Integração no Roteador Principal (`AppRoutes.tsx`)
Quando a aplicação inicia:
1. Se `getStoreSlugFromDomain()` retornar um `slug` (ex: `gelinharessjn`), o React renderiza diretamente a página da loja (`<Catalog storeSlug={slug} />`) no caminho raiz `/`.
2. Se não houver subdomínio de lojista (ex: acesso direto a `optmamenu.optmaidea.com.br`), o sistema abre a Landing Page ou o Painel Administrativo conforme a rota.

---

## 🎨 4. Personalização da Identidade Visual por Lojista

Para que cada loja tenha sua própria identidade de marca (cores, logo, fontes, tema e banners), a estrutura utiliza um modelo de **Customização Dinâmica via Variáveis CSS**.

### A. Estrutura de Dados no Supabase (`store_appearances` / `stores`)
Tabela ou colunas com as configurações visuais do estabelecimento:

```sql
-- Exemplo da estrutura de aparência por loja
CREATE TABLE IF NOT EXISTS store_appearances (
  store_id UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  primary_color TEXT DEFAULT '#F1613A',      -- Cor primária (botões, destaques)
  accent_color TEXT DEFAULT '#19A999',       -- Cor secundária / badge
  background_theme TEXT DEFAULT 'light',    -- 'light' | 'dark' | 'cream'
  font_family TEXT DEFAULT 'Plus Jakarta Sans',
  button_radius TEXT DEFAULT '12px',         -- Bordas arredondadas ou retas
  logo_url TEXT,                             -- Logotipo do restaurante
  banner_url TEXT,                           -- Capa / Header
  favicon_url TEXT,                          -- Ícone da aba do navegador
  custom_css TEXT                            -- CSS adicional opcional
);
```

### B. Hook de Aplicação Dinâmica de Tema (`useStoreTheme.ts`)
Quando o cardápio público carrega os dados da loja, um hook React aplica essas variáveis no elemento raiz DOM (`:root` ou container da página):

```typescript
import { useEffect } from 'react';

export function useStoreTheme(appearance?: StoreAppearance) {
  useEffect(() => {
    if (!appearance) return;

    const root = document.documentElement;

    // 1. Aplicação de Cores da Marca
    root.style.setProperty('--color-brand-primary', appearance.primary_color || '#F1613A');
    root.style.setProperty('--color-brand-accent', appearance.accent_color || '#19A999');
    root.style.setProperty('--border-radius-custom', appearance.button_radius || '12px');

    // 2. Atualização de Favicon Dinâmico
    if (appearance.favicon_url) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'shortcut icon';
        document.head.appendChild(link);
      }
      link.href = appearance.favicon_url;
    }

    // 3. Título da Aba
    if (appearance.store_name) {
      document.title = `${appearance.store_name} | Cardápio Digital`;
    }
  }, [appearance]);
}
```

### C. Uso no Tailwind CSS
No `index.css` ou configurações de estilo, as classes passam a consumir as variáveis dinâmicas:

```css
.btn-primary-store {
  background-color: var(--color-brand-primary, #F1613A);
  border-radius: var(--border-radius-custom, 12px);
  color: #FFFFFF;
}
```

---

## 📊 5. Comparativo Final de Opções

| Critério | Formato Atual (`/s/:slug`) | Subdomínios Wildcard (`<slug>.optmaidea.com.br`) |
|---|---|---|
| **Exemplo de URL** | `optmamenu.optmaidea.com.br/s/gelinharessjn` | `gelinharessjn.optmaidea.com.br` |
| **Sensação do Cliente** | "Estou acessando uma pasta de uma plataforma" | "Estou acessando o site oficial da loja" |
| **Apresentação em Impressos** | Longa | Curta, direta e elegante |
| **Favicon / Nome da Aba** | Fixo / Padrão da plataforma | 100% Personalizado por Loja |
| **Complexidade de DNS** | Nenhuma | Configuração única de CNAME `*` |
| **Custo Financeiro** | R$ 0 | R$ 0 (Usa o próprio domínio `optmaidea.com.br`) |

---

*Documento gerado em 2026-07-26 para planejamento futuro de arquitetura Multi-Tenant do OptmaMenu.*
