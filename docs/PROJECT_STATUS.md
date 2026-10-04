# Status do Projeto OptmaMenu

> **Última atualização:** 19/09/2026  
> **Branch de homologação:** `agent/homologacao-geral-20260820`  
> **Frontend:** React + TypeScript / Vercel  
> **Backend:** Supabase/Postgres (`lgkkfmqzaorrutuoqeax`)

---

## Estado executivo

A frente ativa continua sendo a homologação ponta a ponta de **cliente autenticado → carrinho compartilhado → pedido → reserva/estoque → fidelidade**. Os testes reais em desktop, tablet e celular de 19/09/2026 fecharam os defeitos mais importantes de sessão, expiração, histórico de pedidos, carrinho multi-dispositivo e fidelidade.

O login que anteriormente podia levar a **Loja não encontrada** foi validado manualmente como resolvido. O warning de preload do logo também deixou de ocorrer.

## Fechamento de Clientes e Portal da Loja Pública — 19/09/2026

A frente foi retomada sem reabrir a análise histórica, com baseline conferido diretamente em GitHub, Vercel e Supabase.

### Carrinho autenticado compartilhado

O serviço do frontend passou a usar efetivamente os RPCs de rascunho do servidor durante a sessão autenticada:

- hidrata pelo `get_customer_self_cart_draft_safe`;
- grava mudanças com `save_customer_self_cart_draft_safe` e `syncBaseRevision`;
- serializa salvamentos locais e trata resposta `stale`;
- consulta o estado remoto periodicamente enquanto a sessão está ativa;
- propaga alteração de quantidade e limpeza/exclusão de itens entre dispositivos;
- mantém o tombstone remoto para impedir ressurreição por dispositivo atrasado;
- sanitiza o rascunho remoto contra catálogo e estoque atuais;
- força a última sincronização antes do logout.

Cobertura adicionada em `customerCartPersistence.test.ts`, incluindo quantidade remota, exclusão remota e tombstone. O primeiro teste revelou um estado de catálogo residual; o teste foi corrigido e a falha TypeScript subsequente no logout foi removida. O workflow Verify passou integralmente no commit `6979229b705d17b48383f4debc7bfac0a66b7178`.

### Direitos do titular

Foi criada uma base específica para direitos de privacidade do cliente, sem abrir RPC destrutivo ao navegador:

- `customer_account_deletion_audit`: trilha mínima de solicitação/execução, com RLS e sem acesso direto de `anon`/`authenticated`;
- `export_customer_self_data_safe()`: exportação autenticada de cadastro, endereços, contatos, consentimentos, pedidos/itens, notificações, carrinho e metadados de segurança sem hashes/tokens;
- o Portal ganhou **Exportar meus dados**, gerando JSON local no navegador;
- `request_customer_self_account_deletion_safe(password, otp)`: registra a solicitação apenas após senha atual + OTP exclusivo `account_delete`;
- `get_customer_self_account_deletion_request_safe()`: permite ao titular acompanhar a existência do pedido;
- `send-customer-otp-sms` v9 exige sessão cliente válida, identidade não revogada e dispositivo confiável para OTP de exclusão; login/cadastro continuam com o comportamento público anterior;
- o Portal apresenta a área de exclusão separada da troca de senha e informa que registros legalmente necessários podem ser preservados isoladamente.

A função de execução `delete_customer_account_service_safe` existe somente para `service_role`: bloqueia pedidos ainda ativos, anonimiza/desvincula pedidos e lançamentos comerciais e remove registros pessoais sujeitos a cascade. Ela **não é executável por `anon` nem por `authenticated`**. A publicação de um executor administrativo/Edge para a etapa destrutiva continua pendente antes de considerar a exclusão automática encerrada.

Migrations aplicadas nesta rodada:

- `20260919214504_customer_account_export_and_deletion`;
- `20260919214824_customer_account_deletion_request_state`;
- `20260919215432_customer_self_deletion_request_strong_reauth`;
- `20260919215446_customer_self_deletion_request_status`.

### Confirmação de e-mail

O fluxo principal permanece correto: a Edge Function confirma o token e responde com HTTP 303 para a slug, sem servir HTML diretamente. O runtime observado avançou para `confirm-customer-email` v7. O último desafio real auditado foi consumido e o envio inicial foi aceito pelo provedor; o aviso transacional pós-confirmação daquele teste registrou `delivery_failed`. A v7 agora grava também status/código/mensagem sanitizada do provedor em `metadata.confirmed_notification` para o próximo teste real, sem transformar a falha desse segundo e-mail em falha da confirmação principal.

### Limites desta rodada

Fidelidade e OptmaPay não foram avançados por esta frente. Permanecem fora do escopo deste fechamento.

---

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

## Ajustes de homologação — 19/09/2026 (quinta rodada)

### Pedidos do cliente por última atividade

A área **Minha conta → Pedidos** passou a consumir e exibir `status_changed_at` do backend. O RPC `get_customer_self_orders_safe` agora:
- retorna `status_changed_at`;
- ordena por última mudança de status, com `created_at` como desempate;
- preserva a data original de criação.

Na interface do cliente, o card mostra o evento atual e a data/hora desse evento (ex.: **Saiu para entrega em ...**) e, quando diferente, mantém **Pedido criado em ...** como referência histórica.

Migration:
- `20260919184000_customer_orders_sort_by_status_activity`.

### Brevo / Preview Vercel

Foi confirmado que os erros 401/502 observados anteriormente vieram do Preview `dpl_2HPE5eNjTnLTDZzE7AE9PaKNvksW`, cuja API do Brevo respondeu `401 unauthorized / Key not found`.

Também foi observado um redeploy posterior em **Production/main** (`dpl_EDowZdG5KnaJ8xCzbrtwMbXYtiaZ`), não no Preview da branch de homologação. Uma nova publicação de Preview foi forçada pela própria branch após a alteração das variáveis.

O runtime agora normaliza a credencial `BREVO_API_KEY` (trim, remoção de aspas acidentais e de prefixo `BREVO_API_KEY=`) antes de enviá-la no header `api-key`.

Preview atual após essa correção:
- commit `a303e4e648ad2eb08e354a8e553310880ab8e938`;
- deploy `dpl_4F6eNoqpZyQnT43owRRYsDPDTNGT`;
- estado validado: READY;
- GitHub Verify: success.

Se esse Preview ainda retornar `401 Key not found`, a causa restante é a credencial configurada no escopo **Preview** da Vercel não corresponder a uma API key ativa reconhecida pelo Brevo; não é ausência da variável no código.

---

## Ajustes de homologação — 19/09/2026 (sexta rodada)

### Confirmação de e-mail: retorno para a própria loja

O link enviado por e-mail deixou de apontar diretamente para a Edge Function de confirmação do Supabase. Novos e-mails passam por `/api/customer-email-confirm` na Vercel:
- a Vercel confirma o token pela Edge Function do Supabase;
- em caso de sucesso, redireciona para `/s/{slug}?emailVerification=success`;
- a loja restaura a sessão do cliente e mostra feedback amigável;
- isso evita a página de HTML bruto observada na homologação.

### Saída da fidelidade validada no backend

Após a saída voluntária do Seu Madruga, a conferência real no Supabase mostrou:
- `loyalty_transactions`: 0;
- `fidelity_vouchers`: 0;
- consentimentos `loyalty_program` / `loyalty_data_responsibility`: 0;
- bloqueios ativos: 0;
- saldo do cliente: 0;
- `loyalty_opt_in=false`.

Cadastro geral, pedidos e dados não exclusivos da fidelidade permanecem.

### Estorno de pontos em cancelamento pós-conclusão

Foi criado o trigger `on_order_cancelled_reverse_loyalty`. Quando um fluxo autorizado mover um pedido de `completed` para `cancelled`, cada transação positiva `type='order'` ligada ao pedido recebe uma transação `type='reversal'` negativa, com `related_transaction_id`, descrição explícita do pedido e atualização do saldo/nível.

Teste transacional com rollback:
- crédito temporário: +42;
- pedido concluído -> cancelado;
- estorno criado: -42;
- saldo final: 0;
- rollback confirmou que nenhum dado de teste permaneceu.

Observação: o cancelamento administrativo normal ainda rejeita pedidos já concluídos; portanto o trigger prepara a integridade para um fluxo específico de pós-venda/estorno, sem alterar silenciosamente estoque/financeiro de uma venda concluída.

Migration:
- `20260919222000_loyalty_cancel_reversal_and_join_event`.

### Bônus de adesão: inconsistência encontrada e isolada

Existiam duas configurações concorrentes:
- programa `Gelipontos`: `enable_join_bonus=true`, `join_bonus_points=15`;
- regra avançada **Bônus de adesão**: 30 pontos, porém cadastrada como `trigger_event='order_completed'`.

A regra avançada estava semanticamente errada e poderia somar o “bônus de adesão” em todo pedido concluído. Ela foi migrada para o novo evento `loyalty_join`, que não participa do cálculo de compras. Um cálculo real de pedido após a correção confirmou que a regra de 30 pontos deixou de entrar na pontuação de `order_completed`.

A concessão de bônus na adesão ainda precisa ser consolidada em uma única fonte na frente específica de Fidelidade. Também ficou registrada a decisão de produto sobre reingresso:
- para oferecer percentual reduzido em reinscrição é necessário reter algum marcador mínimo de participação anterior;
- isso conflita com a política atual de apagar integralmente os dados de fidelidade na saída;
- não será criado marcador oculto sem decisão explícita de retenção/termos.

### Perfil do cliente

O nome informado na criação da conta continua em `nickname`. A tela **Meus dados** passa a exibir explicitamente **Apelido / identificação**, separado de **Nome completo**. Isso preserva o fluxo usado por Crisgeo Louren sem transformar automaticamente apelido em nome civil.

### Fidelidade administrativa — pendência separada

O erro `42501 permission denied for table customers` foi localizado em `ManualPoints.tsx`, que ainda faz `HEAD/GET/UPDATE` diretos em `customers` e leituras diretas em `loyalty_transactions`. Essa tela deve migrar para RPCs seguras store-scoped, assim como os demais módulos atuais.

Por decisão de escopo, a consolidação das configurações de Fidelidade (clientes ativos, regras, bônus de adesão/reentrada, bloqueios por CPF, níveis e benefícios) será tratada em chat próprio após o fechamento desta rodada.

---

## Ajustes de homologação — 19/09/2026 (sétima rodada)

### Confirmação de e-mail em Preview protegido

Foi confirmado em teste real que usar a rota `/api/customer-email-confirm` do Preview da Vercel não é adequado: a proteção do deployment intercepta o link e exibe o login da Vercel antes que a confirmação alcance a aplicação.

Correção aplicada:
- novos e-mails voltam a apontar diretamente para a Edge Function pública `confirm-customer-email` do Supabase;
- a Edge Function foi republicada como versão 2;
- o HTML de confirmação permanece com `Content-Type: text/html`;
- após confirmar, é enviado um segundo e-mail transacional de segurança informando que o endereço foi verificado;
- falha no envio desse segundo e-mail não desfaz a confirmação já concluída.

