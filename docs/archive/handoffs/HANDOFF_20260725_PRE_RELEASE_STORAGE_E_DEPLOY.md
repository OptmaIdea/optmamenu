# Handoff — Pré-lançamento, Storage e decisão de deploy

**Data:** 25/07/2026  
**Branch:** `agent/pricing-groups-combined-wholesale`  
**Versão atual:** `0.9.14`  
**Status recomendado:** Release Candidate controlado

## 1. Escopo concluído nesta frente

### Vendas, PDV e estoque

- Central de Vendas conectada em `/admin/sales`.
- Reservas conectadas em `/admin/stock/reservations`.
- PDV dedicado operacional em `/admin/pdv`.
- Venda Direta operacional em `/admin/direct-sales`.
- Motor central de preços preservado com precedência:
  - regra própria do produto;
  - grupo combinado de categorias;
  - categoria;
  - preço-base.
- Grupo combinado validado em PDV, Venda Direta e slug.
- Venda de R$ 26,00 validada com subtotal bruto de R$ 30,00 e desconto de R$ 4,00.
- Finalização idempotente preservada.
- Integração com estoque e Livro Diário validada.
- Conflito com saldo reservado bloqueado.
- Divergência física simples autorizável somente no PDV, conforme permissão.
- Divergências visíveis na Central de Vendas e na Vida do Produto.
- Tratamento de divergência auditável em Produtos → Divergências.

### Clientes e fidelidade

- PDV permite identificar cliente cadastrado.
- Cliente de balcão continua como padrão.
- Seleção do cliente é limpa após conclusão da venda.
- Cliente eventual com apenas nome/telefone não é cliente formal e não recebe fidelidade.
- Cliente cadastrado não participa automaticamente da fidelidade.
- Benefícios exigirão adesão válida e aceite dos termos.
- Cashback permanece como frente futura.

### Humanização

- Status técnicos traduzidos nas telas revisadas.
- Referências curtas de pedidos iniciadas na Vida do Cliente.
- Regra global de referências curtas foi preparada para implementação ampla:
  - `Pedido #A2C3`;
  - `TRF #550`;
  - código completo em tooltip ou tela técnica.

### Imagens

- Pipeline frontend implementado para validar, redimensionar, converter e compactar imagens em WebP.
- Avatares usam caminho determinístico `<user_id>/avatar.webp`.
- Categorias usam caminho determinístico `<store_id>/<category_id>/category.webp`.
- Substituição de avatar e categoria não deve acumular histórico de objetos.
- Exclusão de categoria corrigida para remover o caminho determinístico mesmo quando `image_url` já estiver nulo no formulário.
- Policies de Storage ajustadas para permitir leitura necessária ao `upsert`.
- Arquivos novos de avatar e categoria observados abaixo de 50 KB na maioria dos testes.

## 2. Auditoria atual do Supabase Storage

### Resumo por bucket

| Bucket | Arquivos | Tamanho total | Maior arquivo | Formatos encontrados |
|---|---:|---:|---:|---|
| `category-images` | 5 | ~185 KB | ~54 KB | WebP e objetos técnicos |
| `user-avatars` | 4 | ~56 KB | ~16 KB | WebP |
| `products` | 42 | ~12,3 MB | ~887 KB | WebP, JPEG, PNG e objetos técnicos |
| `logos` | 6 | ~929 KB | ~770 KB | WebP, JPEG e PNG |
| `reward-images` | 3 | ~8,9 MB | ~7,57 MB | WebP e PNG |

### Principais pontos de atenção

- `products/imagem-nao-disponvel-fallback-gelinhares.png`: ~887 KB.
- Várias imagens antigas de produtos em WebP ainda possuem entre 200 KB e 450 KB.
- Existe JPEG antigo de produto com ~118 KB e sua versão WebP com ~41 KB.
- `logos/store-logos/0.23256737636003955.png`: ~770 KB.
- `reward-images/.../logo-gelinhares.png`: ~7,57 MB.
- `reward-images/.../zclsz0936t9.png`: ~1,52 MB.

## 3. Como revisar tamanho e formato no Supabase

No painel do Supabase:

1. abrir **Storage**;
2. entrar no bucket desejado;
3. selecionar o arquivo;
4. conferir no painel lateral:
   - MIME type;
   - tamanho;
   - data de criação;
   - data de atualização.

Para visão consolidada, executar no SQL Editor:

```sql
select
  bucket_id,
  name,
  coalesce(metadata->>'mimetype', 'unknown') as mime_type,
  coalesce((metadata->>'size')::bigint, 0) as size_bytes,
  round(coalesce((metadata->>'size')::numeric, 0) / 1024, 1) as size_kb,
  created_at,
  updated_at
from storage.objects
where bucket_id in ('products', 'logos', 'reward-images')
  and name <> '.emptyFolderPlaceholder'
order by bucket_id, size_bytes desc, name;
```

Resumo por bucket:

