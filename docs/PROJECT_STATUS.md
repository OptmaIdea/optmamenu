# Status do Projeto OptmaMenu

> **Última atualização:** 19/09/2026  
> **Branch de homologação:** `agent/homologacao-geral-20260820`  
> **Frontend:** React + TypeScript / Vercel  
> **Backend:** Supabase/Postgres (`lgkkfmqzaorrutuoqeax`)

---

## Estado executivo

A frente ativa continua sendo a homologação ponta a ponta de **cliente autenticado → carrinho compartilhado → pedido → reserva/estoque → fidelidade**. Os testes reais em desktop, tablet e celular de 19/09/2026 fecharam os defeitos mais importantes de sessão, expiração, histórico de pedidos, carrinho multi-dispositivo e fidelidade.

O login que anteriormente podia levar a **Loja não encontrada** foi validado manualmente como resolvido. O warning de preload do logo também deixou de ocorrer.

---

## Carrinho autenticado multi-dispositivo

O modelo definitivo desta etapa é **um carrinho por cliente + loja**, independentemente do dispositivo ou de quando o item foi adicionado. Recompras de pedidos anteriores adicionam itens a esse mesmo carrinho; não criam carrinhos paralelos.

Foram corrigidos dois defeitos de sincronização:

1. a limpeza remota agora grava um **tombstone** no servidor em vez de simplesmente excluir o registro;
2. snapshots antigos precisam informar a versão remota usada como base. Um dispositivo desatualizado não pode mais ressuscitar um carrinho que já foi limpo em outro aparelho.

A sincronização:
- recupera o estado remoto ao entrar na loja;
- atualiza em foco/visibilidade e consulta periodicamente enquanto a loja está aberta;
- recalcula produto, preço e estoque pelo catálogo atual;
- limpa o rascunho remoto após checkout;
- mantém carrinho anônimo apenas no dispositivo até a autenticação.

O rascunho residual do cliente de teste foi explicitamente convertido em tombstone no Supabase após a correção de conflito e permaneceu limpo mesmo com dispositivos antigos ainda abertos.

Migrations relacionadas:
- `20260919131826_customer_portal_continuity_loyalty_cart_draft`;
- `20260919142840_customer_cart_history_delivery_reservation_hardening`;
- `20260919144143_customer_cart_clear_conflict_guard`.

---

## Sessão do cliente e erros 401

`supabasePublic` permanece estritamente anônimo para storefront/catálogo. A sessão GoTrue usada pelo cliente final fica isolada.

O cliente autenticado agora:
- verifica validade do access token antes de REST/RPC/Functions;
- renova automaticamente usando o refresh token;
- serializa renovações concorrentes;
- em um 401, força uma única renovação e repete a requisição.

O histórico de pedidos também deixou de consultar diretamente `orders + products` pelo navegador. Passou a usar `get_customer_self_orders_safe`, customer-scoped e `SECURITY DEFINER`, reduzindo dependência de joins RLS no portal.

---

## Pedidos, histórico e recompra

Na área do cliente:
- status continua atualizando aproximadamente a cada 12 segundos;
- perfil/estado da conta também é atualizado em segundo plano;
- `delivery` e `pickup` são apresentados como **Entrega** e **Retirada**;
- pedido pode ser expandido para mostrar itens;
- nome histórico do produto vem primeiro de `order_items.product_snapshot`, evitando **Produto indisponível** quando o produto atual não é acessível pelo join público;
- **Comprar novamente** usa catálogo, disponibilidade e preço atuais e adiciona os itens ao carrinho único do cliente.

---

## Reserva e estoque

A regra confirmada é:

- **Retirada + não pago:** reserva expira conforme prazo configurado;
- **Retirada + pagamento confirmado:** reserva permanece sem expiração até retirada/finalização;
- **Entrega:** reserva permanece sem expiração; a saída física só deve ocorrer no despacho/`Saiu para entrega`.

O cron de expiração já havia sido restringido a retirada não paga. Nesta rodada também foi criado o trigger `enforce_delivery_stock_reservation_lifetime`, que grava `expires_at = infinity` para reservas de delivery.

O pedido real `PED-20260919-135026-5DB3` foi conferido no Supabase:
- reserva ativa;
- produto reservado;
- `expires_at = infinity`;
- motivo `delivery_order`;
- nenhum `stock_movement` ou `inventory_movement` de saída antes do despacho.

A tela administrativa **Reservas de estoque** foi corrigida para tratar `infinity` e datas inválidas sem lançar `RangeError: Invalid time value`. Reservas sem vencimento aparecem como **Sem prazo / reserva sem expiração**.