Commits:
- `70d898cfcfaec5b9ced4292215ede4f5e2361e53` — evita proteção da Vercel na confirmação;
- `3eff95db36fc97c8dd83914351110be40bca297f` — aviso transacional pós-confirmação.

### Navegação de Fidelidade — decisão

A etapa futura terá apenas um item de menu **Fidelidade**. `Fidelidade avançada` deixa de existir como item irmão.

Base canônica: infraestrutura segura da página avançada, incorporando por abas as funções úteis da área legada:
- Visão geral;
- Regras e pontuação;
- Níveis;
- Benefícios e prêmios;
- Clientes participantes;
- Ajustes / extrato;
- Bloqueios e reentrada;
- Termos e privacidade.

A área legada não será mantida como segunda autoridade porque ainda contém acessos diretos a tabelas. Suas funções úteis deverão migrar para RPCs seguras.

### Próximas conversas separadas

Handoff criado:
`docs/HANDOFF_PROXIMAS_FRENTES_CLIENTES_FIDELIDADE_OPTMAPAY_20260919.md`.

Ele separa:
1. fechamento de Clientes / Slug;
2. refinamento moderno, segurança, privacidade, exclusão da conta e análise de JWT;
3. integração OptmaPay ↔ OptmaMenu;
4. futura consolidação da Fidelidade.

### OptmaPay

O repositório `OptmaIdea/optmapay` está acessível e foi analisado. O OptmaMenu já possui provider `optma_sandbox`, intents, events, rotas de recebimento e liquidação interna; a integração futura deve evoluir esse provider em vez de criar um sistema paralelo.

Antes de confiar no OptmaPay como provider externo, ficaram registradas pendências de endurecimento em autenticação das APIs, armazenamento/validação de API keys, HMAC de webhooks, dispatcher server-side, SSRF e idempotência.

### Exclusão de conta do cliente

Antes do fechamento definitivo de Clientes, incluir autoatendimento de exclusão com reautenticação forte, invalidação de sessões e purga/anonimização dos dados não sujeitos a retenção. Dados estritamente necessários por obrigação legal/fiscal/contábil devem ser segregados da conta ativa e mantidos apenas conforme base legal e prazo aplicável.

---

## Ajustes de homologação — 19/09/2026 (oitava rodada)

### Confirmação de e-mail: causa raiz do HTML bruto identificada

O teste real confirmou que a Edge Function do Supabase processava corretamente o token, porém o navegador exibia o HTML como texto. A causa não era encoding nem cabeçalho incorreto: no domínio compartilhado `.supabase.co`, GET de Edge Function com `text/html` é deliberadamente reescrito para `text/plain` pela plataforma quando não há Custom Domain.

Correção arquitetural:
- `confirm-customer-email` não tenta mais servir HTML;
- após validar, confirmar e consumir o token, responde com HTTP 303;
- destino de sucesso/erro: cardápio público canônico em `https://optmamenu.optmaidea.com.br/s/<slug>`;
- parâmetro `emailVerification` informa `success | invalid | used | expired | error`;
- `StoreLayout` já possui tratamento para `emailVerification=success` e feedback ao cliente;
- a função permanece pública apenas para consumir token de confirmação, sem JWT;
- Edge Function publicada como versão 4.

Commits:
- `279adba3f8532814f57682086cd46344f2f00e4f` — redireciona confirmação para loja pública;
- `d1ce3505f27e62776fda6a7c68669718c4cb030a` — registra no challenge o resultado do e-mail transacional pós-confirmação.

### E-mail pós-confirmação

O aviso transacional `E-mail confirmado em <loja>` é disparado pela Edge Function, portanto depende de `BREVO_API_KEY` e `CUSTOMER_EMAIL_FROM` existirem também nos Secrets do runtime Supabase. As variáveis existentes somente na Vercel não ficam disponíveis dentro de Edge Functions do Supabase.

A partir da versão 4, o challenge registra em `metadata.confirmed_notification` somente o estado técnico do aviso (`sent/provider/reason`), sem armazenar a chave do provedor.

---

## Ajustes de homologação — 19/09/2026 (nona rodada)

### Retorno da confirmação de e-mail sem reautenticação automática

O teste com Crisgeo confirmou:
- o token foi consumido e `email_verified=true` foi persistido;
- o redirecionamento caiu no domínio canônico `optmamenu.com.br`;
- esse domínio ainda está publicado a partir de uma versão antiga de produção e tentou usar o RPC legado `customer_login_with_password`, hoje corretamente sem EXECUTE para cliente/anon, produzindo `401 permission denied`.

Correção aplicada:
- a Edge Function passou a usar o parâmetro neutro `emailVerificationResult`, em vez do legado `emailVerification`;
- o parâmetro novo jamais deve iniciar login ou restaurar sessão automaticamente;
- a branch atual reconhece `emailVerificationResult` apenas para feedback amigável;
- não foi reaberto EXECUTE do RPC legado `customer_login_with_password`, preservando o hardening;
- confirmação de e-mail não autentica o cliente — apenas confirma o endereço;
- Edge Function `confirm-customer-email` publicada como versão 7.

### Aviso transacional pós-confirmação

A última confirmação real de Crisgeo registrou:
- confirmação principal: sucesso;
- envio inicial de confirmação: Brevo aceitou e gerou `provider_message_id`;
- aviso `E-mail confirmado`: `confirmed_notification.sent=false`;
- motivo registrado: `delivery_failed`.

Portanto, a ausência do segundo e-mail NÃO foi causada pelo redirecionamento/login do navegador. O runtime Supabase encontrou provider/remetente, chamou o provedor e recebeu rejeição HTTP.

A função agora registra, em nova tentativa, somente diagnóstico sanitizado:
- `provider`;
- `providerStatus`;
- `providerCode`;
- `providerMessage`;
- sem chave/secret.

Isso permitirá fechar a causa do próximo teste sem depender do console do navegador.

### Autenticação de colaboradores

A hipótese de separar autenticação de owners/admin/managers sensíveis de operadores comuns por JWT próprio foi apenas registrada como evolução futura. Não faz parte do fechamento atual de Clientes/Slug e pode ser retomada em versão posterior, inclusive após operação com loja parceira.

---

## Ajustes de homologação — 19/09/2026 (décima rodada)

### Segundo e-mail pós-confirmação: causa exata encontrada

No challenge mais recente de Crisgeo, a confirmação principal foi concluída e o primeiro e-mail foi aceito pelo Brevo. O segundo e-mail transacional falhou com resposta real do provedor:

- provider: `brevo`
- HTTP: `400`
- code: `invalid_parameter`
- message: `valid sender email required`

A falha não estava ligada ao redirecionamento, ao login ou à confirmação do token.

A Edge Function foi corrigida para normalizar o remetente vindo dos Secrets do Supabase, inclusive tolerando:
- aspas acidentais;
- prefixos como `CUSTOMER_EMAIL_FROM=`;
- formato `Nome <email@dominio>`;
- espaços/quebras de linha.

Versão publicada:
- `confirm-customer-email` v8 ACTIVE.

Commit:
- `390aaee30cab8716c1d9df130bd0afcff21b1fa3` — normaliza remetente do aviso pós-confirmação.

### Estado success / used e erro 401

O comportamento do token está correto:
- primeiro clique: `emailVerificationResult=success`;
- clique posterior no mesmo link: `emailVerificationResult=used`.

O `401 permission denied for function customer_login_with_password` observado depois ocorreu ao tentar autenticar no domínio `optmamenu.com.br`, que ainda está em uma versão antiga de produção e usa o RPC legado direto. Esse RPC permanece intencionalmente sem EXECUTE público.

A correção da homologação NÃO reabre essa permissão. O fluxo atual de cliente usa a Edge Function `customer-auth-session` e a sessão sintética controlada. A divergência será eliminada quando a versão homologada substituir a versão antiga de produção; não promover a branch apenas para mascarar este teste.

---

## Fidelidade unificada — 19/09/2026

A frente administrativa de Fidelidade passou a ter uma única autoridade de interface em `/admin/loyalty`. O item irmão **Fidelidade avançada** foi removido do menu e a rota legada `/admin/loyalty/advanced` redireciona para a área canônica.

A nova área reúne oito abas:
- Visão geral;
- Regras e pontuação;
- Níveis;
- Benefícios e prêmios;
- Clientes participantes;
- Ajustes / extrato;
- Bloqueios e reentrada;
- Termos e privacidade.

### Segurança administrativa

A interface canônica não acessa diretamente `customers` nem `loyalty_transactions`. O componente legado `ManualPoints.tsx` também foi retirado desse padrão inseguro, e o componente de fidelidade do portal do cliente deixou de ler `loyalty_transactions` ou alterar `customers` diretamente.

Leitura administrativa usa RPCs store-scoped com `auth.uid()` e `loyalty.view`/`loyalty.manage`; escrita exige `loyalty.manage` ou owner. Entre os RPCs canônicos estão:
- `get_loyalty_advanced_settings_safe`;
- `get_loyalty_customers_safe`;
- `get_admin_loyalty_transactions_safe`;
- `get_loyalty_blocks_and_reentry_safe`;
- `update_loyalty_program_safe`;
- `upsert_loyalty_tier_safe` / `delete_loyalty_tier_safe`;
- `update_loyalty_category_rule_safe`;
- `adjust_customer_loyalty_points_safe`;
- `admin_set_customer_loyalty_membership_safe`;
- `upsert_loyalty_point_rule_safe`;
- `upsert_customer_benefit_rule_safe`;
- `upsert_loyalty_reward_safe` / `delete_loyalty_reward_safe`.

Tabelas centrais da fidelidade estão com RLS habilitado e forçado. Escritas diretas de `anon`/`authenticated` em programas, níveis, prêmios, vouchers, regras, transações e benefícios foram revogadas; mutações administrativas passam pelas RPCs.

### Adesão, saída, bloqueio e reentrada

A adesão do cliente continua voluntária e exige regulamento, responsabilidade pelos dados, CPF quando aplicável ao fluxo, data de nascimento, idade mínima de 18 anos e e-mail confirmado. O portal usa `join_customer_self_loyalty_safe`; o extrato próprio usa `get_customer_self_loyalty_transactions_safe`.

A saída voluntária ou remoção administrativa executa o purge dos dados exclusivos da fidelidade. Bloqueio por CPF e desbloqueio administrativo permanecem auditáveis.

Foi implementada política configurável de reentrada:
- primeira adesão: bônus integral configurado em `join_bonus_points`;
- reentrada: `none`, `percentage` ou `fixed`;
- percentual inicial: **30%**;
- carência configurável em dias;
- limite configurável de reentradas bonificadas;
- auditoria da regra aplicada e do bônus concedido;
- explicação ao cliente da regra efetivamente aplicada.

