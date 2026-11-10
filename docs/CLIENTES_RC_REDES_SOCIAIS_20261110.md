# Clientes RC — Redes Sociais Institucionais (10/11/2026)

**Escopo:** PR #31, sobre `agent/homologacao-geral-20260820`, sem alterações financeiras ou em projetos independentes.

## Implementação

- Fonte única: `stores.config.social_links` (JSONB), publicada pela RPC `get_public_storefront_by_slug` como `visual_config.social_links`; a filial é determinada pela slug.
- Chaves: `twitter` (X, retrocompatível), `youtube`, `tiktok`, `instagram`, `facebook`, `website`, `google_reviews`.
- Painel: Contato e social → Redes Sociais. Não exige OAuth. Vazio oculta; inválido impede salvar, exceto Site/Avaliações legados *não editados* (mantidos e não renderizados se inválidos).
- Portal: usa os links da loja atual, filtrados pelo normalizador central. Nova guia, `rel="noopener noreferrer"`; feedback e labels por campo.
- Não foram cadastrados perfis de demonstração na Gelinhares. Contatos e prêmios existentes não foram modificados.
- Nenhuma migration nova, alteração de RLS/grants, tabela nova ou SECURITY DEFINER.

## Matriz de aceite

| ID | Cenário | Evidência automatizada disponível | Aceite operacional |
| --- | --- | --- | --- |
| S01 | X legado em `social_links.twitter` e x.com | `storeSocialLinks.test.ts`, `StoreHubPortal.test.tsx` | Conferir com perfil de teste |
| S02 | YouTube canal/@perfil, TikTok, Instagram e Facebook | `storeSocialLinks.test.ts`, `StoreHubPortal.test.tsx` | Cadastrar/recarregar admin de loja de teste |
| S03 | Domínio parecido, esquema inseguro, credenciais, redirects | `storeSocialLinks.test.ts` | Conferir mensagem de erro do formulário |
| S04 | Mesmo conjunto para anônimo e cliente autenticado | `StoreHubPortal.test.tsx` | Testar dois perfis reais de homologação |
| S05 | Troca de slug A/B, remoção de link e vazio | `StoreHubPortal.test.tsx` | Testar no navegador com duas lojas isoladas |
| S06 | Site e Google Avaliações preservados | Tipos/compatibilidade, teste utilitário e portal | Validar valor anterior e reapertura de formulário |
| S07 | RLS: owner/gerente `settings.manage`, operador `view` | Políticas existentes consultadas no banco | Teste humano com papéis reais de homologação |
| S08 | Modal, navegação por teclado, modo escuro, mobile/desktop | Classes e rótulos presentes no código | Teste visual em Android/desktop |
| S09 | Configuração pública por slug e JSONB | Consulta SQL de leitura na Gelinhares: JSONB e RPC em concordância | Salvar/recarregar apenas em loja de teste |
| S10 | Gelipontos, marketing, contato e banners preservados | Diff do PR limitado ao institucional/redes e testes anteriores | Teste dirigido na Gelinhares, sem alterar cadastro |

**Responsável técnico:** frente Clientes. **Aceite humano:** operador autorizado da loja piloto.

**Critério de GO das redes:** CI (test + build) e Vercel Preview READY + S02, S04, S05, S07, S08, S09 validados em homologação. Os testes automatizados não substituem autorização e persistência real.

## Triagem de Clientes RC

| Prioridade | Cenário | Evidência conhecida | Próxima ação / destino |
| --- | --- | --- | --- |
| P0 | Sessão, RLS, cliente A/B e loja A/B | PRs P09, P10, P11 mesclados; testes de isolamento no workflow Verify | Executar matriz multiusuário; **Clientes/Superteste** |
| P0 | Checkout concorrente, pagamento antecipado, idempotência, reserva e estoque | PR #28 mesclado; testes SQL sintéticos no workflow | Simular dois checkouts e pagamento falho/duplicado sem dinheiro real; **Clientes/Produtos/Financeiro/Superteste** |
| P0 | Contas externas/reconciliação e dinheiro real | Escopo fora deste PR | Validar integrações específicas em sandbox; **Financeiro/Superteste** |
| P0 | Venda no PDV, mesa/comanda, baixa e caixa | Fora deste PR | Homologar turno completo antes do piloto; **PDV/Financeiro/Superteste** |
| P1 | Meu consumo → pedido específico, recompra e status | PR #21 mesclado; não reimplementar | Reteste humano mobile com pedido sintético; **Clientes** |
| P1 | Mensagens, erros amigáveis, filtros, dispositivos | PRs #19 e #26 mesclados | Reteste nos aparelhos da homologação; **Clientes** |
| P1 | Links institucionais em aparelhos e permissões | PR #31 | Testes S02–S09; **Clientes** |
| P2 | Refinamentos cosméticos, redação e densidade visual | Sem bloqueador comprovado | Registrar defeitos com captura e passos; **Clientes** |
| P2 | Métricas comerciais avançadas e eventos/festas/contratos | Fora do Clientes RC | Backlog posterior; **Dashboard/Festas** |

## Roteiro mínimo do lojista

1. Entre na loja autorizada no painel, abra **Aparência da Loja → Contato e social → Redes Sociais**.
2. Cole a URL oficial de **X, YouTube, TikTok, Instagram e Facebook**; mantenha Site e Google Avaliações conforme a loja. URLs explicitamente HTTP ou de domínio falso não serão aceitas.
3. Confira os indicadores e clique em **Salvar Aparência da Loja**. Recarregue a tela para confirmar persistência.
4. Em outra sessão, abra `/s/<slug-da-loja-de-teste>`, toque no nome da loja e acesse **Acompanhe a loja**. Confira links em aba nova, sem login e com login.
5. Apague uma URL, salve, recarregue e confirme sua ausência. Repita com loja B para comprovar isolamento.
6. Somente após aceite da Preview e dos testes humanos, considerar merge para homologação; após merge, conferir domínio, SHA e Gelipontos.

## Critérios de saída

- **GO de Redes:** separadamente, CI e Preview prontos **mais** testes operacionais da matriz aprovados.
- **GO de Clientes RC:** depende ainda da triagem P0/P1, evidência humana e aprovação do Superteste. Nenhum GO pode ser presumido por CI verde.
