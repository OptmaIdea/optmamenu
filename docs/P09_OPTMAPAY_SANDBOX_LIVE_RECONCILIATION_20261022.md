# P09 — OptmaMenu + OptmaPay Sandbox: conciliação cruzada sem segredos
**Verificação ao vivo e somente leitura:** 22/10/2026. **Estado:** OptmaMenu GitHub branch de homologação; OptmaPay Sandbox ativo; nenhuma cobrança real, nenhuma escrita em qualquer banco.

## Escopo do produto
OptmaPay = **UM aplicativo** com dois modos `Learn` (ensino) e `Dev` (integrações, webhooks e APIs), com dinheiro **exclusivamente fictício**. OptmaMenu é um consumidor Dev real da API fictícia: a operação técnica e o pedido podem ser reais para teste, **mas o pagamento “paid” de optma_sandbox NÃO prova recebimento de reais**. Não contabilizar o status sandbox como receita financeira liquidada por um banco real sem identificação explícita da simulação.

## Evidência ativa — dois bancos diferentes
- Supabase OptmaMenu: `lgkkfmqzaorrutuoqeax`; OptmaPay: `wertmoquxdrucdbobuie`.
- Provedor `optma_sandbox`: 1 configuração habilitada, `environment=sandbox`, `credential_status=ready`. **Não foram lidas chaves, URLs privadas nem segredos**.
- `online_payment_intents` do OptmaMenu: **26** tentativas; **15 paid** (7 Pix + 8 cartões), **4 failed**, **6 expired**, **1 pending**.
- `online_payment_events` do OptmaMenu: **23** eventos (15 `paid`, 8 `settled`).
- `transactions` do OptmaPay que começam com `optmamenu:`: **30** registros (15 pares de lançamento).
- Correlacionando referências **somente por MD5 de identificadores opacos** (sem identificar clientes), **15/15** intents pagos têm exatamente um `out` e um `in` finalizados, do tipo correspondente. **15/15** débitos batem com o valor bruto do pedido; os oito cartões têm crédito líquido ≤ débito bruto. Os 11 intents sem `paid` não possuem lançamentos finalizados correlatos.
- Dados do mesmo conjunto: **0** transações com `real_money=true`, **0** com `environment!='sandbox'`, **0** referências Pix recebidas em duplicidade.
- O status `paid` é **pagamento SIMULADO**; não confundir com recebimento bancário real.

## Entrega executável
`supabase/tests/p09_optmapay_reconciliation.test.mjs` é um comparador independente que:
- verifica referência em hash, método, status, direção, quantidade de lançamentos, valor bruto, consistência do líquido e ambiente;
- falha diante de referência órfã, Pix liquidado duas vezes, operação `failed/expired/pending` com movimentação `completed`, flag de dinheiro real e valor divergente;
- nunca conecta à internet/bancos, nunca recebe segredos e não escreve lançamentos;
- executa 7 testes adversariais sintéticos no workflow `.github/workflows/verify.yml`.

Execute localmente com `node --test supabase/tests/p09_optmapay_reconciliation.test.mjs`. Para conferir novo snapshot **somente leitura** exportado pelo operador:
`node supabase/tests/p09_optmapay_reconciliation.test.mjs --verify optmamenu-hashed.json optmapay-hashed.json`.

A consulta SQL abaixo contém **somente informações técnicas e hashes MD5**, não inclui cartões, e-mails, documentos, tokens ou segredos. Use as duas consultas **nos respectivos projetos**, exporte suas linhas para arrays JSON temporários e **não inclua os relatórios brutos com referências em Git nem logs públicos**.

**OptmaMenu — projeto `lgkkfmqzaorrutuoqeax`:**
```sql
SELECT md5(i.external_reference) AS ref,
       i.method_code, i.status,
       i.amount::text AS amount
FROM public.online_payment_intents i
JOIN public.store_online_payment_providers p ON p.id=i.provider_id
WHERE p.provider_code='optma_sandbox'
  AND p.environment='sandbox'
  AND i.external_reference IS NOT NULL;
```

**OptmaPay — projeto `wertmoquxdrucdbobuie`:**
```sql
SELECT md5(t.external_reference) AS ref,
       t.type, t.direction, t.status,
       t.amount::text AS amount,
       t.real_money, t.environment
FROM public.transactions t
WHERE t.external_reference LIKE 'optmamenu:%';
```

## Próxima bateria manual supervisionada
**Não reaproveite pedidos de clientes, nem envie pagamento bancário real.** Em uma conta de teste do adulto e uma loja de homologação:
1. Criar pedido de teste com saldo e estoque fictícios controlados, confirmar que é optma_sandbox, gerar Pix e concluir em conta fictícia do OptmaPay Dev.
2. Confirmar no OptmaMenu pedido/intent `paid` simulado, exatamente um `out`/um `in` no OptmaPay, um webhook válido e nenhum lançamento duplicado.
3. Gerar código Pix e deixar expirar; confirmar `expired` e nenhum lançamento. Testar renovação limitada e tentativas concorrentes (somente em dados sintéticos).
4. Simular débito e crédito, verificar bruto, taxas fictícias, líquido, D+ e eventos `settled`.
5. Tentar reenvio do mesmo webhook assinado, assinatura adulterada e ordem errada dos eventos em fixture descartável; não alterar pedidos legítimos.
6. Testar falha de API, expiração de chave, inexistência de escopo, estorno parcial/total e conciliação, sem provocar movimentos não reversíveis em dados preexistentes.
7. Testar alternância Learn/Dev no mesmo OptmaPay para owner, usando somente **conta fictícia própria**. Equipe administrativa delegada não pode usar dados de terceiros por essa interface.

## Bloqueadores de publicação ainda relevantes
P0.7 está aprovado na CI, mas RLS financeiro, o índice único Pix e a autorização da Edge worker do OptmaPay **ainda não foram implantados** no banco de produção. Mesmo que os 15/15 casos históricos estejam conciliados, não aumentar a população sem um rollout forward-only revisado e backup/rollback. A colisão `20261014130500` do ledger impede executar `db push` sem reconciliação explícita. Esta entrega é um teste de integridade real por **leitura**, não comprovante de pagamentos reais, nem teste E2E transacional ao vivo do ciclo completo.

**GO:** continuar ensaios de contrato, testes de API via fixtures, e planejar piloto doméstico apenas depois da publicação controlada de segurança. **NO-GO:** misturar dinheiro real, dar logins independentes a menores, soltar chaves API em chats ou executar scripts de mutação sobre pedidos/clientes anteriores.