Para impedir abuso do ciclo entrar → ganhar bônus → sair → entrar, o purge preserva apenas o marcador mínimo de auditoria/antifraude em `loyalty_participation_audit` e `loyalty_membership_audit_events`. Esses registros armazenam hash de CPF por loja, últimos quatro dígitos para contexto, datas/contadores de participação e bônus e a regra aplicada. A finalidade declarada é prevenção de abuso, segurança e auditoria do programa; a retenção é configurável por `loyalty_audit_retention_months` (padrão atual: 60 meses).

No Gelipontos da Gelinhares, o estado implantado está em:
- bônus normal de primeira adesão: **15 pontos**;
- reentrada: **30% do bônus original**;
- carência: **30 dias**;
- máximo: **1 reentrada bonificada**;
- retenção da auditoria: **60 meses**.

### Pontuação, cancelamentos e devoluções

O pedido só pontua quando chega a `completed`. O extrato é imutável: cancelamentos posteriores e devoluções não apagam lançamentos anteriores.

A rotina `sync_order_loyalty_refund_reversal_internal`:
- faz estorno integral quando um pedido concluído é posteriormente cancelado;
- calcula estorno proporcional em devolução parcial;
- cria lançamento `reversal` negativo vinculado à transação original;
- cria lançamento corretivo `adjustment` se um recálculo devolver pontos;
- recalcula saldo e nível sem permitir saldo negativo;
- gera notificação ao cliente.

O trigger `trg_sale_adjustments_sync_loyalty` acompanha devoluções/estornos concluídos e `on_order_cancelled_reverse_loyalty` cobre `completed → cancelled`.

### Migrations desta consolidação

- `20260919215305_loyalty_reentry_audit_core.sql`;
- `20260919215626_loyalty_admin_unified_safe_rpcs.sql`;
- `20260919215652_loyalty_refunds_rls_hardening.sql`.

As três migrations estão aplicadas no projeto Supabase `lgkkfmqzaorrutuoqeax` e versionadas no GitHub.

---

## Ajustes de homologação — 20/09/2026 (fechamento da exclusão de conta)

### E-mail pós-confirmação

O segundo e-mail transacional de confirmação passou a ser recebido com sucesso após a Edge Function adotar o remetente verificado `naoresponda@auth.optmamenu.com.br` como fallback seguro quando o Secret do Supabase estiver mal formatado.

Edge Function:
- `confirm-customer-email` v9 ACTIVE.

Commit:
- `214894776f142344ef9e4548a6a7b05fa9455909`.

### Exportação e exclusão do titular

Validações reais concluídas:
- exportação dos dados do titular: sucesso;
- solicitação de exclusão: senha correta + OTP SMS exigidos e validados;
- foi identificado que a primeira implementação registrava a solicitação como `pending`, mas não havia processador automático;
- o executor `delete_customer_account_service_safe` também tentava inserir uma segunda linha `processing`, conflitando com o índice único da solicitação pendente.

Correções:
- migration `20260920002129_customer_account_deletion_processor_reuses_request`;
- o executor agora reutiliza a própria solicitação `pending` e a move para `processing -> executed`;
- Edge Function `process-customer-account-deletion` v1 ACTIVE;
- o portal chama o processador após a reautenticação forte e encerra a sessão em caso de sucesso;
- pedidos em andamento bloqueiam a exclusão definitiva com mensagem específica;
- o usuário sintético do Supabase Auth é revogado ao final.

Teste real com Crisgeo:
- solicitação: `729ebfd2-341b-484f-bc34-63ed18a8c2a2`;
- status final: `executed`;
- customer removido: sim;
- credenciais, endereços, carrinho, consentimentos, trusted devices e challenges: 0 registros remanescentes;
- usuário sintético em `auth.users`: removido;
- telefone voltou a ficar disponível para novo cadastro;
- pedidos diretamente vinculados ao customer: 0;
- trilha mínima de auditoria preservada sem PII direta;
- evidência legal retida: aceite de Termos de Uso e Política de Privacidade;
- neste cliente de teste não havia pedidos nem lançamentos financeiros a anonimizar/reter.

Commits:
- `a536aacbd0c1b87682a8ffd01db6699f908cb400` — reutiliza solicitação pendente;
- `31265fc880c5d6078b00566091d75b3fa22b5699` — Edge Function de processamento;
- `0b2182036670266363af180aa6e41c928e890b49` — service frontend;
- `3251a7c5dd1b3d1c69396f10e9df63abd844e8c1` — UX e logout após exclusão.

Todos os GitHub Actions desses commits concluíram com `success`.

### Reconciliação de migration da troca de telefone

A migration aplicada no Supabase `20260919220128_customer_self_phone_change_strong_otp`, que inicialmente não aparecia versionada no Git, foi reconciliada pela frente de Clientes antes deste fechamento.

Commits:
- `70931f69890446468fb57d5512d02e3af3c96077`;
- `ce1c6145e323e393bb706796196a43db0f702a5f`.

---

## Autoridade técnica

Este arquivo é o resumo executivo canônico. Repositório, migrations efetivamente aplicadas no Supabase, Edge Functions publicadas e deployments Vercel são a autoridade do estado técnico implantado.


---

## Validação final da frente Fidelidade — 19/09/2026

Fechamento técnico da frente específica de Fidelidade, sem reabrir Clientes ou OptmaPay.

Validações executadas no estado implantado:

- GitHub/Vercel/Supabase reconferidos;
- área administrativa canônica mantida somente em `/admin/loyalty`;
- `/admin/loyalty/advanced` permanece apenas como compatibilidade/redirecionamento, sem segunda autoridade;
- componentes administrativos legados de pontos deixaram de consultar `customers` e `loyalty_transactions` diretamente;
- RPCs administrativas verificadas como `SECURITY DEFINER`, store-scoped e com `auth.uid()` + `loyalty.view`/`loyalty.manage` conforme leitura/escrita;
- tabelas centrais de fidelidade verificadas com RLS habilitado; programas, níveis, regras, prêmios, vouchers, benefícios e transações permanecem com RLS forçado;
- migrations `20260919215305_loyalty_reentry_audit_core`, `20260919215626_loyalty_admin_unified_safe_rpcs` e `20260919215652_loyalty_refunds_rls_hardening` confirmadas no Supabase;
- triggers `on_order_completed_loyalty`, `on_order_cancelled_reverse_loyalty` e `trg_sale_adjustments_sync_loyalty` confirmados no banco;
- configuração do programa Gelipontos conferida: bônus inicial 15 pontos, reentrada em 30%, carência 30 dias, máximo de 1 reentrada bonificada e retenção de auditoria de 60 meses;
- Security Advisor revisado após a consolidação. As tabelas de auditoria da fidelidade aparecem como “RLS sem policy” por desenho, pois são acessadas apenas pelas RPCs `SECURITY DEFINER`; nenhuma nova exposição anônima específica da frente de Fidelidade foi introduzida.

A frente está pronta para homologação funcional do lojista nas oito abas e para testes reais de adesão/reentrada/cancelamento, sem reintroduzir acesso direto às tabelas administrativas.

---

## Reconciliação Clientes/Slug — 20/09/2026

A migration `20260919220128_customer_self_phone_change_strong_otp` já constava como aplicada no Supabase, mas o arquivo SQL correspondente não estava versionado na branch de homologação. A divergência foi reconciliada sem reaplicar a migration no banco.

O arquivo versionado reproduz o estado implantado da RPC `change_customer_self_phone_safe(text,text)`:
- execução restrita a sessão autenticada de cliente;
- OTP de uso único vinculado ao propósito `phone_change` e ao novo número;
- bloqueio quando o novo telefone já pertence a outro cliente ativo da mesma loja;
- limite e consumo atômico das tentativas do OTP;
- atualização do telefone passando pelos triggers existentes de normalização e sincronização de contatos;
- revogação dos dispositivos confiáveis após a troca, exigindo novo login;
- `EXECUTE` negado para `public`/`anon` e permitido para `authenticated`/`service_role`.

A reconciliação é apenas de versionamento/reprodutibilidade do schema: o Supabase já possuía a migration aplicada e a função ativa antes deste commit.



---

## Fechamento Clientes/Slug — exclusão auditável e troca segura de telefone — 20/09/2026

### Exclusão de conta no administrativo

A exclusão solicitada pelo titular continua sendo processada automaticamente após senha + OTP SMS quando não existem pedidos em andamento. Não existe aprovação manual prévia do lojista: o pedido do titular é uma solicitação de privacidade e o bloqueio operacional ocorre apenas quando há vínculos que impedem a execução imediata.

Para dar rastreabilidade e tratamento das exceções:
- migration `20260920004310_customer_admin_deletion_history_safe` aplicada e versionada;
- nova RPC `get_customer_account_deletion_history_safe(uuid,uuid,integer)`;
- `anon` não possui EXECUTE; `authenticated` e `service_role` possuem EXECUTE, com autorização interna por owner/`customers.view`/`customers.manage`;
- `/admin/customers?tab=history` agora reúne **Solicitações e exclusões de conta** e **Histórico de fusões**;
- o histórico administrativo expõe somente referência técnica, status, datas e resumo sanitizado da execução; não reexibe PII apagada nem a evidência legal retida;
- solicitações `pending`/`processing` podem ser reprocessadas por usuário com `customers.manage`;
- `process-customer-account-deletion` v2 ACTIVE aceita o modo administrativo `admin_retry`, valida owner/`customers.manage` com o JWT do colaborador e só então usa o executor service-role;
- se ainda houver pedidos em andamento, a exclusão permanece bloqueada e o administrador recebe mensagem específica.

O cadastro de teste `359dbb02-7adb-4ec5-8c1d-6ad4509dc397` foi confirmado como removido, enquanto a auditoria `729ebfd2-341b-484f-bc34-63ed18a8c2a2` permanece com status `executed`. A URL antiga da Vida do Cliente agora mostra um estado amigável **Conta excluída a pedido do titular** e direciona para o histórico, em vez de exibir `customer_not_found`.

Após uma exclusão concluída, tentativa de login continua retornando HTTP 401 por desenho porque a identidade sintética foi revogada. A mensagem do frontend foi alterada para a forma não enumerável e mais explicativa: telefone ou senha inválidos, com orientação para novo cadastro quando a conta tiver sido excluída.

### Troca de telefone do próprio cliente

A migration `20260919220128_customer_self_phone_change_strong_otp` permanece como autoridade do banco e o fluxo de interface foi concluído:
- o portal mostra **Alterar telefone** junto ao celular confirmado;
- o cliente informa o novo número e recebe OTP com propósito `phone_change`;
- o envio do OTP de troca exige sessão autenticada e dispositivo confiável;
- a proteção `phone_change` já estava ativa na Edge Function `send-customer-otp-sms` v11 e foi reconciliada no GitHub;
- a confirmação chama `change_customer_self_phone_safe`;
- número inválido, número já usado, OTP inválido/expirado e bloqueio por tentativas recebem mensagens amigáveis;
- após troca efetiva, todos os dispositivos confiáveis são revogados pelo banco e o portal encerra a sessão, exigindo novo login com o número novo;
- o carrinho autenticado é sincronizado antes do logout de segurança.

