# Status do Projeto OptmaMenu

> **Última Atualização:** 19/09/2026  
> **Branch de homologação ativa:** `agent/homologacao-geral-20260820`  
> **Frontend:** React + TypeScript / Vercel  
> **Backend:** Supabase/Postgres (`lgkkfmqzaorrutuoqeax`)

---

## Estado executivo atual

O OptmaMenu está em homologação operacional do fluxo **loja pública → cliente autenticado → carrinho → pedido → operação → fidelidade**. Os testes multi-dispositivo de 19/09/2026 confirmaram bom funcionamento da conclusão de pedidos e pontuação, mas também revelaram problemas de fronteira de sessão, persistência do carrinho, expiração de delivery, consistência de fidelidade e detalhamento do histórico. Esta rodada corrige esses pontos sem reabrir a arquitetura histórica.

O baseline no início da rodada era `ca965497ea0dcc9b1548cdaae1476cf01650a881`, com Vercel READY. O Supabase tinha como última migration `20260916180940`.

---

## Correções estruturais — 19/09/2026

### Loja pública após autenticação

Foi identificado que o mesmo cliente Supabase usado para RPCs públicas também era usado para estabelecer a sessão GoTrue do cliente final. Depois do login, chamadas que deveriam permanecer anônimas podiam passar a carregar sessão autenticada, causando o estado incorreto **“Loja não encontrada”** mesmo com a Gelinhares ativa.

Correção:

- `supabasePublic` permanece estritamente anônimo para storefront/catálogo;
- criado cliente GoTrue isolado para verificar, renovar e encerrar a sessão do cliente;
- login do cliente não altera mais a identidade das RPCs públicas da loja.

### Expiração de pedidos

O cron `cancel-expired-orders-every-minute` chamava a sobrecarga sem parâmetros de `cancel_expired_reservations()`, que não restringia a expiração por tipo de atendimento. O pedido delivery `PED-20260919-124837-AD7B` confirmou o defeito: mesmo com o timer suspenso por delivery, a reserva física expirou e o cron cancelou o pedido.

Migration `20260919131552_fix_pickup_only_order_expiration`:

- expiração automática passa a atingir somente `fulfillment_type = pickup`;
- exige pedido não pago;
- delivery não é mais cancelado pelo timer de reserva;
- retirada não paga continua sujeita à expiração configurada.

O pedido delivery já cancelado pelo defeito não foi reativado automaticamente, porque isso poderia restaurar uma venda após liberação do estoque.

### Carrinho autenticado entre dispositivos

A persistência existente era localStorage por dispositivo. Foi adicionada persistência segura no servidor para cliente autenticado:

- tabela `customer_cart_drafts`, isolada por loja + cliente;
- acesso direto bloqueado para anon/authenticated;
- RPCs customer-scoped para obter, salvar e limpar o rascunho;
- ao autenticar/abrir a loja, o carrinho do servidor é recuperado e combinado com o carrinho local do mesmo cliente;
- o resultado é recalculado contra catálogo, estoque e preços atuais;
- alterações do carrinho são sincronizadas novamente com o servidor;
- carrinho local preexistente é publicado ao iniciar a sincronização quando ainda não existe rascunho remoto.

Carrinho anônimo continua local ao dispositivo; a sincronização multi-dispositivo é vinculada à identidade autenticada.

### Pedidos do cliente e recompra

A área real `CustomerAccountPortal` agora:

- continua verificando status automaticamente a cada 12 segundos;
- possui retry automático e tentativa de restauração de sessão em falha transitória;
- permite expandir cada pedido e visualizar os itens comprados;
- oferece **Comprar novamente**;
- recompra consulta o catálogo atual e usa preço/estoque atuais;
- itens removidos ou indisponíveis não são adicionados e são informados ao cliente.

### Fidelidade e dados do cliente

A área **Meus dados** passa a expor os campos necessários à fidelidade:

- nome;
- e-mail;
- CPF;
- data de nascimento;
- telefone confirmado permanece protegido.

Regras aplicadas:

- e-mail recebe validação de formato;
- alterar e-mail força `email_verified=false`;
- CPF e data de nascimento permanecem bloqueados para alteração após o primeiro preenchimento, exigindo futuro fluxo seguro específico;
- adesão à fidelidade exige nome, data de nascimento, CPF para maiores de 18 anos e e-mail sintaticamente válido;
- adesão/saída tornou-se idempotente: repetir uma ação já efetiva não cria novo consentimento e a UI informa o estado real;
- ao abrir Fidelidade, a sessão é atualizada para reduzir estado antigo entre dispositivos.

Migration `20260919131826_customer_portal_continuity_loyalty_cart_draft` também adiciona `get_customer_self_loyalty_transactions_safe`.

### Extrato de pontos

A aba Fidelidade agora possui **Extrato de pontos** com:

- ganhos/resgates/ajustes;
- quantidade de pontos;
- data/hora;
- descrição;
- código do pedido quando houver;
- atualização manual.

O cliente de teste “Seu Madruga” tinha 27 pontos e transação vinculada ao pedido `PED-20260917-114506-CE8A`, servindo como dado real para homologar o extrato.

### Aviso de preload no console

Foi removido de `index.html` o preload antecipado de `/assets/OptmaMenuLogo.webp`, que não era consumido imediatamente e gerava o aviso do Chrome. A imagem passa a ser carregada somente quando efetivamente utilizada.

---

## E-mail e alterações sensíveis — decisão arquitetural

O e-mail do cliente **não deve se tornar a identidade principal do Supabase Auth**. A identidade autoritativa do cliente continua sendo telefone confirmado + sessão/JWT próprio.

Estratégia para a próxima implementação de verificação de e-mail:

1. ao cadastrar/trocar e-mail, persistir com `email_verified=false`;
2. gerar desafio/token de uso único no backend, com TTL, rate limit e vínculo a cliente + loja + e-mail;
3. enviar o link/código por provedor de e-mail dedicado;
4. endpoint seguro confirma o desafio e marca `email_verified=true`;
5. alterações sensíveis de fidelidade/identidade devem exigir nova autenticação por telefone/OTP; e-mail verificado pode ser canal complementar, recuperação e notificações, mas não substitui silenciosamente o telefone confirmado.

Nesta rodada foi implementada a base de estado seguro do e-mail; o envio e a confirmação por provedor externo ainda não foram implementados.

---

## Homologação imediata

Validar em tablet, desktop e celular:

- login por SMS e retorno ao catálogo sem **Loja não encontrada**;
- carrinho autenticado criado em um dispositivo e recuperado no outro;
- edição do carrinho com atualização posterior em outro dispositivo, respeitando preço/estoque atuais;
- loyalty join com perfil incompleto deve orientar quais campos faltam;
- após completar os dados e aderir, outro dispositivo deve refletir participação ativa e não simular uma nova adesão;
- cancelamento/conclusão deve aparecer sem reload; falhas transitórias de leitura devem ser recuperadas automaticamente;
- delivery não pago deve permanecer ativo além do timer de reserva;
- retirada não paga deve continuar expirando conforme a configuração;
- pedido anterior deve abrir itens e permitir **Comprar novamente**;
- aba Fidelidade deve exibir o extrato real de pontos;
- console não deve mais emitir o warning de preload de `OptmaMenuLogo.webp`.

---

## Evoluções ainda abertas

- verificação real de e-mail por canal próprio;
- fluxo forte de alteração de CPF, nascimento, telefone e demais dados sensíveis;
- gestão administrativa de banners/campanhas exclusivos de fidelidade;
- notificações de carrinho abandonado, agora possíveis a partir do rascunho autenticado no servidor, com consentimento e regras de marketing;
- push/realtime customer-scoped poderá substituir ou complementar o polling quando o isolamento de eventos estiver formalmente fechado;
- comunicação por e-mail/WhatsApp de **Saiu para entrega** com ETA autoritativo.

---

## Autoridade técnica

Este arquivo é o resumo executivo canônico. Repositório, migrations efetivamente aplicadas no Supabase e deployments da Vercel são a autoridade para o estado técnico implantado.
