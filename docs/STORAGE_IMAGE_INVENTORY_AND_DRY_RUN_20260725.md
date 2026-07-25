# Inventário e simulação das imagens antigas do Storage

**Data:** 25/07/2026  
**Branch:** `agent/storage-image-inventory`  
**Estado:** etapa segura, sem escrita

## Objetivo

Mapear imagens antigas dos buckets `products`, `logos` e `reward-images`, cruzando cada objeto com as referências reais do banco antes de qualquer conversão ou exclusão.

Nesta etapa o script:

- lista objetos recursivamente;
- lê referências em `products.images`, `stores.logo_url` e `fidelity_rewards.image_url`;
- classifica objetos como referenciados ou candidatos a órfãos;
- identifica referências compartilhadas;
- propõe caminhos determinísticos;
- no modo `--dry-run`, baixa somente para memória e estima dimensões e tamanho em WebP;
- grava relatório JSON local;
- não envia arquivos;
- não atualiza banco;
- não exclui objetos.

## Requisitos locais

Criar em `.env.local`, sem commit:

```env
SUPABASE_URL=https://lgkkfmqzaorrutuoqeax.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<chave-service-role>
```

A chave `SUPABASE_SERVICE_ROLE_KEY` nunca deve receber prefixo `VITE_` e nunca deve ser exposta no frontend.

O script também aceita `VITE_SUPABASE_URL` para a URL, mas não aceita service role com prefixo público.

## Comandos

### Inventário completo

```powershell
npm run storage:images:inventory
```

### Inventário de um bucket

```powershell
npm run storage:images:inventory -- --bucket products
npm run storage:images:inventory -- --bucket logos
npm run storage:images:inventory -- --bucket reward-images
```

### Simulação completa

```powershell
npm run storage:images:dry-run
```

### Simulação apenas de produtos

```powershell
npm run storage:images:dry-run -- --bucket products
```

## Relatórios

Os relatórios são gravados em:

```text
reports/storage-images/
```

Essa pasta está ignorada pelo Git porque pode conter URLs, IDs e informações operacionais do ambiente.

Cada item registra:

- bucket e caminho;
- MIME type;
- tamanho atual;
- referências no banco;
- classificação `referenced` ou `orphan`;
- caminho novo proposto;
- dimensões atuais;
- dimensões WebP estimadas;
- tamanho estimado;
- economia estimada;
- erro individual de leitura ou processamento, quando houver.

## Perfis da simulação

| Bucket | Máximo | Qualidade WebP |
|---|---:|---:|
| `products` | 800 × 800 | 82 |
| `logos` | 800 × 800 | 90 |
| `reward-images` | 800 × 800 | 82 |

O redimensionamento usa `fit: inside`, preserva proporção, não amplia imagens menores e aplica rotação por metadados.

## Caminhos propostos

### Produtos

```text
<store_id>/<product_id>/image-01.webp
<store_id>/<product_id>/image-02.webp
```

### Logos

```text
<store_id>/logo.webp
```

### Recompensas

```text
<store_id>/<reward_id>/reward.webp
```

Os caminhos são apenas propostas no relatório. Nenhum objeto é movido nesta etapa.

## Critérios para avançar

Antes de implementar migração real:

1. executar inventário completo;
2. revisar objetos classificados como órfãos;
3. confirmar que as referências do banco foram reconhecidas;
4. executar `--dry-run --bucket products`;
5. revisar economia e possíveis erros;
6. definir rollback de referências;
7. implementar modo de migração real separado;
8. migrar um bucket por vez;
9. excluir órfãos somente em comando e revisão separados.

## Restrições preservadas

- não zerar buckets;
- não apagar arquivo antes da atualização confirmada do banco;
- não tratar objeto sem referência como órfão definitivo sem revisão;
- não colocar service role no frontend ou na Vercel;
- não migrar categorias e avatares nesta etapa, pois já possuem fluxo determinístico próprio;
- não converter automaticamente QR Codes, ícones PWA, documentos ou ativos de impressão.