Nenhuma alteração desta rodada avançou regras de Fidelidade ou OptmaPay.


---

## Homologação Clientes/Slug — 27/09/2026

### Testes reais aprovados

Foram validados em homologação:
- abertura da URL antiga de cliente excluído com estado amigável, sem `customer_not_found`;
- exclusão registrada corretamente no histórico administrativo;
- tentativa de login com número excluído retorna mensagem neutra/orientativa, sem enumeração de dados;
- tentativa de cadastro com telefone já ativo é bloqueada antes do SMS, sem expor identidade;
- telefone anteriormente excluído pode ser cadastrado novamente;
- link público de acompanhamento do pedido permanece funcional;
- atualização de status do pedido no portal do cliente ocorre praticamente em tempo real;
- alteração para **Pronto para retirada** também refletiu praticamente em tempo real;
- cancelamento administrativo refletiu automaticamente no portal do cliente;
- confirmação de e-mail e e-mail transacional de confirmação funcionaram no teste real.

Os testes de troca de telefone e cenários de OTP/SMS permanecem **pendentes de homologação manual**, por indisponibilidade física do aparelho usado nos testes. Não há falha técnica conhecida registrada nesses fluxos.

### Carrinho antes do login

O teste revelou que itens adicionados anonimamente antes do login eram descartados quando a sessão autenticada era ativada.

Correção:
- o carrinho anônimo da mesma loja é preservado;
- ao autenticar, ele é mesclado ao carrinho persistido do cliente;
- itens iguais somam quantidades, sempre reconciliados com catálogo/estoque atuais;
- cliente sem carrinho anterior passa a adotar o carrinho anônimo como seu rascunho autenticado;
- testes automatizados foram atualizados para cobrir os dois cenários.

Commits:
- `4cef75a7778e1c207f533836dd7ada2db52d78ff`;
- `cdd301ef5cadb4b3f0efbfa0f2e055cb699bdf71`.

### Pedidos e Meu consumo

O portal do cliente passou a oferecer:
- filtros de pedidos por **Em andamento**, **Concluídos**, **Cancelados** e **Expirados**;
- filtro por **Retirada** ou **Entrega**;
- busca por código do pedido ou nome do item;
- em **Meu consumo**, somente pedidos efetivamente `completed` entram no resumo;
- filtro de consumo por retirada/entrega;
- busca por produto.

Commit principal:
- `629f7ef308a2d23f57829f2bbf4ee823c18ac7e0`.

### Expiração de retirada não paga

O caso real testado em 27/09 mostrou que o pedido tinha:
- fim da reserva em **19:53:19**;
- carência operacional até **19:58:19**;
- cancelamento manual realizado às **19:55:37**, antes do momento em que o cron poderia cancelar automaticamente.

O cron `cancel-expired-orders-every-minute` foi conferido ativo e executando com sucesso a cada minuto. Portanto, a tela mostrava **Expirado** durante a carência, o que induzia a entender que o cancelamento automático já deveria ter ocorrido.

Correções:
- no administrativo, após acabar a reserva e durante a carência, a tela mostra **Prazo encerrado · cancela em Xm Ys**;
- após a carência e antes da próxima execução do cron, mostra **Expiração em processamento**;
- cancelamento automático continua usando `status=cancelled` com razão técnica `reservation_expired`, sem criar um novo estado físico no enum;
- para o cliente, a RPC de pedidos agora devolve um `status_reason` sanitizado, permitindo apresentar **Expirado** separadamente de **Cancelado**;
- pedido pronto de retirada, não pago, também informa o horário limite de retirada no portal;
- quando a expiração automática chegar em tempo real, o toast orienta que o pedido não está mais disponível e que um novo pedido pode ser feito.

Migration aplicada e versionada:
- `20260927201354_customer_order_expiration_context.sql`.

Commits:
- `6b7437d488ed56d9bc9084e9f11f3635d814c605`;
- `0288967770bbee7c02b18d63882a374e9a2da162`;
- `debf5f0939799dbb16dc4170c8ee639ba941ca72`.

### Pendências funcionais desta frente

Ainda precisam de desenho/implementação específica:
- alteração de modalidade **Retirada ↔ Delivery**, com reroteamento atômico de estoque, recálculo de frete/mínimo/pagamento e ajuste financeiro quando já houver pagamento;
- cancelamento solicitado pelo próprio cliente, separando cancelamento pré-conclusão de devolução/estorno pós-conclusão;
- envio externo automático da comunicação de expiração por canal; o template assistido `order_expired` já existe, mas o portal em tempo real é a comunicação automática atualmente disponível;
- homologação manual dos fluxos dependentes de OTP/SMS.

A sugestão de mensagens de boas-vindas e movimentações do programa de fidelidade foi mantida fora desta frente para ser tratada na frente específica de Fidelidade.


---

## Fechamento complementar Clientes/Slug e refinamentos de Fidelidade — 27/09/2026

### Homologações adicionais aprovadas

O ciclo de expiração de pedido **Retirada + pagamento na retirada** foi validado de ponta a ponta em homologação:
- contador normal;
- destaque vermelho nos minutos finais;
- estado **Prazo encerrado · cancela em Xm Ys** durante a carência;
- estado **Expiração em processamento** até a execução do cron;
- cancelamento automático;
- atualização em tempo real no portal como **Expirado · Retirada**;
- mensagem de pedido aceito informa o horário limite;
- aviso de pronto mantém o limite de retirada;
- finalização refletida corretamente;
- console limpo no teste.

Também foi validado **Retirada + pagamento antecipado**:
- sem timer de expiração;
- confirmação do pagamento refletida corretamente;
- aviso de pronto correto;
- conclusão do pedido sem regressão.

Troca de telefone também passou em teste real:
- telefone antigo deixa de autenticar;
- troca exige OTP;
- primeiro acesso com o número novo exige novo OTP/dispositivo confiável.

Ficam pendentes apenas testes de borda de OTP, como código inválido/expirado e bloqueio por tentativas.

### Meu consumo ligado ao catálogo

A área **Meu consumo** passou a:
- mostrar miniatura da imagem principal do produto quando ele ainda está disponível no catálogo;
- transformar o nome/miniatura em acesso ao card atual do produto;
- abrir o modal real do produto por deep-link `?product=<uuid>`;
- preservar rota de mesa quando o contexto for QR/mesa;
- renomear **Ver quando comprei** para **Pedidos**;
- manter o histórico de compra mesmo quando o produto já não existe no catálogo, porém sem link enganoso.

Commits:
- `24d0405595d5726e7c39c0ef54915e5c39052159`;
- `e3cad07df5deb8282933f0819bf70fe591f8c1d5`.

### Preferências de comunicação da fidelidade

Foi adicionada uma preferência auditável **Web/App**:
- migration live/versionada `20260927211607_customer_loyalty_webapp_consent.sql`;
- `set_customer_self_consent_safe` passa a aceitar `loyalty_webapp`;
- a escolha Web/App não altera o agregado geral `marketing_consent`;
- cliente participante pode alterar ou revogar WhatsApp, e-mail, SMS e Web/App na própria área de Fidelidade;
- Web/App significa manter novidades do programa dentro do portal/app, sem exigir comunicação externa rotineira;
- confirmações essenciais de adesão, saída, pedido e segurança permanecem independentes dessas preferências;
- e-mail só pode ser habilitado quando estiver confirmado.

Commits:
- `c9b0cbee5b1fbeefc782f6d67379fee668029da4`;
- `42c5103f3bf3a8b8c02338eeed6f5d206569c87c`;
- `512373824d3bee61281151c05e90146bffd31adc`;
- `a1b68958b9c715647c8089bb03e8ddb2098ba527`.

### Extrato do cliente

O extrato da Fidelidade agora:
- fica abaixo de **Como funciona**;
- possui **Voltar ao topo**;
- continua com atualização manual de contingência;
- também assina `loyalty_transactions` em Realtime com o JWT isolado do cliente e atualiza saldo + extrato quando houver movimentação.

A tabela já possuía RLS de leitura do próprio cliente e participação no `supabase_realtime`; nenhuma abertura adicional de dados foi necessária.

### UX administrativa da Fidelidade

Remoção, bloqueio e desbloqueio de participantes deixaram de usar `window.prompt/window.confirm`.
Agora usam modal próprio da aplicação, com:
- motivo/observação no próprio modal;
- validação de motivo mínimo no bloqueio;
- confirmação visual consistente;
- resultado por toast padrão Sonner.

Commit:
- `883be4b27a84a144841ca77ebb6bc8ff8f00740b`.

### Regras aceitas para a próxima implementação

**Retirada → Delivery** deve revalidar estoque/local de saída, cobertura, mínimo, frete e pagamento. Se já pago e o novo total for maior, nasce diferença a receber.

**Delivery → Retirada** deve revalidar estoque da loja e remover/recalcular o frete. Se o frete já tiver sido pago, nasce valor auditável a devolver.

Frete excepcional acertado fora da tabela normal deve ser armazenado como **taxa manual daquele pedido**, com valor, motivo, operador e horário, sem alterar a configuração global.

**Cancelamento pelo cliente**:
- antes de retirada/entrega e sem pagamento: cancela e libera a reserva;
- pago e ainda não retirado/despachado: cancelamento depende do fluxo de estorno e confirmação financeira;
- após conclusão: passa a ser devolução/estorno da venda, não simples cancelamento;
- regra futura para itens preparados poderá bloquear cancelamento após início de preparo.

Essas duas frentes permanecem como próximo pacote funcional; não foram marcadas como concluídas nesta rodada.


---

## Ajustes pós-homologação de Clientes/Slug — 27/09/2026

### Retorno de Meu consumo para a área do cliente

Ao abrir um produto a partir de **Meu consumo**, o card do catálogo agora carrega com contexto de retorno. Ao fechar o card, o sistema reabre automaticamente **Minha conta → Meu consumo**, em vez de deixar o cliente na página inicial da loja.

Também foi removido o gatilho inferior **Olá, fulano** da loja pública. O acesso à conta foi movido para o cabeçalho, com ação **Minha conta** para autenticados e **Entrar** para visitantes. O desenho de uma futura barra fixa inferior em estilo app nativo — com Menu, Conta, Carrinho e Contato, substituindo o WhatsApp flutuante — fica reservado para a frente de navegação da loja pública, para ser tratado em conjunto com os atuais CTAs de carrinho e contato e evitar elementos duplicados.

### Fidelidade — Web/App permanente

