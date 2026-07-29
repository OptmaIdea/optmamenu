# Fechamento — Storage e Biblioteca de Imagens de Prêmios

Data: 2026-07-26
Branch: `agent/storage-image-inventory`
Projeto Supabase: `lgkkfmqzaorrutuoqeax`

## Objetivo da frente

Sanear os buckets de imagens, reduzir arquivos pesados, eliminar resíduos, criar fallbacks locais e estruturar uma biblioteca reutilizável para imagens de prêmios.

## Resultado final

A frente foi concluída com:

- inventário dos buckets de produtos, logos e recompensas;
- migração e compactação de imagens para WebP;
- fallbacks locais para produto, recompensa e loja;
- remoção dos arquivos legados confirmados;
- biblioteca de imagens reutilizáveis em Prêmios;
- deduplicação por SHA-256;
- limite inicial de 15 imagens por loja;
- vínculo por `fidelity_rewards.media_asset_id`;
- miniaturas, ampliação, nome e indicação de uso;
- proteção contra exclusão de imagem usada por prêmio ativo;
- exclusão permitida e confirmada para usos expirados ou inativos;
- políticas `INSERT`, `SELECT` e `DELETE` no bucket `reward-images`;
- reconciliação segura entre banco e Storage;
- documentação de governança.

## Modelo funcional encerrado

### Biblioteca

A biblioteca é o catálogo oficial de imagens próprias de prêmios. Cada ativo possui um registro em `reward_media_assets` e um objeto físico em `reward-images`.

### Vínculo com prêmio

O prêmio pode:

- usar uma imagem da biblioteca;
- enviar uma nova imagem, que entra na biblioteca;
- remover o vínculo sem apagar o ativo;
- voltar a reutilizar a imagem posteriormente.

### Prêmio vinculado a produto

A imagem original do produto permanece protegida no fluxo de Produtos. O prêmio pode herdar essa imagem ou usar uma imagem promocional própria da biblioteca. A biblioteca nunca altera nem apaga o arquivo original do produto.

## Caminho oficial

```text
reward-images/<store-id>/library/<asset-id>/image.webp
```

O UUID é do ativo da biblioteca, não do prêmio.

## Evidência da reconciliação final

O dry-run registrou:

- 5 objetos encontrados;
- 1 objeto referenciado;
- 4 objetos órfãos;
- 5.312.463 bytes órfãos.

A execução removeu os quatro objetos órfãos. Para cada exclusão, o relatório confirmou:

- `storage_response_confirmed: true`;
- `verified_absent: true`.

O único objeto preservado era o WebP vinculado ao prêmio ativo `Super caneca GeLinhares`.

Depois dos testes adicionais:

- o prêmio foi desvinculado sem apagar a imagem da biblioteca;
- a imagem foi excluída pela biblioteca e o bucket ficou vazio;
- uma nova imagem foi enviada e o bucket voltou a conter somente um ativo válido;
- não ficaram resíduos conhecidos.

## Comando operacional

Dry-run:

```powershell
npm run storage:rewards:reconcile -- --store-id <UUID_DA_LOJA>
```

Execução:

```powershell
npm run storage:rewards:reconcile -- `
  --store-id <UUID_DA_LOJA> `
  --execute `
  --confirm DELETE_REWARD_LIBRARY_ORPHANS
```

A service role deve existir somente no ambiente local e nunca deve ser exposta no frontend ou no Vercel.

## Arquivos principais

- `src/services/rewardMediaLibrary.ts`
- `src/pages/private/admin/commercial/loyalty/settings/RewardImageLibrary.tsx`
- `src/pages/private/admin/commercial/loyalty/settings/RewardsConfig.tsx`
- `scripts/storage-reward-library-reconcile.mjs`
- `docs/REWARD_IMAGE_LIBRARY_GOVERNANCE_20260726.md`

## Decisões preservadas

- remover imagem dentro do prêmio significa desvincular;
- excluir imagem na biblioteca significa apagar cadastro e arquivo físico;
- prêmio ativo impede exclusão da imagem;
- prêmio expirado ou inativo permite exclusão após confirmação;
- imagens de produto não são duplicadas no bucket de recompensas;
- imagens promocionais próprias podem sobrepor visualmente a imagem herdada do produto;
- o limite atual é 15 imagens por loja e será revisto quando houver planos comerciais;
- nenhuma limpeza genérica deve remover objetos sem reconciliação prévia.

## Pendência futura deliberada

Estudar suporte a pequenos vídeos na biblioteca, em frente separada, considerando:

- codec, formato e compatibilidade;
- duração e tamanho máximos;
- transcodificação;
- thumbnails;
- reprodução em loja pública e dispositivos móveis;
- consumo de banda e armazenamento;
- limites por plano;
- reconciliação e exclusão segura.

## Status

**Frente encerrada e homologada funcionalmente.**

A continuidade do projeto pode seguir para uma nova frente sem pendências bloqueantes neste módulo.