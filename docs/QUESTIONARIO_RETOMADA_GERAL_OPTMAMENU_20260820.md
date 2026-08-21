# Questionário de retomada geral — OptmaMenu

Data: 20/08/2026

## Objetivo

Este documento recolhe apenas as decisões que precisam ser fechadas antes da auditoria ampla e da criação dos checklists segmentados de homologação. As respostas serão incorporadas ao documento mestre de estado, pendências e prioridades do OptmaMenu.

## Baseline já confirmado

- Repositório: `OptmaIdea/optmamenu`.
- PR ativa: `#7` — aberta e mergeável.
- Branch: `agent/fase-10-loja-publica-blueprint`.
- Head atual da PR: `4ca2a4ab0407e2286516b1fe58dd49f7307ff93c`.
- Último preview visível na Vercel para esse head: `READY`.
- O último trabalho funcional antes da pausa foi saneamento de estoque/reservas, pedidos → cashbook, UX de transferências e investigação de saldos por conta financeira.
- A integração mínima do OptmaSMSGate com o OptmaMenu ficou reservada para o cadastro/login de clientes via OTP.

## Decisões solicitadas

### Q1 — Estratégia de branch e PR

Deseja que a retomada continue na `agent/fase-10-loja-publica-blueprint` e na PR #7 até concluirmos esta rodada de saneamento/homologação, ou prefere encerrar a PR #7 e abrir uma branch específica de homologação geral?

### Q2 — Ambiente de homologação

Para o cadastro da nova loja com e-mail inédito, devemos usar o Supabase atual com uma loja explicitamente marcada como homologação, ou deseja que eu prepare uma estratégia de ambiente/branch de banco separado antes dos testes destrutivos?

### Q3 — Limpeza dos dados de homologação

Ao fim do ciclo, a loja, usuários, clientes, pedidos, lançamentos e mídias de teste devem ser removidos integralmente, preservados como massa permanente de regressão, ou arquivados/inativados?

### Q4 — Signup do proprietário da nova loja

Confirme o fluxo desejado para o primeiro proprietário:

1. e-mail + senha;
2. confirmação do e-mail;
3. criação da loja somente após confirmação;
4. onboarding dos dados da empresa;
5. escolha/validação da slug;
6. criação do primeiro local de estoque;
7. acesso ao `/admin`.

Deseja manter exatamente essa ordem? Caso contrário, indique a ordem correta.

### Q5 — E-mails transacionais do OptmaMenu

Além dos e-mails técnicos de autenticação, devemos incluir nesta rodada de produto:

- boas-vindas após ativação da loja;
- convite de usuário;
- alteração de e-mail;
- redefinição de senha;
- confirmação de encerramento/exclusão de conta;
- aviso de alteração sensível de segurança.

Quais deles são obrigatórios antes da primeira entrega externa?

### Q6 — Encerramento/exclusão de conta

Para proprietário/empresa, prefere inicialmente:

- bloqueio/inativação reversível com prazo de retenção;
- solicitação de encerramento sujeita a confirmação;
- exclusão definitiva somente depois do prazo e das obrigações legais/fiscais.

Qual deve ser o comportamento inicial? Há um prazo de retenção que deseja adotar provisoriamente?

### Q7 — Identidade visual da empresa e da slug

Confirme a separação:

- `logo da empresa` para administração/documentos internos;
- `logo da loja pública/slug` para catálogo/PWA/cliente;
- possibilidade de a mesma empresa possuir logos diferentes por unidade/slug.

Essa passa a ser a regra oficial?

### Q8 — Slug

Confirme se a slug deve continuar globalmente única. No onboarding, quando estiver ocupada, o sistema deve apenas rejeitar e sugerir alternativas ou pode gerar automaticamente uma alternativa disponível para o usuário aprovar?

### Q9 — Templates oficiais de papéis internos

Quais papéis devemos considerar templates oficiais no lançamento? Proposta inicial para revisão:

- Proprietário/Owner;
- Administrador/Gerente;
- Estoque/Compras;
- Caixa/PDV;
- Vendas/Atendimento;
- Financeiro.

Indique inclusões, exclusões ou fusões.

### Q10 — Permissões individuais

Confirme a regra: template de papel fornece o padrão; permissões específicas do usuário podem acrescentar ou retirar acessos individualmente sem alterar o template global.

### Q11 — Dados pessoais de usuários internos

Além de nome, e-mail, telefone, alias interno e foto, quais dados deseja permitir no perfil interno? Redes sociais devem ser campos livres opcionais por usuário ou uma lista fixa (Instagram, LinkedIn etc.)?

### Q12 — Solicitação de alteração de dados

Quando um usuário não puder editar determinado dado sensível, quem aprova a alteração: proprietário, administrador com permissão específica, ou ambos?

### Q13 — Login de usuários internos

Nesta rodada, o OTP do OptmaSMSGate será usado somente para clientes da loja pública ou também devemos desenhar desde já recuperação/segundo fator para usuários internos do OptmaMenu?

### Q14 — Consumidor Final

