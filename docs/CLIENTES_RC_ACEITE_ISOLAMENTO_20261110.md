# Clientes RC — aceite institucional, isolamento de loja e triagem P0

**Data:** 10/11/2026 · **Branch-base:** `agent/homologacao-geral-20260820` · **HEAD de referência:** `06f9d210f3fefc8f379fc87a9b3dc9ed546c8075`

## Decisões com evidência

- **Redes sociais: aceite funcional informado pelo operador** em 10/11: os links das cinco redes, depois de cadastrados, abriram corretamente. PR #31 já mesclado. Esse relato **não prova sozinho** RLS para papéis administrativos nem sessões cruzadas; preservar testes específicos.
- **Isolamento público, leitura real:** RPC `get_public_storefront_by_slug` consultada para Gelinhares (`gelinharessjn`) e LogLunch (`logmytravellunch`): retorno `ok`, slug e ID corretos e `visual_config.social_links` coincidente com a configuração daquela loja nos dois casos. Nenhum dado foi escrito.
- **Mínimo comercial por modalidade, leitura real:** em `store_delivery_methods`, Gelinhares possui entrega local ativa com mínimo de R$ 20,00, retirada ativa com mínimo zero e QR/Mesa com mínimo zero. O código instalado de `create_public_order_by_slug_legacy_internal` lê `v_delivery_method.minimum_order_value`; não aplica o valor legado `stores.minimum_order_value` indiscriminadamente. Não houve alteração de valores.
- **Permissões de conta:** em leitura de catálogo de políticas e privilégios, `customer_credentials` possui política explícita de negação de acesso direto; `delete_customer_account_service_safe` não permite execução por `anon` nem `authenticated`. Isso é evidência parcial, não teste de sessão real.
- **Baseline do CI:** Verify #880 do SHA de referência concluiu com `success`; Vercel do mesmo SHA `READY`.
- **Dados demonstrativos:** os perfis NASA usados para testes estão configurados na Gelinhares. É obrigatório substituir por canais reais ou remover antes do piloto. Não confundir com perfis oficiais da Gelinhares.

## Falha corrigida neste pacote

O `StoreLayout` tomava a `canonicalSlug` persistida no carrinho como prioridade sobre uma nova rota pública, e a sincronização carregava catálogo usando um `storeId` do contexto sem comparar com o ID da loja retornada. Isso permitia que a interface recuperasse institucional/carrinho da loja anterior ao visitar outra slug.

A correção toma a slug da URL como autoridade em rotas públicas; identifica a resposta carregada pela slug requisitada; não apresenta rodapé, institucional ou carrinho enquanto a identidade da loja atual divergir; e só sincroniza catálogo quando o ID carregado corresponder ao ID do carrinho. Rotas sem slug (como checkout) mantêm o fallback legítimo do contexto de compra. Testes sintéticos cobrem rota A/B, aliases via ID, autenticação e ausência de sincronização cruzada.

## Matriz objetiva de liberação

| ID | Cenário | Status nesta rodada | Evidência / Responsável | Destino |
| --- | --- | --- | --- | --- |
| C01 | Cadastro e abertura de X, YouTube, TikTok, Instagram e Facebook | **ACEITO pelo operador** | Relato de teste em 10/11, PR #31 | Clientes |
| C02 | Isolamento do retorno institucional por slug A/B | **PASSOU por consulta SQL** | Comparação de slug/ID e `social_links` em duas lojas; técnico | Clientes |
| C03 | Slug visível prevalece sobre carrinho persistido de loja A | **Correção em revisão** | `storeLayoutScope.test.ts` e `StoreLayout.isolation.test.tsx`; CI/Preview a conferir | Clientes |
| C04 | Mínimo R$20 delivery e zero retirada/Mesa | **PASSOU configuração/contrato** | `store_delivery_methods` + função efetiva; técnico | Clientes/Produtos |
| C05 | Exclusão definitiva não acessível por usuários públicos | **PASSOU verificação de grants** | `has_function_privilege`; técnico | Clientes |
| C06 | Cliente A/B autenticado, pedidos, endereços, carrinho e mensagens | **PENDENTE teste humano** | Contas descartáveis distintas e evidência sanitizada | Clientes/Superteste |
| C07 | Segurança de atributos legados sensíveis em `stores` | **P0 ABERTO** | Exame de grants/policies; corrigir em frente de segurança isolada, sem revogar colunas indiscriminadamente | Segurança/Supabase |
| C08 | Checkout concorrente, estoque/reserva, pagamentos, cancelamento pago e idempotência | **PENDENTE ponta a ponta** | Somente sandbox e massa sintética; evidenciar números de pedidos de teste | Clientes/Financeiro/Produtos/Superteste |
| C09 | Meu consumo → pedido, recompra, status, mensagens e dispositivos | **Código mesclado P09/P10/P11; reteste operacional pendente** | PRs #19, #21, #26; operador | Clientes |
| C10 | Mesa/PDV + dinheiro/troco, estoque e caixa | **Frente em andamento** | PRs #32/#33; teste de turno sintético ainda necessário | PDV/Mesa/Superteste |

## Segurança e isolamento financeiro

A revisão somente leitura encontrou um problema de acesso potencial a colunas sensíveis legadas da tabela `stores`. O campo SMS antigo está vazio em todas as lojas, mas existe um hash de estoque configurado. **Não revogar permissões genéricas de `stores` neste pacote**, pois leitores atuais ainda dependem dessa tabela; fazer remediação de armazenamento/validação server-side em pacote separado, com testes de papéis e integração. Não copiar hashes para logs ou documentação.

## Decisão

- **Redes sociais:** GO funcional informado pelo usuário. Pendente revalidar autorização por papéis em conta isolada.
- **Correção de roteamento A/B:** só considerar aprovada após CI, Preview e inspeção do diff; não pressupor merge.
- **Clientes RC:** **NO-GO operacional** enquanto C06, C07 e C08 não forem comprovados. Não reabrir funcionalidades mescladas sem defeito concreto.
- **Próxima frente coordenada:** continuar PDV/Mesa conforme planejamento aprovado, preservando o bloqueio de piloto por segurança/financeiro.

Sem gravação em Supabase, clientes, pedidos, estoque ou pagamentos nesta rodada.