```sql
select
  b.id as bucket_id,
  count(o.id) filter (where o.name <> '.emptyFolderPlaceholder') as file_count,
  coalesce(sum((o.metadata->>'size')::bigint)
    filter (where o.name <> '.emptyFolderPlaceholder'), 0) as total_bytes,
  max((o.metadata->>'size')::bigint)
    filter (where o.name <> '.emptyFolderPlaceholder') as max_bytes,
  string_agg(
    distinct coalesce(o.metadata->>'mimetype', 'unknown'),
    ', '
  ) filter (where o.name <> '.emptyFolderPlaceholder') as mime_types
from storage.buckets b
left join storage.objects o on o.bucket_id = b.id
group by b.id
order by b.id;
```

## 4. Decisão sobre o ícone/PWA do PDV

A criação de um ícone exclusivo `OptmaPDV` deixa de ser requisito pré-lançamento.

Decisão:

- não criar nem manter uma identidade visual PWA separada para o PDV nesta etapa;
- usar os ícones gerais do OptmaMenu enquanto o PWA estiver habilitado;
- não bloquear o deploy por ícone dedicado do PDV;
- revisar instalação PWA e cache em uma fase posterior de resiliência.

Observação técnica: o build PWA geral permanece desabilitado por padrão e só é ativado com `VITE_ENABLE_PWA=true`. O manifesto específico do PDV atualmente usa os ícones genéricos `pwa-192x192.png` e `pwa-512x512.png`, não uma arte exclusiva do OptmaPDV.

## 5. Versão recomendada

A versão atual é `0.9.14`.

Como esta frente fechou rotas, precificação combinada, Central de Vendas, reservas, divergências e otimização de imagens, a próxima versão deve ser:

```text
0.9.15-rc.1
```

Não usar `1.0.0` ainda.

A versão `0.9.15-rc.1` identifica:

- candidato a lançamento;
- uso controlado em loja piloto;
- possibilidade de correções antes da versão estável `0.9.15`.

Comando recomendado no checkout local, após confirmar árvore limpa:

```powershell
npm version 0.9.15-rc.1 --no-git-tag-version
npm run build
git add package.json package-lock.json
git commit -m "chore: preparar versao 0.9.15-rc.1"
```

A tag deve ser criada apenas depois do teste de fumaça no ambiente publicado.

## 6. Decisão de deploy

O estado atual permite um **deploy manual controlado como Release Candidate**, não ainda uma declaração de lançamento público definitivo.

Condições já atendidas:

- builds locais concluídos;
- consoles limpos nos fluxos validados;
- PDV, Venda Direta, Central de Vendas e Reservas operacionais;
- estoque, financeiro e divergências integrados;
- migrations aplicadas no projeto Supabase correto;
- pipeline de imagens novas funcionando.

Antes do deploy:

1. confirmar `git status` limpo;
2. atualizar para `0.9.15-rc.1`;
3. rodar `npm run build`;
4. confirmar que a Vercel aponta para a branch/commit correto;
5. não ativar `VITE_ENABLE_PWA=true` nesta publicação, salvo teste deliberado;
6. registrar o commit implantado;
7. garantir acesso ao rollback anterior.

Após o deploy, executar teste de fumaça:

- login e troca de loja;
- `/admin/pdv`;
- `/admin/direct-sales`;
- `/admin/sales`;
- `/admin/stock/reservations`;
- uma venda normal;
- uma venda com grupo combinado;
- uma divergência física autorizada;
- Central de Vendas;
- Vida do Produto;
- Livro Diário;
- upload, substituição e remoção de avatar;
- upload, substituição e remoção de categoria;
- slug pública em celular.

## 7. Próximos passos

### Imediatos, antes do lançamento público

1. deploy controlado da versão candidata;
2. teste de fumaça em Vercel;
3. saneamento das imagens antigas de produtos, logos e recompensas;
4. implementar validação backend para uploads fora do frontend;
5. conectar botão visual de excluir avatar;
6. concluir humanização global dos códigos de documentos;
7. revisar cadastro formal de clientes, adesão e termos de fidelidade;
8. revisar configurações da slug e experiência mobile first.

### Próxima frente funcional

Depois da estabilização do Release Candidate:

1. cadastro formal de cliente pela slug e presencial;
2. adesão separada à fidelidade;
3. desenho e configuração de cashback;
4. Mesa/Comanda digital MVP;
5. romaneio e documentos de Venda Direta;
6. revisão financeira de turno, sangria, reforço e conciliação posterior.

## 8. Riscos conhecidos não bloqueadores do RC

- imagens antigas pesadas no Storage;
- reward-images com dois PNGs muito grandes;
- humanização de referências ainda não aplicada em todas as telas;
- cadastro/aceite da fidelidade ainda precisa de revisão formal;
- cashback ainda não implementado;
- comanda/mesa ainda não implementada;
- PWA e funcionamento offline ainda precisam de homologação própria.

## 9. Recomendação final

Realizar o deploy manual como **Release Candidate controlado**, com uma loja piloto e teste de fumaça imediato. Não anunciar lançamento público ainda. O deploy servirá para validar o comportamento real da Vercel e consolidar a base antes das próximas frentes.