A preferência **Web/App** deixa de ser revogável:
- é o canal interno permanente da área do cliente;
- a interface mostra **Sempre ativo**, sem checkbox;
- o backend força `loyalty_webapp=granted` mesmo se houver chamada manipulada tentando revogar;
- participantes já ativos foram normalizados para o estado `granted`;
- WhatsApp, e-mail e SMS continuam optativos e revogáveis;
- confirmações essenciais de adesão, saída, pedido e segurança continuam independentes de consentimento promocional.

Migration:
- `20260927214145_customer_loyalty_webapp_required.sql`.

### Auditoria administrativa

O histórico de Segurança foi reforçado:
- `session_heartbeat` passa a ser apresentado como **Sessão ativa**, inclusive para registros antigos cuja `display_action` esteja em inglês;
- remoção administrativa da fidelidade gera **Cliente removido da fidelidade**;
- bloqueio gera **CPF bloqueado na fidelidade**;
- desbloqueio gera **CPF liberado na fidelidade**;
- esses eventos são marcados como sensíveis e preservam ator, cliente alvo, motivo e referência mínima necessária;
- `insert_security_log` agora resolve também o nome amigável do usuário executor para novos eventos quando houver `auth.uid()`;
- alterações de produto já existentes no log passam a exibir o nome do produto e referência técnica curta na interface.

Migration:
- `20260927214328_security_audit_loyalty_membership_actions.sql`.

A regra de negócio sobre o que acontece com pontos/saldo/histórico quando um participante com movimentação é removido administrativamente deve ser respondida e refinada somente na frente específica de **Fidelidade**.

### Regras preservadas para a frente Horários/Pedidos

Ao retomar regras de loja fechada ou próxima do fechamento, preservar as decisões já tomadas:
- loja/cardápio público deve informar claramente **aberta, próxima do fechamento ou fechada** e a condição de atendimento;
- retirada e delivery têm operação distinta e não devem compartilhar automaticamente a mesma regra de expiração;
- pedido de delivery já aceito não expira automaticamente apenas porque o horário comercial terminou;
- retirada não paga e reservas técnicas continuam sujeitas ao timer/tolerância configurados enquanto aplicável;
- pedido já pago não deve ser cancelado automaticamente por expiração; permanece para decisão operacional/gerencial;
- existe requisito de **prazo-limite configurável antes do fechamento para aceitar novos pedidos**, mas o número exato de minutos ainda não está fixado como regra definitiva;
- mensagens de recebimento/aceite/pronto devem comunicar a modalidade e o prazo/horário aplicável;
- pedidos já aceitos devem permanecer na fila operacional adequada, em vez de desaparecer apenas porque a loja fechou.

A implementação dessa política deve ser feita na frente de **Horários + Pedido Online**, preservando separadamente retirada e entrega e sem alterar nesta rodada o fluxo já homologado de expiração de retirada não paga.


Complemento aplicado em seguida:
- migration `20260927215019_security_backfill_log_actor_names.sql` normaliza o rótulo histórico de `session_heartbeat` para **Sessão ativa** e preenche, quando resolvível por `user_id`, nome/e-mail do ator em logs antigos que estavam sem identidade amigável.


---

## Sessão, múltiplas guias, títulos e auditoria amigável — 27/09/2026

### Múltiplas guias

Foi identificado o motivo exato de links do menu abertos com **Abrir em nova guia** caírem no Início:
- `PrivateLayout` tratava toda guia sem `sessionStorage['optmamenu.session.start']` como uma sessão nova;
- em seguida executava `navigate('/admin', { replace: true })`, apagando a rota profunda originalmente aberta;
- a validação auxiliar de sessão também dependia de um `pong` via `BroadcastChannel` em apenas 200 ms e podia invalidar uma sessão legítima quando a aba de origem estivesse em background/throttled.

Correção:
- nova guia preserva a URL original do menu;
- sessão Supabase já válida é adotada na nova guia sem redirecionamento forçado;
- ciclo de vida de guia deixa de ser usado como motivo independente para logout;
- inatividade passa a ser a única autoridade para encerramento automático, respeitando a configuração da loja.

### Inatividade

No banco da Gelinhares a configuração real estava:
- habilitada;
- **25 minutos**;
- com uma lista legada de rotas isentas, incluindo Início, Pedidos, Produtos e áreas de estoque.

Isso explicava o comportamento aparentemente inconsistente. O histórico confirma encerramentos reais por inatividade, inclusive em 20/09/2026.

Correção:
- o timeout passa a valer em **todo o painel administrativo**;
- atividade em qualquer guia do OptmaMenu renova a mesma sessão, pois o último evento é compartilhado via `localStorage`;
- se nenhuma guia tiver atividade durante o período configurado, uma única guia coordena o logout;
- novos eventos usam a ação amigável **Sessão encerrada por inatividade**;
- a tela **Sessão e inatividade** agora explica explicitamente o comportamento entre guias;
- registros históricos de timeout foram normalizados para rótulos amigáveis.

Migration:
- `20260927221220_security_backfill_session_disconnect_labels.sql`.

### Histórico de atividades

Foram normalizados nomes técnicos que ainda apareciam ao usuário:
- `store_member_exit_registered` → **Desligamento de usuário registrado**;
- `store_member_linked_existing_user` → **Usuário existente vinculado à loja**;
- convites, alterações de status, funções personalizadas, permissões em lote e teste de sessão também receberam rótulos pt-BR.

Migration:
- `20260927221051_security_friendly_activity_labels.sql`.

Sobre remoções anteriores da Fidelidade: o banco possui um evento de segurança recente **Cliente removido da fidelidade** às 21:56:47 de 27/09/2026. Remoções feitas antes da implantação dessa auditoria não possuem dados suficientes para reconstrução fiel de ator/motivo e não foram inventadas retroativamente.

### Título da guia do navegador

O painel administrativo agora sincroniza o título com o item atual:
- `OptmaMenu | Produtos`;
- `OptmaMenu | Clientes`;
- `OptmaMenu | Pedidos`;
- etc.

O favicon existente continua sendo aplicado pelo `PrivateLayout`, formando visualmente no navegador **[favicon] OptmaMenu | <item atual>**.


---

## Fechamento crítico de Clientes — comunicações, Push e diagnóstico de pontuação — 27/09/2026

### Comunicações do cliente separadas da Fidelidade

Foi identificado um problema de governança de consentimento na UX anterior: WhatsApp, e-mail e SMS eram configuráveis apenas dentro da aba **Fidelidade**. Entretanto, os consentimentos de marketing continuam existindo mesmo quando o cliente deixa o programa; a saída da fidelidade remove os consentimentos próprios do programa, mas não apaga `marketing_whatsapp`, `marketing_email` e `marketing_sms`.

Para impedir que um cliente fique sem caminho de autoatendimento para revogar esses canais, a área do cliente ganhou a aba **Comunicações**, independente da participação em Fidelidade.

A nova área:
- deixa **Web/App** como canal interno permanente e sem checkbox;
- separa explicitamente **mensagens essenciais** de pedido, conta e segurança de comunicações promocionais;
- permite autorizar/revogar WhatsApp, e-mail e SMS a qualquer momento;
- mantém e-mail promocional bloqueado enquanto o e-mail da conta não estiver confirmado;
- esclarece que OTP por SMS, confirmação de e-mail e mensagens operacionais indispensáveis não dependem do opt-in promocional;
- concentra o histórico recente de `customer_notifications` como **Mensagens na sua conta**, com marcar individual/todas como lidas;
- atualiza esse histórico por verificação periódica enquanto a aba estiver aberta, usando as RPCs seguras já existentes e sem abrir SELECT direto da tabela para o cliente;
- mantém a captura inicial das preferências no fluxo de adesão à Fidelidade, mas a alteração posterior fica centralizada em Comunicações.

Novo source de auditoria/consentimento:
- `customer_communication_preferences` → **Preferências de comunicação do cliente**.

Na tela administrativa Clientes 360º também foram traduzidos registros recentes que ainda apareciam técnicos:
- `loyalty_webapp` → **Web/App**;
- `loyalty_data_responsibility` → **Responsabilidade pelos dados da fidelidade**;
- `system_required_webapp` → **Canal interno obrigatório**;
- `customer_loyalty_join` → **Adesão à fidelidade pelo cliente**;
- `customer_loyalty_preferences` → **Preferências de comunicação da fidelidade**;
- `customer_communication_preferences` → **Preferências de comunicação do cliente**.

Commits:
- `151bf973b3667343c4c33276e31f7dc808abb0cc`;
- `b72591ead2f4d33e7eaa78742ff2481d95b9e5be`;
- `9d0539595ab57710cca217e1e014e499c0ac35ac`;
- `7d0bb3b60dba53b522c7e86ccbe4dfb28a211eb4`.

### Push do navegador — decisão arquitetural para a frente de Clientes/Slug

**Web/App interno** e **Web Push** são mecanismos diferentes.

O canal Web/App permanece sempre disponível dentro do portal. Para notificações que aparecem fora da página, o desenho aprovado para futura implementação deve separar duas autorizações:

1. **permissão técnica do navegador/dispositivo**, solicitada explicitamente ao usuário por gesto próprio;
2. **preferência de negócio no OptmaMenu**, vinculada ao cliente e à loja para definir quais tipos de mensagem podem gerar Push.

Como as lojas públicas hoje usam caminhos sob a mesma origem OptmaMenu, a permissão técnica do navegador pertence à origem, e não individualmente ao slug. Por isso o backend deverá vincular cada assinatura a:
- `store_id`;
- `customer_id`;
- navegador/dispositivo;
- finalidade(s) autorizada(s);
- timestamps de criação, último sucesso/falha e revogação.

Cada navegador/dispositivo terá sua própria assinatura. A interface deverá oferecer, no mínimo, **Ativar neste dispositivo** e **Desativar neste dispositivo**, sem confundir isso com o canal Web/App obrigatório.

O repositório contém um scaffold legado de Web Push (`NotificationReceiver`, `notificationService` e `public/sw.js`), porém ele **não deve ser reutilizado como solução de produção do cliente sem hardening**: o código tenta gravar em `web_push_subscriptions`, tabela que não existe no banco live atual, e foi desenhado originalmente para identidade de usuário administrativo, não para a identidade isolada do cliente.

Para a implementação final, usar tabela própria de assinaturas de cliente, RPC/Edge Function segura, VAPID privado somente no servidor e remoção/revogação das assinaturas no ciclo de exclusão de conta. Dispositivo compartilhado deve receber aviso de privacidade porque a notificação pode aparecer fora da página.

### Diagnóstico do pedido de R$ 3,75 que gerou 8 pontos

Pedido auditado:
- `PED-20260927-220957-4776`;
- 1 × **Graviola** por R$ 3,75;
- categoria **Picolé cremoso**;
- categoria marcada como elegível e multiplicador `1.00`.

O backend calculou **8 pontos** porque aplicou duas regras ativas e cumulativas:
- **Pontuação base por compra**: `floor(3,75 × 1) = 3` pontos;
- regra **VALE5**: bônus fixo de **5 pontos** em todo `order_completed`.

