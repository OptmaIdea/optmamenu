# Governança da Biblioteca de Imagens de Prêmios

Data: 2026-07-26

## Objetivo

Garantir que o bucket `reward-images` não contenha arquivos soltos, residuais ou sem rastreabilidade.

## Modelo oficial

- `reward_media_assets` é o catálogo oficial da biblioteca.
- `fidelity_rewards.media_asset_id` representa o vínculo entre prêmio e imagem da biblioteca.
- `fidelity_rewards.image_url` mantém a URL exibida pelo prêmio.
- Remover uma imagem dentro do prêmio apenas desfaz o vínculo e limpa `image_url`; não exclui o ativo da biblioteca.
- Excluir pela biblioteca remove o vínculo histórico permitido, o registro em `reward_media_assets` e o arquivo físico no Storage.
- Imagens vinculadas a prêmio ativo não podem ser excluídas pela biblioteca.
- Imagens de produto não pertencem à biblioteca de prêmios e não devem ser copiadas para `reward-images`.

## Imagens de produto

Prêmios com `product_id` utilizam a imagem do próprio produto. Alterações na recompensa não devem alterar nem excluir o arquivo do produto. A interface deverá tratar a imagem herdada do produto como somente leitura enquanto houver produto vinculado.

## Caminho de Storage

O identificador usado no caminho é o UUID do ativo da biblioteca, não o UUID do prêmio. A estrutura atual é:

```text
<store-id>/library/<asset-id>/image.webp
```

A subpasta permite futuras variações do mesmo ativo sem colisão, como miniaturas e versões. Uma estrutura achatada (`<store-id>/library/<asset-id>.webp`) pode ser adotada em migração futura, mas não altera o modelo de governança.

## Pipeline obrigatório

1. Receber imagem.
2. Redimensionar para no máximo 800 × 800.
3. Converter para WebP com qualidade 82%.
4. Calcular SHA-256.
5. Reutilizar ativo existente quando o hash já estiver cadastrado na mesma loja.
6. Criar registro em `reward_media_assets`.
7. Vincular o prêmio por `media_asset_id`.

## Reconciliação

O comando abaixo audita o bucket por loja e classifica todos os arquivos:

```powershell
npm run storage:rewards:reconcile -- --store-id <UUID_DA_LOJA>
```

O modo padrão é dry-run e não altera nada.

Para remover somente órfãos confirmados:

```powershell
npm run storage:rewards:reconcile -- `
  --store-id <UUID_DA_LOJA> `
  --execute `
  --confirm DELETE_REWARD_LIBRARY_ORPHANS
```

A rotina:

- carrega todos os registros de `reward_media_assets`;
- carrega todos os `image_url` dos prêmios da loja;
- lista recursivamente o bucket sob o prefixo da loja;
- exclui somente objetos sem referência em nenhuma dessas fontes;
- verifica a ausência física após cada remoção;
- grava relatório JSON em `reports/storage-images/`.

## Invariantes

- Todo objeto válido em `reward-images` deve corresponder a um registro em `reward_media_assets` ou a uma referência explícita ainda em migração.
- Nenhum prêmio de produto deve criar cópia da imagem no bucket de recompensas.
- Nenhuma exclusão deve ser considerada concluída sem verificação posterior do Storage.
- Nenhum processo genérico deve apagar arquivos apenas por nome, data ou aparência de órfão.
