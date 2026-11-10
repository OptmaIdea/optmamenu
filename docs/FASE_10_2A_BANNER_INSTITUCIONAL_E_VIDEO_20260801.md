# Fase 10.2A — Banner institucional e vídeo da loja pública

**Data:** 01/08/2026  
**Branch:** `agent/fase-10-loja-publica-blueprint`

## Objetivo

Evoluir o banner simples da slug pública para uma área institucional responsiva, capaz de apresentar identidade da loja, mensagem principal e, quando configurado, um pequeno vídeo de apresentação.

## Implementação

Foi criado o componente:

- `src/pages/store/components/PublicStoreHero.tsx`

O catálogo passou a usar esse componente no lugar da imagem estática anterior.

## Comportamento responsivo

Alturas mínimas da área:

- celular: aproximadamente `180px`;
- tablet: aproximadamente `220px`;
- desktop: aproximadamente `280px`.

O container respeita a largura máxima atual da loja pública (`max-w-5xl`) e as margens laterais do catálogo.

## Arte recomendada

Banner principal:

- dimensão de produção: `1600 x 560 px`;
- formato preferencial: WebP;
- conteúdo principal recomendado entre `x=100..980` e `y=90..420`;
- evitar textos importantes próximos às bordas.

Versão mobile futura, caso seja adotada imagem separada:

- `1080 x 720 px`.

A implementação atual usa uma única imagem responsiva e aplica recorte com `object-cover`.

## Vídeo opcional

Configuração recomendada:

- MP4 com H.264;
- resolução fonte de `1280 x 720` ou `960 x 540`;
- proporção 16:9;
- duração de 6 a 10 segundos;
- sem áudio obrigatório;
- `muted`, `autoplay`, `loop` e `playsInline`;
- peso ideal até 3 MB e limite operacional recomendado de 5 MB;
- poster estático configurável.

No desktop, o vídeo ocupa uma coluna de até `400px`, mantendo texto e identidade à esquerda. Em telas menores, o vídeo é apresentado abaixo do texto, sem sobreposição.

## Novos campos aceitos em `visual_config`

```ts
visual_banner_url?: string;
visual_banner_video_url?: string;
visual_banner_video_poster_url?: string;
visual_banner_eyebrow?: string;
visual_banner_title?: string;
visual_banner_subtitle?: string;
visual_banner_alignment?: 'left' | 'center';
visual_banner_overlay_opacity?: number;
```

Esses campos são opcionais. Não foi criada migration porque a configuração visual já é transportada como objeto JSON. A tela administrativa para editar esses campos ainda deve ser implementada em bloco próprio.

## Fallbacks

Na ausência de textos específicos:

- título: `visual_title` ou nome da loja;
- subtítulo: `visual_slogan` ou descrição da loja;
- chamada superior: `Conheça nosso cardápio`;
- cor de fundo: cor primária da loja;
- opacidade do overlay: `0.5`.

Na ausência de vídeo, a área usa somente a imagem e o texto. Na ausência de imagem, a área usa a cor primária configurada.

## Arquivos alterados

- `src/pages/store/components/PublicStoreHero.tsx`;
- `src/pages/store/Catalog.tsx`;
- `src/types/index.ts`;
- `docs/FASE_10_2A_BANNER_INSTITUCIONAL_E_VIDEO_20260801.md`.

## Validação necessária

Executar:

```bash
npm run build
npm run lint
```

Homologar:

1. loja com imagem e sem vídeo;
2. loja com imagem, vídeo e poster;
3. loja sem imagem e com cor primária;
4. celular pequeno;
5. tablet;
6. desktop;
7. tema claro e escuro;
8. vídeo com autoplay bloqueado pelo navegador;
9. carregamento em conexão lenta;
10. continuidade do catálogo, carrinho e checkout.

Esta documentação não declara build ou lint executados após os commits, pois as alterações foram feitas pelo conector do GitHub.