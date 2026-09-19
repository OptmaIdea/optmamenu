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

A implementação de envio aceita **Resend ou Brevo**. O caminho primário continua sendo a Edge Function do Supabase; quando o runtime das Edge Functions não enxerga as credenciais do provedor/remetente, o portal tenta automaticamente um fallback server-side na Vercel (`/api/customer-email-verification`), reutilizando a sessão autenticada do cliente e RPCs customer-scoped.

Aliases de configuração reconhecidos:
- provedor: `RESEND_API_KEY`, `RESEND_KEY`, `BREVO_API_KEY` ou `SENDINBLUE_API_KEY`;
- remetente: `CUSTOMER_EMAIL_FROM`, `RESEND_FROM_EMAIL`, `BREVO_SENDER_EMAIL` ou `EMAIL_FROM`.

Nenhuma confirmação é simulada: o desafio só é considerado enviado quando um provedor real aceita a mensagem.

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
- **Fidelidade:** a adesão agora é atômica pelo RPC `join_customer_self_loyalty_safe`; exige CPF, data de nascimento, e-mail válido **e confirmado**, aceite do regulamento e uma declaração explícita de responsabilidade pela veracidade dos dados. Após a homologação real, foi acrescentada **idade mínima de 18 anos**, validada no frontend e protegida também no banco por trigger/RPC.
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

## Ajustes de homologação — 19/09/2026 (terceira rodada)

Os testes posteriores mostraram três diferenças entre o comportamento esperado e o implantado, tratadas nesta rodada:

- **Carrinho persistente não aceitava alteração:** a revisão inteira resolveu a criação pós-limpeza, mas escritas concorrentes do mesmo navegador/outro dispositivo ainda podiam competir. O frontend agora serializa gravações em fila, compara somente a intenção do carrinho (produto + quantidade + contexto de atendimento) e não deixa polling remoto sobrescrever uma edição local pendente. Em caso de `stale`, a alteração local é rebaseada sobre a revisão mais recente em vez de restaurar silenciosamente o snapshot antigo. Atualizações de catálogo/preço não incrementam mais a revisão do carrinho sem mudança real de itens. O backend também preserva tombstone quando o estado salvo estiver vazio.
- **Telefone já cadastrado:** o preflight já bloqueava o envio no banco, mas a Edge Function respondia HTTP 409 e o cliente Supabase convertia isso em erro genérico. A Edge Function `send-customer-otp-sms` v6 passou a devolver conflito de fluxo como `200 + ok=false`, preservando a mensagem “Este telefone já possui cadastro nesta loja. Use a opção Entrar.” e evitando ruído 409 no console; nenhum SMS é emitido.
- **Verificação de e-mail:** o runtime das Edge Functions confirmou que não enxerga chave/remetente configurados. Foi criado um fallback server-side na Vercel, que gera o desafio por RPC autenticada, envia por Resend/Brevo usando secrets da Vercel e mantém a confirmação final na Edge Function já existente.
- **Fidelidade / menor de idade:** cadastro com menos de 18 anos passa a ser impedimento imediato e independente do estado do e-mail. O Seu Madruga de teste (`20/09/2009`) retorna `loyalty_age_restricted` diretamente no backend. A proteção existe tanto no RPC quanto em trigger sobre `customers.loyalty_opt_in`.

Migrations:
- `20260919163857_customer_cart_serialized_edits`;
- `20260919163935_loyalty_minimum_age_18_guard`;
- `20260919164043_customer_email_verification_vercel_fallback`.

### Homologação imediata desta rodada

1. Alterar quantidade/adicionar/remover item no carrinho já existente no mesmo dispositivo e confirmar que o estado novo permanece.
2. Repetir a alteração em outro dispositivo e confirmar convergência sem retorno ao snapshot anterior.
3. Tentar cadastrar `+5562982433802`: deve aparecer “telefone já possui cadastro / use Entrar” sem console 409 e sem SMS.
4. Com data `20/09/2009`, abrir Fidelidade: deve aparecer o bloqueio de idade mínima mesmo com e-mail ainda não confirmado.
5. Acionar **Confirmar meu e-mail com a loja**: Edge Function tenta primeiro; se faltarem secrets no runtime Supabase, o envio segue automaticamente pelo endpoint Vercel.

---

## Configuração simplificada de e-mail transacional — Brevo

