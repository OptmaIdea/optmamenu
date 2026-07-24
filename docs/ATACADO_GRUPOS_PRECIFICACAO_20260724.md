# Atacado combinado por grupos de precificação

Data de início: 24/07/2026  
Frente: lançamento inicial — Etapa I.a  
Store de homologação: Gelinhares (`0abba741-0f77-4783-8cf8-58811cf7343b`)

## 1. Objetivo

Permitir que produtos de categorias visualmente diferentes contribuam para a
mesma quantidade de atacado.

Caso real:

```text
4 itens de Picolé cremoso
+ 4 itens de Picolé cremoso zero lactose
= 8 itens no grupo
→ faixa de 8 aplicada aos dois itens
```

Categorias continuam separadas na slug, nos filtros, nos relatórios e no
cadastro. O agrupamento existe somente para precificação.

## 2. Decisões preservadas

- backend é a autoridade final;
- frontend apenas simula o preço para resposta imediata;
- slug, checkout, Venda Direta e PDV usam o mesmo motor;
- vendas antigas não são recalculadas quando a regra muda;
- grupos podem ficar em rascunho;
- somente grupos ativos alteram preços;
- grupo ativo exige ao menos duas categorias;
- mover categorias não pode deixar outro grupo publicado com menos de duas;
- uma categoria só pode usar um grupo por vez;
- grupo e categoria devem pertencer à mesma loja;
- regra própria do produto prevalece.

Precedência:

```text
regra própria do produto
→ grupo de atacado ativo
→ regra da categoria
→ preço-base
```

## 3. Contrato de dados

### `pricing_groups`

| Campo | Uso |
|---|---|
| `id` | Identificador do grupo |
| `store_id` | Isolamento por loja |
| `name` | Nome operacional |
| `description` | Orientação ao lojista |
| `price_logic_type` | `category_volume` nesta versão |
| `price_rules` | Faixas `{ min, price }` |
| `active` | Rascunho ou publicado |
| `created_at`, `updated_at` | Auditoria temporal |

### Novos campos de `categories`

| Campo | Uso |
|---|---|
| `pricing_group_id` | Grupo escolhido |
| `use_pricing_group_rules` | Ativa a herança da regra do grupo |

## 4. Segurança

`pricing_groups` usa RLS.

Leitura:

- proprietário;
- `categories.view/manage`;
- `products.view/manage`.

Escrita:

- proprietário;
- `categories.manage`;
- `products.manage`.

`anon`:

- não acessa a tabela;
- não executa `save_pricing_group`;
- não executa diretamente `calculate_store_cart_pricing`.

A slug recebe somente grupos ativos por `get_public_catalog_by_slug`.

## 5. RPC administrativa

### `save_pricing_group`

Salva grupo e categorias de forma atômica.

Valida:

- usuário autenticado;
- permissão da loja;
- nome;
- faixas;
- categorias da mesma loja;
- pelo menos duas categorias ao publicar.

Uma categoria selecionada que estava em outro grupo é movida na mesma
transação, evitando associação dupla.

Cada criação ou alteração registra em `audit_logs`:

- responsável;
- grupo;
- estado anterior;
- estado posterior;
- categorias vinculadas;
- faixas e estado publicado/rascunho.

## 6. Motor autoritativo v2

`calculate_store_cart_pricing` passa a calcular:

- total por grupo;
- total por categoria;
- total individual por produto;
- origem da regra;
- quantidade usada na faixa;
- grupo aplicado;
- faixa aplicada;
- preço-base;
- preço unitário;
- total da linha;
- desconto não negativo.

Também corrige dois casos:

1. `pricing_strategy.volume_scope = per_product` passa a ser respeitado no
   backend;
2. entradas repetidas do mesmo produto são agregadas antes da validação.

## 7. Snapshot comercial

Pedidos públicos preservam no item:

- `pricing_source`;
- `pricing_quantity`;
- `pricing_group_id`;
- `pricing_group_name`;
- `base_price`;
- `unit_price`;
- `discount_total`;
- `line_total`;
- `applied_tier`.

O pedido preserva o retorno completo do motor em
`commercial_metadata.pricing_snapshot`.

Venda Direta e PDV já usam o motor central e preservam o snapshot completo no
pedido.

## 8. Interface administrativa

Local:

```text
Produtos → Categorias → Grupos de atacado
```

Recursos:

- lista de grupos;
- novo grupo;
- nome e descrição;
- rascunho/publicado;
- faixas de quantidade e preço;
- seleção de categorias;
- indicação de categoria vinculada a outro grupo;
- simulador antes de salvar;
- modo leitura com `categories.manage=false`.

O simulador soma quantidades hipotéticas por categoria e mostra:

- quantidade combinada;
- faixa alcançada;
- preço unitário.

## 9. Testes concluídos em `ROLLBACK`

### Banco

| Cenário | Resultado |
|---|---|
| Migration completa | Carregou e reverteu |
| Grupo inativo, 4 + 4 | R$ 3,75 por item |
| Grupo ativo, 4 + 4 | R$ 3,25 por item |
| Total combinado | R$ 26,00 |
| Desconto total | R$ 4,00 |
| Quantidade da faixa | 8 |
| Produto repetido no payload | Agregado corretamente |
| Regra própria do produto | Prevaleceu sobre o grupo |
| RPC como usuário autenticado | Salvou e vinculou 2 categorias atomicamente |
| RLS | Ativa |
| `anon` em `save_pricing_group` | Bloqueado |
| `anon` no motor interno | Bloqueado |
| `authenticated` no motor interno | Bloqueado; usa wrappers autorizados |

Nenhum grupo, vínculo ou alteração de produto foi persistido nesses testes.

### Frontend

- TypeScript dos novos serviços, tipos, modal e carrinho: aprovado;
- transformação JSX/TSX da tela de Categorias: aprovada;
- teste executável do carrinho:
  - 4 + 4 = R$ 26,00;
  - regra própria = R$ 3,50;
  - item do grupo = R$ 3,25.

## 10. Migration

Arquivo planejado:

```text
20260724201623_add_pricing_groups_combined_wholesale.sql
```

O CLI oficial não conseguiu criar o arquivo nesta sessão porque tentou escrever
em `/root/.supabase`, diretório somente leitura. O timestamp UTC real do ambiente
foi usado, e o conteúdo foi validado integralmente no PostgreSQL ativo com
`ROLLBACK`.

## 11. Checklist antes da aplicação definitiva

- [x] desenho de dados;
- [x] RLS e privilégios;
- [x] RPC administrativa;
- [x] motor autoritativo v2;
- [x] catálogo público;
- [x] snapshot;
- [x] interface;
- [x] simulador;
- [x] teste transacional;
- [x] teste TypeScript;
- [ ] preview Vercel;
- [ ] inspeção visual;
- [ ] aplicação da migration;
- [ ] teste autenticado do CRUD;
- [ ] teste real na slug;
- [ ] teste real no PDV;
- [ ] Advisors;
- [ ] integração na `main`.

## 12. Próxima etapa após este marco

Concluída a homologação do atacado combinado, a sequência aprovada é:

1. roteamento delivery × retirada por estoque e caixa;
2. refinamento mobile da slug e checkout;
3. clientes, permissões e fidelidade;
4. regras de entrega e recebimento.