Resultado: **3 + 5 = 8 pontos**.

A regra `VALE5` está ativa, com `points_mode=fixed`, valor 5, `conditions={}` e descrição comercial de desconto de R$ 5 em compras a partir de R$ 50. Na implementação atual ela está sendo interpretada como bônus de fidelidade sem a condição de R$ 50, por isso incidiu também no pedido de R$ 3,75.

Outro achado importante: a função live `calculate_order_loyalty_points_advanced` atualmente calcula a pontuação a partir de `loyalty_point_rules` e do total do pedido; **não utiliza `categories.loyalty_multiplier` na fórmula**, apesar de o multiplicador de categoria existir na configuração e no catálogo.

Nenhuma regra foi alterada nesta frente. A correção pertence à frente específica de **Fidelidade**, onde deve ser resolvida a semântica das regras e recalculada/testada sem misturar Clientes com a autoridade do motor de pontos.

### Requisito futuro — exceção de pontuação por produto

Registrar para a frente Fidelidade:

Exemplo desejado:
- categoria **Picolé cremoso** normalmente gera fator/pontuação 1;
- durante uma campanha mensal, somente **Graviola** passa a gerar fator/pontuação 2;
- os demais produtos da categoria permanecem com a regra normal.

O modelo deve suportar:
- regra padrão do programa;
- regra por categoria;
- exceção/override por produto;
- vigência `starts_at` / `ends_at`;
- prioridade explícita;
- política clara de substituição versus acumulação;
- snapshot/auditoria das regras efetivamente aplicadas na transação para permitir explicar no futuro por que determinado pedido gerou determinada quantidade de pontos.

Para multiplicadores, a preferência de desenho é **override mais específico vence** (produto > categoria > programa), evitando multiplicação acidental. Bônus separados podem continuar tendo regra explícita de acumulação.

### Pendências reais para considerar Clientes concluído

Funcionalmente, cadastro, autenticação, OTP, telefone, e-mail, pedidos, consumo, endereços, carrinho persistido, exportação e exclusão já estão em estado avançado e homologado. Restam principalmente endurecimentos finais:

1. **Dispositivos e sessões do cliente** — backend possui dispositivos confiáveis, mas a área do cliente ainda não lista/revoga outros dispositivos de forma amigável. Criar gestão segura de dispositivos/sessões sem expor hashes.
2. **Troca de senha com reautenticação forte** — a troca atual exige sessão válida + dispositivo confiável, mas deve ser avaliada para exigir senha atual ou OTP recente antes de alterar a credencial.
3. **Web Push do cliente** — implementar a arquitetura descrita acima, separada do scaffold legado.
4. **UX responsiva final da conta** — revisar navegação de muitas abas no mobile e o desenho futuro de barra inferior da loja pública, coordenando Conta, Menu, Carrinho e Contato para não duplicar CTAs.
5. **Acessibilidade da área modal** — revisão final de foco, teclado/Escape, anúncio semântico e scroll lock.
6. **Reteste pós-OptmaPay** — como a frente OptmaPay está alterando pagamento Golden Pix e partes relacionadas ao cliente, repetir ao final o fluxo cliente → pedido → pagamento → confirmação → status/consumo para garantir que não houve regressão.

Os Advisors Supabase continuam sendo tratados em rodada própria de hardening do projeto, conforme regra operacional do repositório, sem misturar a correção de linter com o fechamento funcional da UX de Clientes.


---

## Clientes — dispositivos, senha forte e preparação de fechamento — 27/09/2026

### Branding público da loja

Decisão de UX reafirmada:
- dentro da experiência do cliente, priorizar **o nome da loja**;
- não usar a marca OptmaMenu/OptmaIdea como protagonista nas mensagens da conta;
- **OptmaMenu** e **OptmaIdea** ficam como atribuição discreta no rodapé da experiência comercial, com links;
- textos jurídicos continuam sendo tratados como documentos legais próprios e não devem ser silenciosamente reescritos apenas por branding.

Aplicado:
- a antiga explicação de **Web/App** deixou de citar OptmaMenu e passa a citar dinamicamente o nome da loja obtido pela slug;
- a fidelidade, quando fala do canal interno ao cliente, usa a área da própria loja;
- o arquivo de exportação do cliente deixa de levar `optmamenu-` no nome;
- o `StoreLayout` exibe no rodapé público os links de atribuição **OptmaMenu** e **OptmaIdea**.

### Dispositivos confiáveis e invalidação real de sessões

Migration:
- `20260928023000_customer_trusted_devices_and_password_session_hardening.sql`.

A identidade sintética do cliente ganhou `sessions_valid_after`. As funções centrais:
- `app_current_customer_id()`;
- `app_current_store_id()`;
- `app_current_role()`;

agora recusam o vínculo de cliente para JWTs emitidos antes da rotação de segurança. Isso fecha uma limitação anterior: apenas marcar um dispositivo como revogado não era suficiente para impedir um JWT já emitido de chamar diretamente uma RPC self-service até expirar.

A tabela de dispositivos ganhou metadados amigáveis de navegador/dispositivo, sem expor o hash ao cliente.

Novas primitivas service-role-only:
- `customer_verify_current_password_service_safe`;
- `customer_list_trusted_devices_service_safe`;
- `customer_revoke_other_trusted_devices_service_safe`.

ACL validada:
- `anon`: sem EXECUTE;
- `authenticated`: sem EXECUTE direto;
- `service_role`: EXECUTE permitido;
- acesso passa pela Edge Function autenticada.

`customer-auth-session` foi publicada em **v6 ACTIVE** e agora:
- valida também `revoked_at` e `sessions_valid_after` da identidade;
- lista dispositivos confiáveis sem devolver `device_token_hash`;
- identifica o dispositivo atual;
- grava rótulo amigável derivado do User-Agent;
- exige a senha atual para **desconectar outros dispositivos**;
- revoga os outros dispositivos e rotaciona a geração da sessão;
- emite uma nova sessão apenas para o dispositivo atual;
- exige a senha atual para alterar a senha;
- depois da troca de senha, desconecta outros dispositivos, invalida JWTs anteriores e renova a sessão atual.

A troca segura de telefone também passou a atualizar `sessions_valid_after`, além de revogar todos os dispositivos e exigir novo login.

### UX de Segurança da conta

Na aba **Segurança** do cliente:
- nova seção **Dispositivos confiáveis**;
- mostra navegador/plataforma, última atividade, última confirmação por SMS e marca **Este dispositivo**;
- ação **Desconectar outros dispositivos**, protegida pela senha atual;
- troca de senha agora exige:
  1. senha atual;
  2. nova senha;
  3. confirmação da nova senha;
- após trocar a senha, outras sessões são encerradas e a sessão atual é renovada;
- feedback informa quantos outros dispositivos foram desconectados.

Acessibilidade do modal da conta também foi reforçada:
- `role="dialog"`;
- `aria-modal="true"`;
- título associado por `aria-labelledby`;
- foco inicial no botão Fechar;
- tecla Escape fecha a conta;
- scroll da página de fundo é bloqueado enquanto o modal está aberto.

### Fidelidade — itens que NÃO devem se perder na consolidação

Não alterar nesta frente de Clientes; encaminhar para a frente específica de Fidelidade.

1. **Nomes técnicos em “Regras existentes”**

A página unificada ainda imprime `rule.trigger_event` diretamente, por isso aparecem valores como `order_completed`. A correção é somente de apresentação: usar rótulos comerciais amigáveis e manter os códigos técnicos apenas internamente.

2. **Vale/selos por quantidade de compras elegíveis**

A suspeita de perda na fusão entre “Fidelidade” e “Fidelidade avançada” foi confirmada estruturalmente.

O modelo ainda possui:
- `enable_stamps`;
- `min_order_for_stamp`;
- `stamps_target`;
- `points_per_stamp_block`.

Na Gelinhares, o programa live ainda está configurado com:
- `enable_stamps=true`;
- mínimo atual para selo: R$ 13,00;
- alvo: 10 compras/selos;
- recompensa: 5 pontos por bloco.

Porém:
- a página unificada atual não expõe essa configuração;
- o trigger ativo `on_order_completed_loyalty` chama `handle_new_order_points_v2()`;
- `handle_new_order_points_v2()` chama apenas `apply_order_loyalty_points_advanced()`;
- a antiga lógica de selos presente em `handle_new_order_points()` não é a função ativa do trigger.

Portanto a capacidade de **“a cada N compras com valor mínimo X, conceder Y pontos”** existe como legado de modelo, mas deixou de fazer parte da autoridade ativa do motor unificado.

Requisito a restaurar na frente Fidelidade:
- quantidade de compras elegíveis configurável;
- valor mínimo da compra configurável;
- recompensa em pontos configurável;
- janela/vigência opcional;
- comportamento cíclico;
- histórico/auditoria de progresso e concessão;
- impedir contagem de pedido cancelado/estornado;
- definir política de devolução após o selo já ter contribuído para uma recompensa.

Exemplo solicitado: **a cada 5 compras de R$ 50,00 ou mais, conceder X pontos**.

Isso é diferente de uma regra fixa como `VALE5`: “vale/selos” deve representar progressão por compras elegíveis, não “+5 pontos em todo pedido concluído”.

3. **Exceção de pontuação por produto**

Preservar a decisão:
- programa define base;
- categoria pode sobrescrever a base;
- produto pode sobrescrever a categoria;
- precedência para multiplicadores: **produto > categoria > programa**;
- vigência e prioridade explícitas;
- bônus acumuláveis devem ser uma regra distinta, não uma multiplicação implícita;
- a transação deve guardar snapshot das regras efetivamente aplicadas.

4. **Erro dos 8 pontos**

Continua encaminhado para Fidelidade:
- pedido R$ 3,75;
- 3 pontos da regra base;
- +5 indevidos da regra ativa `VALE5`;
- total observado: 8.
A correção deve eliminar a interpretação indevida do `VALE5` e reconciliar o motor com multiplicadores de categoria/produto sem alterar dados às cegas.

### Situação dos quatro blocos finais de Clientes

1. **Segurança de conta** — praticamente fechado nesta rodada: dispositivos confiáveis, desconexão dos outros dispositivos, rotação de JWT e troca de senha com senha atual.
2. **Push do cliente** — ainda pendente. Implementar depois sobre identidade cliente+loja+dispositivo; não reutilizar diretamente o scaffold legado.
3. **UI/UX e acessibilidade** — modal recebeu o primeiro fechamento de acessibilidade; ainda falta decidir/refinar a navegação mobile da conta e a futura barra inferior coordenando Menu, Conta, Carrinho e Contato.
4. **Reteste pós-OptmaPay** — propositalmente pendente até a frente paralela de OptmaPay estabilizar o Golden Pix. Ao final repetir cliente → pedido → Golden Pix → confirmação → status → conclusão → Meu consumo.