Migration de endurecimento de permissão do trigger:
- `20260919144325_harden_delivery_reservation_trigger_grants`.

---

## Fidelidade

### Adesão

A adesão deixou de ser um botão isolado. O fluxo agora separa:

- aceite obrigatório do **regulamento do programa de fidelidade**;
- WhatsApp promocional opcional;
- SMS promocional opcional;
- e-mail promocional opcional e disponível somente com e-mail verificado.

Comunicações essenciais de pedido e segurança são apresentadas como independentes do consentimento de marketing.

O programa exibido ao cliente usa os termos reais configurados pela loja em `fidelity_programs.program_terms`, com substituição das variáveis de loja/data/validade.

### Saída voluntária

Ao solicitar saída, o cliente recebe aviso explícito de irreversibilidade. Ao confirmar:
- pontos são zerados;
- extrato de fidelidade é apagado;
- vouchers são apagados;
- consentimento operacional do programa é apagado;
- tier/stamps são zerados;
- o extrato deixa de ser exibido;
- dados de cadastro e histórico comercial de compras permanecem;
- nova adesão futura continua permitida.

### Remoção e banimento pela loja

A Vida do Cliente ganhou gestão administrativa da fidelidade:

- **Remover da fidelidade:** apaga os dados do programa, mas permite adesão futura;
- **Banir CPF da fidelidade:** apaga os dados do programa e cria bloqueio de reingresso;
- **Liberar CPF:** remove o bloqueio e volta a permitir nova adesão.

O bloqueio não grava o CPF completo em uma lista pública: usa hash derivado de loja + CPF, mantendo somente os quatro últimos dígitos para contexto administrativo.

Migrations:
- `20260919143136_loyalty_membership_block_registry`;
- `20260919143157_loyalty_membership_purge_and_admin_actions`;
- `20260919143221_loyalty_terms_and_blocked_join_guard`.

---

## Verificação de e-mail

O e-mail continua sendo **atributo verificado do cliente**, não a identidade principal do Supabase Auth. A identidade forte continua sendo telefone confirmado + sessão/JWT do cliente.

Foi criada a infraestrutura:

- tabela `customer_email_verification_challenges`;
- token aleatório de uso único;
- armazenamento apenas do hash do token;
- validade de 30 minutos;
- rate limit;
- invalidação de desafios anteriores;
- confirmação válida apenas se o e-mail atual ainda for exatamente o mesmo;
- alteração do endereço continua zerando `email_verified`;
- Edge Function `request-customer-email-verification`;
- Edge Function pública de confirmação `confirm-customer-email`;
- botão **Confirmar meu e-mail com a loja** em Meus dados.

A comunicação é deliberadamente **store-first**:
- remetente visual usa o nome da loja;
- assunto: **Confirme seu e-mail para {Loja}**;
- texto explica que a própria loja precisa confirmar o endereço;
- OptmaMenu/OptmaIdea aparecem somente no rodapé tecnológico, com links institucionais.

A implementação de envio usa um adapter Resend. Para envio real ainda é necessário disponibilizar no projeto Supabase:
- `RESEND_API_KEY`;
- `CUSTOMER_EMAIL_FROM` com domínio/remetente autorizado.

Sem essas credenciais o backend retorna uma mensagem controlada de provedor ainda não configurado; nenhuma confirmação é simulada.

Migration:
- `20260919143725_customer_email_verification_challenges`.

---

## Segurança da rodada

As tabelas de carrinho, desafios de e-mail e bloqueios de fidelidade permanecem com RLS habilitado e sem acesso direto para `anon`/`authenticated`; o acesso funcional é feito por RPCs/Edge Functions específicas.

O Security Advisor identificou o novo trigger de reserva como executável externamente por padrão; o grant foi corrigido imediatamente e a função ficou restrita ao uso interno/service role.

Os novos relacionamentos de desafios de e-mail e bloqueios de fidelidade também receberam índices de cobertura após revisão do Performance Advisor (`20260919144701_index_customer_loyalty_email_foreign_keys`).

---

## Homologação imediata recomendada