Confirme a regra proposta: cada loja terá um cliente genérico `Consumidor Final` como padrão de PDV/venda sem identificação, enquanto nome, CPF/CNPJ, telefone e endereço eventualmente informados ficam apenas no snapshot/documento daquela venda e não criam cadastro automaticamente.

### Q15 — Cadastro automático de cliente

Quando uma pessoa fornecer telefone/CPF/endereço em uma venda balcão, o sistema nunca deve criar cliente automaticamente; o operador deve solicitar explicitamente `Cadastrar cliente` se quiser transformar os dados da venda em cadastro. Confirma?

### Q16 — Área logada do cliente

Para a primeira versão, prefere autenticação `phone-first` sem senha, via OTP do OptmaSMSGate, mantendo e-mail opcional para contato/recuperação, ou deseja senha + OTP?

### Q17 — Vinculação de pedidos antigos

Se o cliente criar conta depois de já ter feito pedidos como visitante usando o mesmo telefone, devemos oferecer vinculação retroativa desses pedidos após confirmação OTP?

### Q18 — Programa de fidelidade

A raspadinha digital deve nascer como parte do programa de fidelidade ou como módulo/campanha promocional independente que pode conceder pontos, cupons, produtos ou mensagens de prêmio?

### Q19 — Saldos por conta financeira

A tela `Financeiro → Saldos por conta` entra nesta rodada de saneamento antes da área logada do cliente? Essa tela deverá separar, no mínimo: caixa físico, banco/Pix, recebíveis de cartão, adquirente/maquininha, cofre e valores ainda não classificados.

### Q20 — Lançamentos históricos não classificados

Para os lançamentos antigos sem conta financeira, prefere:

- tela de classificação assistida manual;
- regras de inferência por forma de pagamento com revisão antes de aplicar;
- não alterar histórico e exibir `Não distribuído` até classificação manual.

### Q21 — PWA por slug

Qual identidade deseja como objetivo principal?

- um único PWA `OptmaMenu`, que abre a última loja/slug usada;
- um PWA instalável por slug, com nome, logo, cores e atalhos da própria loja;
- ambos: shell OptmaMenu para administração + PWA próprio para cada loja pública.

### Q22 — Atendente virtual/IA da slug

Confirme se o briefing deve assumir um assistente opcional por loja, alimentado apenas por fontes autorizadas do lojista (empresa, horários, pagamentos, catálogo, alergênicos, políticas e pedidos), sem inventar informações, com escalonamento para atendimento humano.

### Q23 — Canais e consentimento

Podemos já desenhar uma central única de preferências do cliente com consentimentos separados para:

- SMS;
- WhatsApp;
- push/web push;
- e-mail;
- Telegram/outro mensageiro no futuro;
- mensagens operacionais versus marketing.

### Q24 — Alertas para o lojista

No saneamento da operação, deseja que o alerta de novo pedido online tenha como padrão: aviso visual persistente + som configurável, deixando push do navegador como recurso opcional mediante permissão?

### Q25 — Automação de testes no repo local

No Antigravity IDE podemos assumir disponibilidade de Node/npm. Confirme se também há Chromium/Chrome e permissão para instalar/executar Playwright. Se não souber, prepararei um script de diagnóstico que o co-agente executará antes de instalar qualquer dependência.

### Q26 — Navegadores e dispositivos mínimos de homologação

Proposta inicial:

- Chrome/Chromium desktop;
- Firefox desktop;
- Android/Chrome;
- iPhone/Safari;
- tablet Android/iPad;
- larguras responsivas intermediárias.

Deseja acrescentar Edge desktop como navegador obrigatório?

### Q27 — Offline/conexão ruim

O objetivo do lançamento deve incluir apenas tolerância a reconexão/estado local seguro, ou já precisamos exigir algum modo offline operacional para PDV/estoque? Esta decisão muda bastante a matriz de testes.

### Q28 — Fiscal

Confirme o limite desta rodada: validar CPF/CNPJ e snapshots fiscais/comerciais da venda e gerar documento auxiliar não fiscal, sem emissão NF-e/NFC-e/DANFE por enquanto.

### Q29 — Importação e bootstrap

Deseja incluir na homologação uma forma de importar clientes, produtos, estoque inicial e fornecedores por CSV, ou essa frente fica pós-lançamento?

### Q30 — Critério para considerar “pronto para parceiro”

Escolha o mínimo desejado antes de enviar link público ao parceiro:

- build/deploy sem erro;
- zero erro relevante no console nos fluxos homologados;
- testes automatizados críticos passando;
- cadastro completo de uma loja nova;
- estoque/comercial/financeiro reconciliados;
- permissões validadas por papéis;
- loja pública + carrinho + checkout validados em mobile e desktop;
- documentação de limitações conhecidas.

Há algum outro bloqueador obrigatório?

## Resposta sugerida

Pode responder usando apenas `Q1`, `Q2`, ... `Q30`, inclusive agrupando respostas quando a proposta já estiver correta, por exemplo: `Q7, Q10, Q14 e Q28: confirmados como proposto`.