O envio de confirmação de e-mail foi padronizado para exigir apenas duas variáveis privadas no runtime Vercel:

- `BREVO_API_KEY` — chave API transacional do Brevo;
- `CUSTOMER_EMAIL_FROM` — remetente verificado, atualmente recomendado como `naoresponda@auth.optmamenu.com.br`.

Para homologação, as duas variáveis precisam estar disponíveis no ambiente **Preview** da branch `agent/homologacao-geral-20260820`; para produção, também em **Production**. Após inclusão/alteração das variáveis, é necessário novo deployment/redeploy.

O template de confirmação agora é montado dinamicamente por loja:
- usa `stores.logo_url` quando houver;
- nome e assunto são da loja;
- identifica-se como e-mail automático de sistema;
- informa que o endereço será usado no contexto da relação com a loja para conta, segurança, pedidos, atendimento e funcionalidades escolhidas;
- informa que OptmaMenu/OptmaIdea atua como plataforma tecnológica e não usa o endereço para marketing próprio sem autorização específica;
- rodapé opcional aponta para OptmaMenu e OptmaIdea.

A confirmação permanece transacional. Preferências de marketing por e-mail são consentimentos separados.

Migration:
- `20260919171400_email_verification_include_store_brand`.

Edge Function:
- `request-customer-email-verification` v4.

---

## Ajustes de homologação — 19/09/2026 (quarta rodada)

### Pedidos orientados por evento operacional

A tela administrativa de Pedidos deixou de usar somente `created_at` como referência de ordenação operacional.

Foi adicionada a coluna `orders.status_changed_at`, mantida automaticamente por trigger sempre que o status muda. O RPC `get_admin_orders_safe` passou a ordenar por `status_changed_at desc`, com `created_at` como desempate.

Consequências práticas:
- um pedido antigo enviado para entrega agora sobe imediatamente na lista;
- o card mostra o evento atual (por exemplo **Saiu para entrega**) e a data/hora em que esse status foi assumido;
- a data original de criação continua preservada e visível nos detalhes;
- filtro de período passa a considerar a última movimentação do pedido;
- busca textual foi adicionada para código do pedido, cliente, telefone ou nome de item;
- o universo administrativo de busca foi ampliado de 200 para 500 pedidos.

Migration:
- `20260919181836_orders_status_activity_sort`.

### Histórico de consumo do cliente

A área **Minha conta** ganhou a subtela **Meu consumo**. Ela consolida produtos de pedidos não cancelados e mostra:
- produto;
- quantidade acumulada;
- número de pedidos;
- total histórico pago pelo produto;
- última compra;
- cada ocorrência com pedido, data/hora, status, quantidade, preço unitário e total da linha.

A avaliação de produto pelo cliente em escala **0 a 5 estrelas** foi registrada como próxima evolução desta subtela. A futura estrutura deverá preservar vínculo entre cliente, produto, pedido/consumo elegível, nota, comentário opcional e moderação da loja, evitando avaliações sem compra quando a regra comercial exigir compra verificada.

### E-mail transacional / Brevo

Os testes reais confirmaram que Vercel enxerga `BREVO_API_KEY`, `CUSTOMER_EMAIL_FROM` e a configuração do Supabase, mas o Brevo está recusando a entrega. O endpoint agora:
- registra nos logs somente status/código/mensagem sanitizados do provedor;
- devolve diagnóstico seguro para a UI quando o Brevo rejeitar o envio;
- não expõe chave/API secret;
- permite nova tentativa imediata depois de uma falha de entrega, mantendo limite horário amplo contra abuso.

Migration:
- `20260919181906_email_verification_retry_after_delivery_failure`.

### Login por senha

Falha `invalid_credentials`/senha inválida agora é extraída também de respostas HTTP não-2xx da Edge Function e apresentada como **Senha inválida**, em vez do genérico **Não foi possível entrar agora**.

### Pendência ainda sob homologação

O carrinho compartilhado continua com uma pendência reportada na alteração de quantidade/remoção após criação do carrinho. Criação e limpeza multi-dispositivo foram validadas; edição incremental ainda não deve ser considerada homologada até nova bateria específica.

---

## Autoridade técnica

Este arquivo é o resumo executivo canônico. Repositório, migrations efetivamente aplicadas no Supabase, Edge Functions publicadas e deployments Vercel são a autoridade do estado técnico implantado.