1. Em um dispositivo, adicionar itens ao carrinho autenticado; confirmar que aparecem nos demais.
2. Limpar em um dispositivo; em até ~10 segundos/foco, confirmar carrinho vazio nos três aparelhos e que ele não reaparece.
3. Criar novo item depois da limpeza e confirmar que um carrinho novo pode ser iniciado normalmente.
4. Abrir pedido histórico e confirmar nomes reais dos produtos; usar **Comprar novamente**.
5. Confirmar pagamento de retirada antecipada e abrir Reservas: tela não deve quebrar; reserva deve mostrar **Sem prazo**.
6. Conferir delivery ainda reservado e sem baixa física antes de **Saiu para entrega**.
7. Alterar dados/perfil em um dispositivo e aguardar atualização automática nos demais sem F5.
8. Em Fidelidade, abrir regulamento, escolher permissões e aderir.
9. Sair do programa e confirmar saldo/extrato removidos; em seguida testar nova adesão.
10. No administrativo, testar **Remover**, **Banir CPF** e **Liberar CPF**.
11. Após configurar o provedor de e-mail, solicitar verificação, abrir link e confirmar `email_verified=true` nos demais dispositivos.

---

## Pendências abertas

- configurar credenciais/remetente do provedor de e-mail e homologar entrega real;
- gestão visual de campanhas/banners exclusivos de fidelidade;
- notificações de carrinho abandonado, agora tecnicamente possíveis pelo rascunho autenticado, sempre condicionadas aos consentimentos de marketing;
- push/realtime customer-scoped poderá futuramente substituir o polling seguro;
- comunicação de **Saiu para entrega** por e-mail/WhatsApp com ETA autoritativo;
- fluxo forte para alteração posterior de CPF, nascimento e telefone.

---

## Ajustes de homologação — 19/09/2026 (segunda rodada)

A validação em desktop/tablet/celular encontrou quatro pontos adicionais e eles foram tratados no baseline técnico:

- **Carrinho novo após limpeza:** o conflito deixou de comparar timestamps JavaScript/Postgres e passou a usar uma revisão inteira monotônica (`customer_cart_drafts.revision`). Isso elimina o caso em que microssegundos do Postgres faziam um carrinho novo parecer stale após um tombstone de limpeza.
- **Fidelidade:** a adesão agora é atômica pelo RPC `join_customer_self_loyalty_safe`; exige CPF, data de nascimento, e-mail válido **e confirmado**, aceite do regulamento e uma declaração explícita de responsabilidade pela veracidade dos dados. Não há bloqueio por idade calculada; a data continua disponível para regras legítimas do programa, como aniversário.
- **Saída da fidelidade:** o purge backend remove também o consentimento específico de responsabilidade do programa, além de pontos, transações, vouchers e consentimento de adesão; cadastro e pedidos permanecem independentes.
- **Telefone/OTP:** para Brasil, `629...`, `55629...` e `+55629...` convergem para a mesma identidade. Número internacional é aceito quando o código do país é informado explicitamente com `+`; sem país informado, o padrão é Brasil. Cadastro com telefone já existente é recusado **antes** da geração/envio de OTP, economizando SMS e orientando o cliente a entrar.
- **E-mail:** a Edge Function de verificação continua store-first e agora reconhece Resend ou Brevo, além de aliases comuns de segredo/remetente. Se o ambiente das Edge Functions não enxergar as credenciais, a UI informa se falta chave do provedor, remetente ou ambos sem revelar valores sensíveis.

Migrations:
- `20260919160049_customer_cart_revision_conflict_control`;
- `20260919160144_loyalty_verified_email_responsibility_join`;
- `20260919160216_customer_phone_normalization_and_otp_preflight`.

Edge Functions atualizadas:
- `send-customer-otp-sms` v5;
- `request-customer-email-verification` v3.

### Homologação imediata desta rodada

1. Criar um carrinho depois de um tombstone/limpeza e confirmar persistência nos outros dispositivos.
2. Tentar cadastrar novamente o telefone do Seu Madruga usando `+5562982433802`: deve bloquear antes de enviar SMS e orientar **Use Entrar**.
3. Entrar com `62982433802` e `+5562982433802`: ambos devem resolver a mesma conta.
4. Na fidelidade, e-mail não confirmado deve manter **Confirmar participação** indisponível; após a verificação real do e-mail, o cliente deve aceitar regulamento + responsabilidade e então aderir.
5. Sair do programa e confirmar no backend que transações/vouchers/consentimentos de fidelidade foram removidos e que cadastro/pedidos permaneceram.
6. Testar **Confirmar meu e-mail com a loja** novamente; se ainda falhar, a mensagem deve indicar precisamente qual classe de Secret não foi vista pela Edge Function.

---

## Autoridade técnica

Este arquivo é o resumo executivo canônico. Repositório, migrations efetivamente aplicadas no Supabase, Edge Functions publicadas e deployments Vercel são a autoridade do estado técnico implantado.
