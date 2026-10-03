# Fase 10.2A — Carrossel de mídias da loja pública

**Data:** 01/08/2026  
**Branch:** `agent/fase-10-loja-publica-blueprint`  
**Escopo:** evolução do banner único para um carrossel de até cinco mídias publicadas, preservando uma biblioteca administrativa futura com até doze itens gerenciados.

## 1. Terminologia adotada

A área pública passa a ser tratada como **Carrossel de destaque da loja**.

Os tipos previstos são:

- imagem WebP;
- vídeo promocional MP4;
- banner animado HTML5, em etapa posterior e com isolamento obrigatório;
- criativo rich media, como denominação técnica mais ampla para conteúdos com animação e interação.

A biblioteca administrativa futura será chamada de **Biblioteca de mídias da loja**.

## 2. Regra comercial

A arquitetura separa duas quantidades:

- até 12 mídias gerenciadas na biblioteca administrativa;
- até 5 mídias publicadas simultaneamente no carrossel da Gelinhares;
- o limite público deve futuramente ser controlado pelo plano da loja;
- somente itens ativos e publicados entram no carrossel;
- a ordem pública deve respeitar `sort_order`;
- o frontend não deve decidir regras comerciais de plano quando a API administrativa estiver pronta.

Nesta entrega foi introduzido o campo opcional:

```ts
banner_publication_limit?: number;
```

O frontend limita qualquer resultado a no máximo cinco itens.

## 3. Contrato de mídia

Foi criado o contrato:

```ts
export interface StorefrontBannerMedia {
  id?: string;
  type: 'image' | 'video' | 'html5';
  url: string;
  poster_url?: string;
  mobile_url?: string;
  alt_text?: string;
  title?: string;
  subtitle?: string;
  link?: string;
  open_in_new_tab?: boolean;
  sort_order?: number;
  active?: boolean;
  published?: boolean;
  duration_seconds?: number;
}
```

O campo existente `StoreConfig.banners` passa a usar esse contrato.

Campos legados permanecem aceitos como fallback:

- `visual_banner_url`;
- `visual_banner_video_url`;
- `visual_banner_video_poster_url`.

## 4. Estratégia de armazenamento

### 4.1 Bucket de homologação

Foi utilizado o bucket público:

```text
teste_banner
```

O bucket está configurado como público no projeto Supabase `lgkkfmqzaorrutuoqeax`.

Objetos encontrados em 01/08/2026:

| Arquivo | Tipo | Tamanho aproximado |
|---|---:|---:|
| `Gemini_Generated_Image_ojpljkojpljkojpl_11zon.webp` | WebP | 80 KB |
| `Gemini_Generated_Image_wsxy8hwsxy8hwsxy_11zon.webp` | WebP | 107 KB |
| `Gemini_Generated_Image_1107s91107s91107_11zon.webp` | WebP | 84 KB |
| `Gemini_Generated_Image_f60iyif60iyif60i_11zon.webp` | WebP | 197 KB |
| `logo.webp` | WebP | 26 KB |
| `crie_um_video_de_alguem_tomand(1).mp4` | MP4 | 1,52 MB |

Nesta demonstração pública foram usados quatro WebPs e um MP4. `logo.webp` ficou fora do carrossel.

### 4.2 Estrutura definitiva sugerida

O bucket definitivo não deve depender do nome de uma loja. Sugestões:

```text
storefront-media
```

ou:

```text
store-public-media
```

Estrutura recomendada:

```text
{bucket}/
  {store_id}/
    originals/
    images/
    videos/
    posters/
    thumbnails/
    html5/
```

## 5. Regra para imagens

WebP é o formato preferencial.

Diretrizes:

- dimensão de referência: `1600 × 560 px`;
- versão mobile opcional: `1080 × 720 px`;
- qualidade sugerida: 78–85;
- alvo de peso: até 350 KB;
- tolerância recomendada: até 600 KB para artes complexas;
- gerar thumbnail administrativa;
- remover o original somente após confirmar a conversão e integridade;
- repetir a política já usada na biblioteca de imagens de fidelidade.