Não realizar alterações de OptmaPay nesta frente de Clientes.


---

## Fechamento da slug — navegação fixa, carrinho flutuante e segurança por dispositivo — 03/10/2026

### Segurança por dispositivo

Após teste real em tablet + PC, foi confirmado que a revogação global anterior produzia corretamente perda de sessão, porém deixava ruído de console no dispositivo revogado (`customer-auth-session 401` e `/auth/v1/user 403`).

A solução foi evoluída para **revogação seletiva por sessão/dispositivo**:
- cada sessão Auth do cliente é vinculada ao `trusted_device_id` por `session_id`;
- revogar um dispositivo marca apenas o dispositivo e suas sessões vinculadas como revogados;
- RPCs customer-scoped passam a depender de sessão vinculada a dispositivo ativo;
- o dispositivo atual permanece válido;
- o dispositivo remoto revogado recebe estado funcional de sessão expirada/reauth sem depender de HTTP 401/423 para erros de negócio esperados;
- bloqueio por várias senhas incorretas continua existindo, mas a Edge Function devolve payload controlado para que a UI mostre a mensagem amigável sem poluir o console com 423 esperado.

Migration:
- `20261003203500_customer_targeted_trusted_device_sessions.sql`.

A área Segurança do cliente agora permite:
- dar **apelido** a cada dispositivo confiável;
- desconectar **um dispositivo específico** mediante confirmação da senha atual;
- usar **Sair deste dispositivo** no card atual;
- manter a ação agregada de desconectar outros dispositivos como contingência.

### Cabeçalho da conta

Foi adicionado o botão **Sair** junto de **Minha conta**, conforme solicitado, além do fechamento do modal já existente.

### Slug pública — navegação estilo app

A loja pública passou a adotar uma navegação fixa mobile/tablet com cinco posições visuais:
1. **Início** — retorna ao catálogo;
2. **Loja** — usa nome/logo da loja e abre a área institucional/relacionamento;
3. posição central reservada ao carrinho flutuante;
4. **Perfil/Entrar** — abre a conta do cliente;
5. **Menu** — abre as demais áreas navegáveis.

O **Carrinho** deixa de ocupar uma barra duplicada:
- botão flutuante central sobre a navegação;
- estado recolhido por padrão;
- contador quando há itens;
- expande temporariamente ao adicionar produtos, mostrando quantidade e total;
- pode ser recolhido novamente pelo cliente;
- em desktop permanece flutuante fora da barra mobile.

### Área da loja

Foi criada a área institucional da própria loja, separada do Perfil:
- identidade da loja;
- fidelidade/pontos e benefícios;
- texto e imagem institucional;
- WhatsApp;
- e-mail;
- telefone;
- endereço;
- mapa;
- redes sociais/site;
- texto institucional configurável.

Esses campos utilizam a configuração visual/comercial já disponível em **Aparência da loja**. A habilitação comercial por plano Premium ainda deve ser ligada a uma futura autoridade de assinatura/plano; não foi criado um bloqueio artificial enquanto o modelo de planos não possui fonte autoritativa consolidada no banco.

### Atendimento

Regra adotada:
- dúvidas de pedido, entrega, retirada, produtos e relacionamento comercial devem usar o **contato informado pelo lojista**;
- `faleconosco@optmaidea.com.br` fica reservado a contexto de infraestrutura/plataforma;
- se a loja não configurar e-mail comercial, a slug não exibe o e-mail da OptmaIdea como substituto de atendimento.

### Rodapé e branding

Rodapé público consolidado em uma única atribuição:
- `© 2026 Loja online por OptmaMenu · OptmaIdea`;
- OptmaMenu aponta para `https://optmamenu.com.br/`;
- OptmaIdea aponta para `https://www.optmaidea.com.br/`.

O bloco **Privacidade e transparência** permanece. Referências a OptmaMenu/OptmaIdea dentro dos documentos jurídicos também permanecem quando necessárias para explicar responsabilidades.

### Busca, categorias e informações comerciais

Catálogo:
- placeholder da busca passa a ser configurável pelo lojista; fallback neutro: **Buscar produtos**;
- cabeçalho possui ação de busca;
- mostra **Tudo + até 4 categorias principais**;
- quando houver mais categorias, exibe **Mais (N)** e abre painel recolhível com todas;
- evita poluição visual em lojas com muitos grupos/categorias.

Cards informativos:
- **Compre mais e pague menos** abre explicação contextual quando existirem regras progressivas reais;
- **Delivery — consulte condições** abre modalidades, mínimos, taxas e prazos configurados;
- **Fidelidade** só é exibida quando configurada como ativa.

### Pendências antes de declarar a slug encerrada

- homologar visualmente mobile + tablet + desktop da nova navegação e do carrinho;
- validar apelido/desconexão individual de dispositivos em dois navegadores reais;
- validar ausência de ruído 401/403/423 para os cenários esperados já tratados;
- finalizar a frente Fidelidade;
- executar apenas depois o reteste conjunto com OptmaPay, cuja evolução ocorre em frente separada.


---

## Fechamento de Trusted Devices e sessão revogada — 03/10/2026

Baseline reconciliado antes da alteração na branch compartilhada `agent/homologacao-geral-20260820`:
- HEAD remoto de entrada: `bf27bf920f1e41e5ce4027a2b80b440ae05df068`;
- Supabase com `20261003203500_customer_targeted_trusted_device_sessions` aplicado;
- Edge Function `customer-auth-session` ativa;
- Vercel apontando para a mesma branch, sem reset/reversão das frentes paralelas de OptmaPay/Fidelidade.

A frente CLIENTES corrigiu o fechamento de dispositivos confiáveis sem abrir acesso direto à tabela:
- `persistDeviceMetadata` continua atualizando User-Agent/atividade, mas só preenche `device_label` automaticamente quando o campo estiver vazio; apelidos definidos pelo cliente deixam de ser sobrescritos;
- renomear com valor vazio restaura o nome automático derivado do User-Agent já conhecido daquele dispositivo;
- a tela de Segurança atualiza a lista de dispositivos por polling customer-scoped a cada 8 segundos, além de foco/visibilidade, sem expor `customer_auth_trusted_devices` ao navegador;
- edição do apelido passa a usar toda a largura útil, o badge **Este dispositivo** não comprime mais o input e o texto atual é selecionado ao focar;
- foi incluída a ação explícita **Remover apelido e usar nome automático**;
- restauração de sessão valida primeiro uma sessão ainda vigente pela Edge Function com resposta funcional HTTP 200; revogação esperada é convertida em estado deslogado antes de insistir no GoTrue;
- renovação normal usa `refreshSession` e o cliente deixou de forçar refresh em qualquer HTTP 401, evitando loops quando o 401 representa revogação intencional da sessão/dispositivo;
- lock de senha e demais recusas esperadas permanecem como respostas funcionais tratadas pela aplicação.

Não houve migration nova neste bloco: a correção reutiliza as colunas e RPCs seguras já existentes. A Edge Function é a única implantação Supabase necessária.


---

## Slug pública — fechamento de navegação, sugestões, avaliações e fidelidade — 04/10/2026

Homologação do cliente confirmou antes desta rodada:
- apelidos de dispositivos persistem;
- remoção do apelido restaura o nome automático;
- alterações de apelidos aparecem nos demais dispositivos com pequeno atraso do polling;
- desconexão remota remove imediatamente o dispositivo das listas;
- tentativas repetidas de senha incorreta preservam o bloqueio temporário com contador.

### Dispositivo remoto revogado

O fechamento foi endurecido para que a revogação não dependa de o usuário abrir o Perfil:
- a slug autenticada executa heartbeat de sessão em background, a cada ~8 segundos enquanto a página está visível e também em foco/retorno de visibilidade;
- quando a Edge Function informa `session_expired`, `reauth_required` ou equivalente, o dispositivo revogado limpa a sessão local e volta ao estado deslogado;
- o heartbeat não força refresh de uma sessão revogada;
- ao revogar um dispositivo, `device_label` e `user_agent` são apagados daquele registro;
- ao entrar novamente, o dispositivo precisa de OTP conforme a política existente e inicia novamente com identificação automática, sem reaproveitar o apelido anterior;
- a área Segurança ganhou **Desconectar todos os outros dispositivos**, protegida pela senha atual e preservando o dispositivo em uso.

### Avaliação de produtos — estrelas, sem comentários

Foi criada a infraestrutura customer-scoped para avaliações:
- tabela `customer_product_ratings` com RLS restritiva;
- nota de 1 a 5 estrelas;
- uma avaliação por cliente/produto, editável;
- não existe campo de comentário;
- o backend só aceita avaliação se o mesmo cliente possuir pedido `completed`, não estornado, contendo aquele produto;
- a interface de **Meu consumo** oferece as estrelas apenas sobre produtos vindos de compras concluídas;
- o catálogo público recebe apenas agregados de nota média e quantidade de avaliações, sem identidade do cliente.

Migration aplicada:
- `20261004015000_customer_storefront_ratings_and_device_cleanup.sql`.

### Mais pedidos e Favoritos

Foi adicionada a RPC pública agregada `get_public_product_rankings_by_slug`.

Critérios:
- **Mais pedidos**: quantidade efetivamente vendida em pedidos concluídos e não estornados;
- **Favoritos**: maior nota média, depois maior quantidade de avaliações e, em empate, maior quantidade vendida.

O smoke test real na slug `gelinharessjn` retornou vendas históricas suficientes para popular **Mais pedidos**. Como ainda não havia avaliações gravadas no momento da implantação, **Favoritos** inicia corretamente sem inventar estrelas ou avaliações.

### Busca e catálogo

A barra de busca fixa foi removida da página inicial e substituída por:
- botão flutuante de lupa;
- diálogo de busca/filtro;
- filtro permanece aplicado ao catálogo até ser limpo;
- estado do filtro fica visível na página;
- ação A–Z/Z–A foi preservada.

Foi criada uma faixa de sugestões no topo do catálogo:
- **Mais pedidos**;
- **Favoritos**.

### Categorias principais

`StoreConfig` agora aceita `featured_category_ids`.

Em **Aparência da loja** o lojista pode selecionar até quatro categorias principais.

Sem seleção manual:
- o catálogo calcula vendas por categoria a partir dos rankings públicos;
- prioriza automaticamente as categorias com mais unidades vendidas em pedidos concluídos;
- usa a ordem original do catálogo como desempate/fallback.

### Navegação responsiva e carrinho

No mobile:
- barra inferior: **Início · Loja · Carrinho/Comanda · Perfil/Entrar · Menu**;
- carrinho fica dentro da barra, com badge, sem botão circular projetado sobre o conteúdo;
- isso elimina a sobreposição observada sobre o bloco final de privacidade;
- o item Loja usa ícone genérico de estabelecimento na navegação; logo continua reservado ao cabeçalho/identidade institucional.

