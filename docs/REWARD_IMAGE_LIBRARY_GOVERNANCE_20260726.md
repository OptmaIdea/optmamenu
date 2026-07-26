# Governança da Biblioteca de Imagens de Prêmios

Data: 2026-07-26

## Objetivo

Garantir que o bucket `reward-images` não contenha arquivos soltos, residuais ou sem rastreabilidade e que o gerenciamento de imagens de prêmios seja feito exclusivamente pela Biblioteca de imagens.

## Modelo oficial

- `reward_media_assets` é o catálogo oficial da biblioteca.
- `fidelity_rewards.media_asset_id` representa o vínculo entre prêmio e imagem da biblioteca.
- `fidelity_rewards.image_url` mantém a URL exibida pelo prêmio.
- Remover uma imagem dentro do prêmio apenas desfaz o vínculo e limpa `image_url`; não exclui o ativo da biblioteca.
- Excluir pela biblioteca remove os vínculos históricos permitidos, o registro em `reward_media_assets` e o arquivo físico no Storage.
- Imagens vinculadas a prêmio ativo não podem ser excluídas pela biblioteca.
- Todo arquivo válido em `reward-images` deve possuir registro correspondente em `reward_media_assets`.

## Imagens de produto e sobreposição promocional

Prêmios com `product_id` podem usar a imagem herdada do produto ou uma imagem promocional própria da biblioteca.

Regras:

- a imagem original do produto permanece no bucket de produtos;
- a biblioteca de prêmios nunca remove nem altera o arquivo do produto;
- sem imagem própria, o prêmio usa a imagem do produto;
- ao escolher ou enviar imagem própria, o prêmio passa a usar uma sobreposição promocional;
- remover a imagem própria do prêmio desfaz somente essa sobreposição;
- nenhuma imagem de produto deve ser copiada automaticamente para `reward-images`.

A interface deverá deixar clara a diferença entre `Imagem herdada do produto` e `Imagem personalizada do prêmio`.

## Caminho de Storage

O identificador usado no caminho é o UUID do ativo da biblioteca, não o UUID do prêmio. A estrutura oficial desta versão é:

```text
<store-id>/library/<asset-id>/image.webp
```

A subpasta permite futuras variações do mesmo ativo sem colisão, como miniatura, original ou outros derivados. Uma estrutura achatada (`<store-id>/library/<asset-id>.webp`) foi discutida, mas não foi adotada nesta versão por não trazer ganho funcional que justificasse nova migração.

## Pipeline obrigatório

1. Receber imagem.
2. Redimensionar para no máximo 800 × 800.
3. Converter para WebP com qualidade 82%.
4. Calcular SHA-256.
5. Reutilizar ativo existente quando o hash já estiver cadastrado na mesma loja.
6. Criar registro em `reward_media_assets`.
7. Vincular o prêmio por `media_asset_id`.
8. Confirmar que o arquivo físico existe no caminho registrado.

## Exclusão

### Dentro do prêmio

- limpa `media_asset_id` e `image_url`;
- mantém a imagem disponível na biblioteca;
- não remove arquivo físico.

### Dentro da biblioteca

- bloqueia quando houver prêmio ativo não expirado;
- solicita confirmação para usos expirados ou inativos;
- limpa vínculos históricos permitidos;
- remove o registro em `reward_media_assets`;
- remove o objeto físico no Storage;
- verifica a ausência física antes de concluir.

## Políticas do bucket

O bucket `reward-images` possui políticas para:

- `INSERT` por usuário autenticado;
- `SELECT` por membro da loja correspondente ao primeiro segmento do caminho;
- `DELETE` por membro da loja correspondente ao primeiro segmento do caminho.

A política `SELECT` é necessária para que a API do Storage consiga localizar e confirmar objetos durante a exclusão.

## Limite atual

A biblioteca está limitada a 15 imagens por loja.

Esse limite existe no frontend e no banco. Futuramente será substituído por limites associados aos planos Gratuito, Premium, Pro ou equivalentes.

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

## Estado validado em 2026-07-26

A reconciliação encontrou 5 objetos, sendo 1 referenciado e 4 órfãos. Os quatro órfãos, totalizando 5.312.463 bytes, foram removidos com confirmação da resposta do Storage e verificação posterior de ausência.

Após os testes:

- o bucket foi reduzido a somente os ativos válidos;
- desvincular no prêmio manteve a imagem na biblioteca;
- excluir pela biblioteca removeu registro e arquivo físico;
- novo upload respeitou o pipeline WebP e recriou somente um ativo válido;
- não restaram arquivos residuais conhecidos.

## Invariantes

- Todo objeto válido em `reward-images` deve corresponder a um registro em `reward_media_assets`.
- Todo registro ativo em `reward_media_assets` deve apontar para um objeto físico existente.
- Nenhum prêmio de produto deve causar alteração ou exclusão da imagem original do produto.
- Nenhuma exclusão deve ser considerada concluída sem verificação posterior do Storage.
- Nenhum processo genérico deve apagar arquivos apenas por nome, data ou aparência de órfão.
- O comando de reconciliação deve ser usado sempre que houver suspeita de resíduo.

## Evolução futura: pequenos vídeos

O suporte a pequenos vídeos será estudado em uma frente separada. Antes da implementação, deverão ser definidos:

- formatos aceitos, preferencialmente MP4/H.264 e WebM quando adequado;
- duração, resolução, bitrate e tamanho máximos;
- geração de thumbnail e imagem de capa;
- reprodução automática ou sob demanda;
- impacto nos planos e cotas de armazenamento;
- deduplicação e hash de conteúdo;
- compatibilidade com loja pública, PDV e dispositivos móveis;
- regras de acessibilidade, carregamento e economia de dados;
- política de exclusão e reconciliação equivalente à biblioteca de imagens.

Vídeos não fazem parte do escopo encerrado nesta documentação.