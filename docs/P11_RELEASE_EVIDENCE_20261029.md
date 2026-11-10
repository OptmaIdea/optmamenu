# P11 — Entrega real e conciliação de migrations (29/10/2026)

**Projeto Supabase:** `lgkkfmqzaorrutuoqeax`. **GitHub:** `OptmaIdea/optmamenu`. **Branch:** `agent/homologacao-geral-20260820`. **Produto prioritário:** OptmaMenu para operação real; Learn do OptmaPay permanece pausado.

## Objetivo
Corrigir o impedimento de configurar pagamentos antecipados no checkout da loja LogLunch **sem depender de OptmaPay**, com conta de recebimento escolhida dentro do financeiro do OptmaMenu. Fechar a adequação das tabelas `public` de modo auditável e compatível com as migrações S10 feitas em outra frente.

## O que foi implantado
- **S10 já aplicado em paralelo:** versão `20261029071549`, nega automaticamente grants em futuras TABLES/SEQUENCES de `public` criadas pelo papel `postgres`; não impacta tabelas existentes, e o CI P03 exige novo acesso explícito. Supabase confirma 129/129 tabelas `public` com RLS.
- **P11 tabela atual:** versão efetiva `20261029074001`, `p11_existing_public_tables_no_structural_api_grants_20261029`; remove de `anon` e `authenticated` apenas `TRUNCATE`, `REFERENCES` e `TRIGGER` em tabelas do schema public, preservando operações CRUD, policies e as 129 tabelas. Pós-implantação: **0** tabelas com privilégios estruturais de API.
- **P11 checkout:** versão efetiva `20261029074029`, `p11_store_checkout_prepayment_and_accounts_20261029`. RPC `public.configure_store_checkout_prepayment_safe(uuid,text,boolean,uuid,text,text)` valida responsável autenticado pela loja/gestão, método e conta interna ativa, e habilita/desabilita `pay_now` junto com duas rotas `advance` no **mesmo commit**. Rejeita API sem provedor habilitado `ready` e capacidade válida. Para PIX manual exige chave Pix pública, beneficiário e comprovante.
- **P11 instruções cliente:** versão efetiva `20261029074043`, `p11_public_order_proof_manual_pix_instructions_20261029`. O portador do token válido de pedido elegível pode ler chave Pix e beneficiário, enviar comprovante e aguardar conferência. Nenhum pedido é marcado automaticamente como pago por upload.

### Verificações executadas
- RPC em produção: `anon` não possui EXECUTE e chamada sem identidade responde `access_denied`. `authenticated` possui EXECUTE.
- Testes de DDL transacionais em banco ativo, **todos revertidos**, compilaram as três migrations antes de aplicação.
- Teste SQL de sessão autenticada simulada do titular da LogLunch, num `BEGIN/ROLLBACK` explícito: ao habilitar `pix_manual_qr`, criou **2 rotas** (delivery e pickup) na mesma transação. Consulta externa posterior: **0** rotas persistidas; método manual continua inativo; chave sintética de teste não foi gravada. Não se inventou Pix real nem se alterou checkout de clientes.
- Snapshot de origem: a Gelinhares já tem 10 rotas antecipadas; o LogLunch ainda tem zero até o operador cadastrar a chave Pix efetiva, destinatário e conta de liquidação.
- Pipeline GitHub PR #28 teve **13/13 jobs SUCCESS**, incluindo Postgres 17, RLS, integração e build TypeScript.
- Como o Supabase `apply_migration` criou os IDs reais indicados acima, **os arquivos da branch foram renomeados exatamente para esses IDs e nomes de ledger**, sem alterar seus SQLs; assim futuros `db push` não tentarão reaplicar as mesmas migrations com um timestamp alternativo.

## Tela do proprietário
`/admin/settings?tab=payment#pagamento-antecipado`: selecionar meio e conta interna, informar chave Pix e beneficiário quando manual, salvar. Fluxo visível também em `/admin/online-payments`. Não ligar cartões em produção pelo simulador OptmaPay; o backend rejeita integração que não anunciou capability correspondente. OptmaPay é uma opção de testes, não condição para Pix manual.

## Limite de responsabilidade
Este P11 encerra a correção específica do cadastro antecipado e os grants estruturais das tabelas atuais. As 27 tabelas RLS sem policy são intencionalmente fechadas. **Os alertas sobre funções SECURITY DEFINER anon/authenticated exigem triagem por RPC**; não criar políticas RLS abertas por conveniência nem afirmar que todos os avisos de segurança foram encerrados. Dados reais de crianças e funcionalidades Learn não estão no escopo. O deploy Vercel deve ser conferido no SHA final antes de habilitar pagamentos reais.