## 6. Regra para vídeos

Formato inicial:

- MP4;
- codec H.264;
- `muted`;
- `playsInline`;
- sem áudio como requisito da reprodução automática;
- duração ideal: 6–12 segundos;
- limite inicial recomendado: 20 segundos;
- resolução de referência: `1280 × 720` ou `960 × 540`;
- poster WebP recomendado;
- alvo de peso: até 3 MB;
- tolerância técnica sugerida: até 6 MB.

O vídeo só reproduz quando é o slide ativo. Ao terminar, o carrossel avança para o próximo item.

## 7. HTML5 animado

HTML5 não foi habilitado nesta entrega.

A etapa futura deverá prever:

- pacote ZIP validado;
- `index.html` como ponto de entrada;
- lista restrita de extensões;
- bloqueio de scripts externos;
- bloqueio de chamadas de rede não autorizadas;
- renderização em `iframe sandbox`;
- Content Security Policy específica;
- limite de peso e duração;
- poster/fallback obrigatório;
- inicialização somente no slide ativo;
- encerramento ao sair do slide.

HTML arbitrário nunca deve ser injetado diretamente na página da loja.

## 8. Comportamento implementado

O componente `PublicStoreHero` agora:

- aceita de 1 a 5 mídias;
- filtra itens inativos ou não publicados;
- ordena por `sort_order`;
- usa uma mídia inicial aleatória a cada entrada;
- avança automaticamente imagens a cada seis segundos por padrão;
- avança vídeos ao término da reprodução;
- mantém loop contínuo do carrossel;
- oferece setas em tablet/desktop;
- oferece swipe no celular;
- exibe indicadores de posição;
- oferece botão de pausar/continuar;
- pausa em hover e foco;
- respeita `prefers-reduced-motion`;
- carrega somente a mídia ativa no DOM principal;
- mantém suporte aos campos legados de banner único.

## 9. Demonstração temporária da Gelinhares

Quando não há `config.banners` publicado nem banner legado configurado, lojas cuja identificação contenha `gelinhares` recebem temporariamente o conjunto de cinco mídias do bucket `teste_banner`.

Essa regra é exclusivamente de demonstração para homologação visual.

Ela deve ser removida quando uma das seguintes opções estiver pronta:

1. `StoreConfig.banners` for alimentado pela configuração administrativa;
2. existir RPC pública autoritativa para as mídias publicadas;
3. a biblioteca administrativa de mídias estiver concluída.

## 10. Próxima etapa administrativa

A área própria deverá contemplar:

- biblioteca de até 12 mídias;
- upload e conversão WebP;
- upload e validação de MP4;
- geração de poster e thumbnail;
- seleção de até 5 publicadas conforme o plano;
- drag-and-drop para ordenação;
- ativação e desativação;
- substituição sem perda de histórico;
- exclusão com confirmação;
- agendamento de início e fim;
- texto alternativo obrigatório;
- preview desktop e mobile;
- auditoria de criação, alteração, publicação e remoção;
- tratamento de `manage=false` em modo leitura;
- RLS por loja.

## 11. Arquivos alterados nesta entrega

- `src/types/index.ts`;
- `src/pages/store/components/PublicStoreHero.tsx`;
- `docs/FASE_10_2A_CARROSSEL_MIDIAS_LOJA_PUBLICA_20260801.md`.

## 12. Validação necessária

Executar no ambiente local:

```bash
npm run build
npm run dev
```

Homologar:

1. carregamento das cinco mídias da Gelinhares;
2. início aleatório;
3. avanço automático das imagens;
4. avanço após o fim do vídeo;
5. swipe no celular;
6. setas no desktop;
7. indicadores;
8. pausa e retomada;
9. comportamento com redução de movimento;
10. continuidade do catálogo, modal, carrinho e checkout;
11. ausência de erro de CORS no bucket público;
12. comportamento quando `config.banners` estiver preenchido;
13. fallback para banner único legado.

Esta entrega não cria migration nem tela administrativa.