Em tablet paisagem/desktop:
- a barra inferior desaparece a partir do breakpoint `md`;
- um botão **Menu** fica no topo direito;
- Menu concentra busca, loja, carrinho, tema, conta/pedidos/consumo/fidelidade/segurança e sair.

No cabeçalho do catálogo:
- os ícones de busca, tema, logout e perfil foram retirados;
- permanece apenas a saudação não clicável **Olá, apelido**;
- tema e sair foram movidos para Menu.

### Fidelidade — separação de responsabilidades na slug

A UX customer-side passa a obedecer três autoridades:

1. **Perfil**
   - aceite do regulamento;
   - adesão;
   - saída do programa;
   - requisitos cadastrais e bloqueio de participação.

2. **Loja**
   - marketing institucional da fidelidade;
   - campanhas, novidades e benefícios divulgados pela loja.

3. **Menu → Fidelidade**
   - saldo de pontos;
   - nível;
   - extrato;
   - política de validade;
   - termos publicados sobre prêmios/trocas.

O banco atual não possui vencimento individual por lote de pontos nem tabela customer-facing autoritativa de catálogo de prêmios. Por isso a interface não inventa “X pontos a expirar” nem itens de troca inexistentes: exibe a política de validade configurada e os termos publicados até que essas estruturas existam.

### Commits da rodada

- `6425ec758cf9f3e9a647397b2c31d332b2731997` — ratings e limpeza de metadados de dispositivo;
- `83aaaca20b873f6e93055c56e7fd5e7e7a39f22c` — heartbeat remoto, desconectar todos e UI de avaliação;
- `6b8879df294916d8a8f8c93d242ba17d1c033a85` — navegação responsiva, carrinho na barra e categorias configuráveis;
- `a52e8e6cb3b3031094d62e0079af14dd217102e8` — rankings, sugestões e diálogo de busca;
- `b5cfd131cbeb52b321ca9f9f5d39c9cf620fcbff` — separação de responsabilidades da fidelidade;
- `2b9cefd3c46cdde42dca3e9c3d5d8a811efdf663` — correção final de TypeScript da rodada.

O deploy funcional do commit `2b9cefd3c46cdde42dca3e9c3d5d8a811efdf663` foi validado como **READY** antes deste registro documental.


---

## Slug pública — mensagens, fidelidade e refinamentos de UX — 04/10/2026

Feedback homologado pelo usuário antes desta rodada:
- revogação remota de um dispositivo replicou o logout em tempo real;
- desconectar todos os outros dispositivos preservou apenas o dispositivo atual;
- novo login exigiu OTP e não reaproveitou sessão/apelido anterior;
- cabeçalho foi aprovado em mobile, tablet e desktop, restando ajustes de estado anônimo;
- faixas **Mais pedidos** e **Favoritos** foram aprovadas.

### Estado anônimo e cabeçalho

Na slug pública, quando não existe cliente autenticado:
- o cabeçalho exibe **Entrar** em vez de **Olá**;
- **Entrar** abre diretamente o fluxo cliente de login/cadastro;
- em desktop e tablet paisagem a ação continua disponível no cabeçalho, além do Menu.

Para cliente autenticado:
- foi incluído um sino no cabeçalho;
- o sino abre a nova central de **Mensagens**;
- badge mostra mensagens não lidas com atualização periódica enquanto a página estiver ativa.

### Busca

O diálogo da lupa foi simplificado:
- resultados são listados alfabeticamente por nome do produto;
- o campo ganhou **X** interno para limpar imediatamente o filtro;
- **Mais pedidos** e **Favoritos** permanecem independentes do diálogo de busca.

### Tema

A escolha de tema da slug passou a ter três modos:
- **Claro**;
- **Escuro**;
- **Sistema**.

O modo Sistema acompanha `prefers-color-scheme` e reage a mudanças do sistema operacional. A preferência é persistida localmente.

A auditoria completa de contraste do modo escuro continua como frente visual separada; esta rodada não considera o dark mode integralmente encerrado.

### Categorias em destaque

A configuração manual foi tornada mais explícita em:

**Configurações → Aparência da loja → Visual → Cabeçalho e Rodapé → Categorias em destaque (até 4)**.

Sem seleção manual permanece o critério automático já implantado.

### Avaliações em Meu consumo

Foi adicionado um convite visível para avaliar compras concluídas:
- apenas estrelas;
- sem comentários públicos;
- a avaliação continua condicionada no backend à compra concluída do produto.

### Mensagens e categorias

`customer_notifications` agora possui uma categoria independente da severidade visual.

Categorias customer-facing:
- pedidos;
- fidelidade;
- sistema;
- perfil;
- segurança;
- marketing;
- geral.

Mensagens antigas foram classificadas por fallback semântico e novas mensagens recebem categoria automática quando o produtor ainda não informar uma explicitamente.

A central de Mensagens saiu da área de configurações e passa a ser acessada pelo:
- sino do cabeçalho;
- item **Mensagens** no Menu.

A tela permite filtro por categoria e mantém leitura individual / marcar todas como lidas.

### Marketing geral x comunicações da fidelidade

As permissões foram separadas no backend e no frontend.

Marketing geral:
- `marketing_whatsapp`;
- `marketing_email`;
- `marketing_sms`.

Fidelidade:
- `loyalty_whatsapp`;
- `loyalty_email`;
- `loyalty_sms`;
- `loyalty_webapp` permanece canal interno obrigatório.

A adesão futura ao programa deixa de sobrescrever as escolhas de marketing geral.

### Conta do cliente

**Meus dados** volta a conter apenas cadastro do cliente.

Foi criada uma aba visível própria **Fidelidade** dentro da conta para:
- adesão;
- saída;
- requisitos cadastrais;
- bloqueio;
- aceite;
- canais específicos da fidelidade.

A aba antes denominada **Comunicações** passa a ser **Marketing** e controla somente marketing geral.

### Loja — fidelidade institucional

A área **Loja** foi enriquecida com dados reais do programa ativo:
- nome do programa;
- validade dos pontos;
- bônus de adesão e aniversário quando configurados;
- referência de resgate;
- benefícios/prêmios ativos dentro da vigência;
- termos e regulamento;
- termos de vouchers.

Foi criada a RPC pública segura `get_public_loyalty_program_by_slug`, sem exposição de dados de cliente.

### Menu → Fidelidade

A área operacional de fidelidade foi reorganizada para priorizar uso diário:
- saldo e nível;
- total de ganhos;
- total de usos/débitos;
- validade;
- benefícios atualmente disponíveis;
- indicação de pontos suficientes ou quantos faltam;
- vouchers ativos, quando existirem;
- extrato com filtros **Todos / Ganhos / Usos e débitos**.

Não foi exposto resgate direto nesta rodada porque a RPC existente `redeem_reward` é autoridade de backoffice e não permite cliente. Não foi criada uma abertura insegura apenas para disponibilizar o botão.

### Backend aplicado

Migration:
- `20261004024500_customer_messages_loyalty_preferences_rewards.sql`.

Ela adiciona:
- categoria de notificações;
- separação de consentimentos da fidelidade;
- `get_customer_self_loyalty_rewards_safe()`;
- `get_public_loyalty_program_by_slug(text)`.

Smoke tests confirmaram a função pública da Gelinhares e ausência de categorias inválidas.

### Commits desta rodada

- `9c43bb0ba2876e2024fef1aa7a0ac80c94667c82` — backend de mensagens, comunicações de fidelidade e benefícios;
- `42dca9fabe8734f257f2b36587e5fce8cdbb37bb` — services/types customer-facing;
- `f1495a0f9fa92a09327fcff2a081e01192c572d9` — tema Sistema e Menu/Mensagens;
- `f9e19aac2243044d1b9bddcc74c2de8c50dd6c2d` — enriquecimento institucional da Loja;
- `00b75e5cd80aaa354d8b92a4f983a529440b5b03` — Entrar no cabeçalho, sino, busca alfabética e descoberta das categorias;
- `fcad7b82735f3738f738150a1f0cddb3e28c9a60` — reorganização final da conta, mensagens e fidelidade.

O deploy funcional de `fcad7b82735f3738f738150a1f0cddb3e28c9a60` foi confirmado **READY** antes deste registro.


---

## Slug pública — refinamentos após homologação visual — 04/10/2026 19h

Feedback confirmado pelo usuário:
- **Entrar** no cabeçalho aprovado;
- temas Claro / Escuro / Sistema aprovados funcionalmente;
- permanece pendente uma **auditoria ampla de contraste do modo escuro**, a executar depois de concluir a frente da slug pública;
- busca alfabética aprovada, mas o input exibia dois botões de limpeza;
- convite de avaliação por estrelas em **Meu consumo** aprovado;
- Mensagens não recebiam os eventos recentes de pedidos e fidelidade;
- navegação de Fidelidade ainda parecia misturar área operacional e configurações;
- configuração manual das quatro categorias não estava encontrável na tela usada pelo usuário.

Ajustes executados:
- busca pública passou a usar apenas o **X customizado**, eliminando o botão nativo duplicado do browser;
- a navegação do Menu foi dividida visualmente em **Loja / Minha área / Preferências**;
- telas operacionais **Fidelidade** e **Mensagens**, quando abertas pelo Menu, não exibem mais a barra de abas de configurações da conta;
- **Fidelidade** no Menu continua significando saldo, benefícios e extrato; **Configurar fidelidade** permanece dentro da área de conta;
- **Categorias em destaque** foi movida para **Configurações da Loja → Aparência da Loja → Personalizar catálogo**, com contador 0/4 e seleção automática disponível;
- foram criados produtores reais de `customer_notifications` para mudanças de status/pagamento de pedidos e para novas movimentações de `loyalty_transactions`;
- foi realizado backfill apenas das últimas 24 horas para preservar a homologação em andamento.

Diagnóstico dos benefícios da Gelinhares:
- existem recompensas cadastradas e marcadas como ativas;
- porém todas as recompensas existentes estão com `offer_valid_until` já vencido em 04/10/2026;
- por isso a tela customer-facing mostrar **“Não há benefício com vigência ativa neste momento”** está correta e não representa falha de renderização.

Backend:
- migration `20261004193000_customer_order_and_loyalty_notifications.sql`;
- aplicada no Supabase como `customer_order_and_loyalty_notifications`;
- triggers ativos:
  - `trg_customer_order_notification_after_write`;
  - `trg_customer_loyalty_notification_after_insert`.

Commits:
- `7dd06570cd95f96e4147d1da791adaa08052d111` — correções de navegação, categorias, busca e produtores de mensagens;
- `29e3bbe871efb4fe0987a4b22934d2f2e94fd598` — correção de markup do Menu após validação do build.

Validação anterior ao registro:
- GitHub Actions `Verify`: success;
- Vercel do commit `29e3bbe871efb4fe0987a4b22934d2f2e94fd598`: READY e sem alias error;
- Supabase: migration aplicada, triggers presentes e mensagens recentes de pedido/fidelidade materializadas.
