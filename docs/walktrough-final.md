# Walkthrough final — reformulação de Produtos

Data da rodada: 28/07/2026  
Branch: `agent/storage-image-inventory`  
Commit verificado: `38e6a217f49145961843b1c8fc980b75d4044f53` — `fix: preserve product codes during partial form loading`

## Resultado executivo

**REPROVADO para deploy nesta rodada.**

O código de Produtos compilou com sucesso e as correções de saldo por localização, SKU e histórico de preços foram confirmadas por inspeção e consulta remota somente-leitura. Porém, a homologação visual autenticada não pôde ser concluída: o ambiente local redirecionou `/admin/products` para `/login` e não havia uma sessão de homologação disponível. Assim, os fluxos que exigem usuário, permissões ou gravação não foram simulados. Não houve deploy na Vercel, nem alterações no banco, migrations, RPCs, tabelas, policies ou funções.

## Ambiente e preparação

| Verificação | Resultado |
|---|---|
| Branch | `agent/storage-image-inventory` sincronizada com `origin/agent/storage-image-inventory` |
| Worktree antes da documentação | Limpo |
| `git pull --ff-only` | `Already up to date` |
| Servidor local | Vite em `http://127.0.0.1:5173`, resposta HTTP 200 |
| Acesso a `/admin/products` sem sessão | Redirecionou corretamente para `/login`; heading `Acesse sua conta` presente |
| Console do navegador nessa verificação | Sem erros |
| `npm run build` | Aprovado |
| `npm test -- --run` | 41/42 aprovados; 1 falha preexistente de timezone, detalhada abaixo |
| Deploy Vercel | Não realizado |
| Escrita no Supabase | Não realizada |

## Matriz de homologação

| Área / cenário | Status | Evidência e observações |
|---|---|---|
| Proteção da rota de Produtos | APROVADO | Sem sessão, `/admin/products` redireciona para `/login` sem erro de console. |
| Listagem e filtros | NÃO TESTADO | Requer sessão autenticada; não foi possível validar cards, busca, filtros, paginação e navegação real. |
| Novo produto | NÃO TESTADO | Requer sessão e submissão criaria dado de negócio. Nenhum registro de teste foi criado. |
| Edição e preservação de SKU | APROVADO COM RESSALVA | Código confirma mapeamento de `product_codes` para `codes`, bloqueio de salvar enquanto os códigos não carregam e desativação em vez de exclusão. A interação visual autenticada permanece pendente. |
| Detalhe do produto e estoque por local | APROVADO COM RESSALVA | Consulta corrigida para `location_id, on_hand, reserved` e disponibilidade calculada como `on_hand - reserved`. A contagem real de requisições na tela não pôde ser capturada sem sessão. |
| Ativo / inativo / ciclo de vida | NÃO TESTADO | Requer sessão e alteração de estado; não foi efetuada escrita de homologação. |
| Preços e margens — Abacaxi | APROVADO COM RESSALVA | Dados remotos de referência coerentes com a regra atual: 18 linhas, 64 unidades, preço médio efetivo R$ 3,515625; 1 entrada, 50 unidades, custo médio R$ 1,19; margem unitária estimada R$ 2,325625. A apresentação visual autenticada está pendente. |
| PDV, baixa de estoque e novo preço | NÃO TESTADO | Requer sessão, permissão e criação de transação comercial; não autorizado/executado nesta rodada. |
| Entrada de compra e histórico de custo | NÃO TESTADO | Requer sessão, permissão e criação de documento/entrada; não autorizado/executado nesta rodada. |
| Perfis e permissões | NÃO TESTADO | Não há sessões dos perfis necessários no ambiente local. |
| Responsividade e modo escuro | NÃO TESTADO | As telas autenticadas não foram abertas. |

## Regressões específicas verificadas

### Detalhe do produto: `inventory_location_balances`

O erro remoto originalmente observado era:

```json
{
  "code": "42703",
  "details": null,
  "hint": null,
  "message": "column inventory_location_balances.available does not exist"
}
```

A inspeção anterior da tabela confirmou as colunas relevantes `location_id`, `on_hand` e `reserved` (não existe `available`). O código em `useProductDetail.ts` agora faz a seleção compatível:

```ts
.select('location_id, on_hand, reserved')
```

e calcula saldo disponível localmente. Para o produto Abacaxi foram encontradas duas posições de estoque, com `on_hand` 4 e 19 e `reserved` 0; portanto não há dependência da coluna inexistente. A consulta de posições está concentrada no carregamento do detalhe; em desenvolvimento, o React StrictMode pode gerar uma segunda execução. A confirmação de uma ou duas chamadas reais na aba Network fica pendente de sessão autenticada.

### SKU / códigos

O estado remoto de referência do Abacaxi contém um SKU ativo e primário: `SNP-ABA-001`, normalizado como `SNPABA001`, sem duplicatas ativas/inativas observadas para o produto. A causa da perda aparente foi o carregamento aninhado em `product_codes` não ser mapeado para o estado `codes` do formulário; um salvamento parcial podia interpretar campos vazios como remoção.

O commit `38e6a217f49145961843b1c8fc980b75d4044f53` corrige o mapeamento e impede salvar a edição enquanto os códigos ainda não foram carregados. A sincronização também atualiza somente o que mudou e desativa códigos removidos (`active: false`) em vez de apagá-los. Falta apenas a confirmação visual autenticada de abrir, salvar sem editar o SKU e recarregar a página.

### Histórico de preços e margens

O commit `c90b2ff7a429bd94bdfe0078f818549042dcc5d4` restringe vendas concluídas a `completed`, usa `issue_date` e `document_code` para compras e mantém fallback de data em `created_at`. Os valores de referência do Abacaxi permanecem coerentes com essa implementação:

| Métrica | Resultado |
|---|---:|
| Linhas de venda | 18 |
| Unidades vendidas | 64 |
| Preço médio efetivo | R$ 3,515625 |
| Entradas de compra | 1 |
| Unidades compradas | 50 |
| Custo médio | R$ 1,19 |
| Margem unitária estimada | R$ 2,325625 |

## Testes automatizados

`npm run build` concluiu sem erro.

`npm test -- --run` executou quatro arquivos: 41 testes passaram e um falhou em `src/__tests__/utils/timezoneUtils.test.ts`.

```text
timezoneUtils > formatBrazilDateTime > should format an ISO string with timezone offset
Expected: conteúdo contendo 12:30
Received: 10/02/2025, 15:30
```

Essa falha é de formatação de fuso horário e não foi introduzida nem alterada nesta rodada. Não foi identificada evidência de impacto no cálculo de preços, custos ou margens, mas ela deve ser tratada antes de usar a suíte como sinal totalmente verde.

## Pendências para liberar uma decisão de deploy

1. Abrir o ambiente local com uma conta de homologação com permissão de gerenciamento de Produtos.
2. Reexecutar visualmente listagem, detalhe, edição do SKU, ciclo de vida, responsividade e modo escuro.
3. No detalhe do Abacaxi, confirmar na Network uma chamada a `inventory_location_balances` (ou duas em StrictMode), status 200 e ausência de referência a `available`.
4. Salvar o Abacaxi sem editar o SKU, recarregar a edição e confirmar `SNP-ABA-001` preservado. Qualquer teste que crie vendas, compras ou produtos deve usar massa de homologação explicitamente autorizada.
5. Decidir separadamente o tratamento do teste de timezone que está falhando.

Enquanto essas pendências existirem, o deploy continua bloqueado.
