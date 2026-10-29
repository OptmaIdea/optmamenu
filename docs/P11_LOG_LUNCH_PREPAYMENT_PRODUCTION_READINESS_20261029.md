# P11 — OptmaMenu primeiro: antecipação por loja e endurecimento public
**Data:** 29/10/2026. **Branch de trabalho:** `agent/p11-prepayment-public-hardening-20261029`. **Base verificada:** `11747753ac1fb6bb291ee9cb92fe4c9e0e08b538` da homologação. Não iniciar frentes Learn; manter apenas OptmaPay Dev/OptmaSMSGate estáveis como integrações de apoio.

## Falha reproduzida (consulta real, somente leitura)
As duas lojas estão públicas. A Gelinhares (slug `gelinharessjn`) oferece antecipação por Pix, Pix manual, débito e crédito, enquanto LogLunch (`logmytravellunch`) possui apenas Pix API antecipado, Pix manual inativo e cartão exclusivamente no recebimento. LogLunch já possui provedor `optma_sandbox` habilitado, porém este declara `credit_card=false` e não disponibiliza antecipação real por cartão. **LogLunch não tinha nenhuma rota de conta destino em `store_order_payment_account_routes`**. A conta financeira "Carteira Pix" estava inativa; portanto não criar rotas automaticamente sem escolher conta ativa. Não alterar estas configurações sem validação do proprietário.

## Entrega de interface e backend
1. Painel `Admin → Configurações → Pagamento → Pagamento antecipado no checkout`, com quatro meios `pix_manual_qr`, `pix`, `credit_card`, `debit_card`, opção habilitar/desabilitar e seleção da conta recebedora **interna do OptmaMenu**.
2. `Financeiro → Pagamentos online` contém link direto para este painel. O usuário pode cadastrar bancos reais independentes do OptmaPay em `Contas financeiras`.
3. RPC `configure_store_checkout_prepayment_safe`: verifica identidade autenticada, titularidade ou permissão de loja, conta recebedora ativa **da mesma loja**, habilitação de checkout e transaciona métodos/rotas de retirada e entrega na mesma chamada. Não atualiza pedidos, saldos nem autoriza pagamentos. Pix/Cartão via API exige provider **enabled**, **ready** e capabilities compatíveis; não presume que Sandbox movimenta recursos reais.
4. Pix manual pode operar sem PSP, mas requer `requires_proof=true`, `confirmation_mode=manual_proof`, **chave Pix pública e nome do beneficiário**. Essas instruções são retornadas somente a detentor de token válido de pedido elegível pelo `get_public_order_payment_proof_state`. No card do cliente há beneficiário, chave copiável, valor e upload de comprovante; a loja deve validar antes de confirmar recebimento. Não coletar senhas/token ou dados bancários sensíveis neste formulário.
5. Ao habilitar antecipação, cria/upsert rotas `public_store,pickup|delivery,advance,method` para a conta escolhida, inclusive para lojas sem rotas anteriores. Ao desligar desativa apenas as rotas desse método, sem apagar lançamentos existentes. Outras rotas existentes e outras lojas permanecem intactas.
6. Tabelas `public`: S10 **já aplicado por outra frente** em 29/10, com 129/129 RLS e futuros objetos não expostos automaticamente. Migração P11 adicional revoga `TRUNCATE, REFERENCES, TRIGGER` de `anon/authenticated` em tabelas existentes, pois essas operações não são controladas por RLS; preserva CRUD, policies, RPCs e dados. A análise de SECURTIY DEFINER é frente distinta — não dizer que todos os alertas de RPCs foram encerrados.

## Testes e aceite
- Rodar CI / PostgreSQL17, testes JS/TS/build e novo contrato P11; verificar nenhuma falha em Clientes/estoque.
- Aplicar as migrations seletivamente, checar o ledger, `pg_proc` e `pg_class`, grants reais.
- Validar por sessão autenticada do proprietário: LogLunch abre painel, define Pix manual, seleciona conta ativa, informa chave real **pertencente ao estabelecimento** e beneficiário, salva. O cliente autenticado deve ver Pix antecipado e receber instruções/fluxo de comprovante; Pix API e cartões só se a integração estiver pronta. Confirmar na área de pedidos o comprovante sem marcar automaticamente como pago.
- Verificar outras lojas intocadas (Gelinhares). Revalidar API de checkout `get_public_checkout_payment_options_by_slug` para retirada e entrega.
- Observar branches e SHA GitHub/Vercel antes de merge; não publicar de forma conflitante com trabalho de outras conversas.

## Situação separada de segurança
As 27 tabelas `public` com RLS mas sem policy são áreas internas intencionalmente fechadas, **não** devem receber policies abertas para zerar alertas INFO. A mudança da Supabase em 30/10/2026 sobre futuras tabelas já foi antecipada por S10. A tabela `stores.stock_password_hash` e a revisão de chamadas SECURITY DEFINER ainda requerem tratamento próprio; não misturar correções de privilégio estruturais com reescrita de autenticação ou regra comercial.
