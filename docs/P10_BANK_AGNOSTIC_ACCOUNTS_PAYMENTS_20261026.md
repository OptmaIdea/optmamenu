# P10 — Bancos reais independentes de provedores; OptmaPay opcional
**Data:** 26/10/2026. **Escopo:** OptmaMenu (homologação), sem mudança de esquema ou dados ativos.

## Por que a aba Provedores aparecia vazia
- A página renderizava exclusivamente registros existentes de `store_online_payment_providers`. O LogLunch (`logmytravellunch`) tem **0 provedores** e por isso o usuário via apenas a mensagem genérica do Vault, sem formulário ou botão de cadastro.
- A Gelinhares já possui `optma_sandbox` configurado e não deve ser alterada.
- O LogLunch já possui contas financeiras internas (caixa, cofre, banco principal, carteira Pix, maquininha e recebíveis). Nenhuma delas é uma API ligada a banco real por si só.

## Modelo correto, sem dependência do OptmaPay
1. **Conta financeira própria da loja**: registros de `store_financial_accounts`; bancos reais para contabilização, identificação de instituição e quatro dígitos finais, regras de recebimento e conciliação. Seu cadastro não exige qualquer prestador de serviços de pagamento.
2. **Conexão automática com instituição financeira**: fase separada via instituição/parceiro autorizado (API/Open Finance, consentimento e autenticação externa ao OptmaMenu). **Ainda não implementada nesta versão**; nenhum botão deve alegar conexão bem-sucedida com banco real e nenhuma senha bancária deve ser solicitada.
3. **Provedor de checkout online**: `store_online_payment_providers`; o único provedor novo atualmente admitido pelas RPCs é `optma_sandbox`, estritamente fictício. Asaas foi aposentado. O P10 mantém OptmaPay somente como opção para testes, com registro inicialmente desativado.
4. **Rota de recebimento**: tabela existente `store_order_payment_account_routes`, aponta para a conta financeira interna de destino. Esta rota não constitui vínculo bancário nem faz Open Finance.
5. **Credenciais**: integram somente com a API correspondente; a integração OptmaPay usa o Vault e chave vinculada a uma conta OptmaPay selecionada. Credenciais de banco real não são pedidas.

## Entrega prática
- `/admin/online-payments?tab=providers`: nova área `Contas bancárias e integrações financeiras` com opção **Cadastrar banco real**, aviso claro **Open Finance não conectado**, opção **OptmaPay Sandbox** e link **Rotas de recebimento**. Sempre visível, inclusive com zero provedores.
- `/admin/financial-accounts?tab=settings&new=bank`: abre formulário nativo de **Nova conta financeira** já no tipo Banco. Solicita nome, banco/instituição e opcionalmente apenas os quatro últimos dígitos (sem senha, CPF ou número integral).
- O registro `bank_reference` é salvo em `store_financial_accounts.metadata` por RPC de contas financeiras existente, com `connection_mode=manual`, não como uma conexão fictícia a Open Finance.
- `src/utils/finance/financialBankReference.ts` valida e formata os metadados, com quatro casos Vitest.
- Zero alterações de saldo, credenciais, provedores ou dados de contas no banco ativo durante este desenvolvimento.

## Fluxo para a loja LogLunch
1. Selecionar LogLunch > **Financeiro > Pagamentos online > Provedores**.
2. **Cadastrar banco real** abre o formulário no módulo Contas financeiras. Digitar identificação da instituição e nome da conta; salvar pelo RPC nativo. Isso registra a conta para conciliação manual e roteamento interno, sem conexão automática.
3. Retornar a **Pagamentos online > Rotas de recebimento** e associar os métodos de recebimento à conta interna.
4. Para testes OptmaPay, separadamente, escolher **Configurar provedor Sandbox**. A criação é desativada por padrão; depois entrar na conta fictícia própria no OptmaPay, gerar as credenciais Dev, salvar no Vault e **Testar conexão** antes de ativar.
5. Para conectar **banco real por API/Open Finance**, escolher um parceiro/serviço autorizado para integrar, implementar autorização do titular e eventos de sincronização/conciliadores no backend. Não existe conector certificado ou credenciais desse parceiro neste escopo, e o cadastro manual jamais será chamado de conexão ativa.

## Critérios de aceite
- LogLunch exibe ação de primeira configuração e cadastro bancário independente de OptmaPay.
- Gelinhares mantém o provedor existente, e ainda pode adicionar bancos reais em seu plano financeiro.
- Contas de bancos reais geram cadastro de conta e metadado manual no mesmo RPC existente, com permissões `financial.accounts.manage` e histórico de saldos inalterado.
- OptmaPay não é requisito nem default automático para novos bancos.
- O campo de conta aceita **somente últimos quatro dígitos**, evita PII desnecessária, sem senhas nem tokens.
- Open Finance não é exibido como disponível/conectado sem parceiro e consentimento.
- Sem migração, sem dados de clientes alterados; publicar em homologação após CI e revisão.
