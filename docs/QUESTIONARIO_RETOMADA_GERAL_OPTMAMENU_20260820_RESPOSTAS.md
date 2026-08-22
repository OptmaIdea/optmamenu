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

Encerre a PR #7 e abra uma branch específica de homologação geral?

### Q2 — Ambiente de homologação

VAmos usar o Supabase atual com uma loja explicitamente marcada como homologação.

### Q3 — Limpeza dos dados de homologação

Vou deixar esses dados no Supabase e assim que tivermos certeza de que tudo funciona corretamente, deletamos, mesmo porque, a própria Gelinhares como está hoje é para testes e os únicos dados que queremos manter são os cadastros de categorias e produtos. Aliás, aqui temos uma demanda antiga que vamos reaproveitar esses dados em outras lojas do grupo e já podemos testar migrando alguns desses itens para essa empresa de homologação.

### Q4 — Signup do proprietário da nova loja

Ordem aceita.

### Q5 — E-mails transacionais do OptmaMenu

Todos e já crie o email de despedida quando o cliente solicitar exclusão de conta.

### Q6 — Encerramento/exclusão de conta

Vamos seguir nessa ordem:

- bloqueio/inativação reversível com prazo de retenção de 10 dias;
- entre 10 e 20 dias após o bloqueio, se não houver reativação, enviamos um email pedindo para reativar a conta ou ela será excluída definitivamente, aconselhando a fazer backup dos dados;
- exclusão definitiva somente depois do prazo acima e das obrigações legais/fiscais.

### Q7 — Identidade visual da empresa e da slug

Confirme a separação:

- `logo da empresa` para administração/documentos internos;
- `logo da loja pública/slug` para catálogo/PWA/cliente;
- possibilidade de a mesma empresa possuir logos diferentes por unidade/slug.

Essa passa a ser a regra oficial →→→ Sim

### Q8 — Slug

Sugira uma alternativa.

### Q9 — Templates oficiais de papéis internos

Por hora, deixamos os papéis como estão.

### Q10 — Permissões individuais

Correto.

### Q11 — Dados pessoais de usuários internos

Além de nome, e-mail, telefone, alias interno e foto, data de nascimento, dados de endereço, cargos ou funções (esse só pode ser alterado por quem tiver poderes para isso), preferências de notificação, quais dados deseja permitir no perfil interno? Redes sociais crie uma lista fixa com redes mais comuns e site pessoal, além de uns 2 campos livres extras. Informações adicionais que o usuário pode ou não fornecer, como tipo sanguineo, alergias (pode colocar isso como sugestão no campo observações, mas, são itens em separado - acredito que tenhamos algo próximo a isso).

### Q12 — Solicitação de alteração de dados

Proprietário sempre e quem mais tiver esse poder.

### Q13 — Login de usuários internos

Falando em OTP podemos sim, desenhar isso para usuários internos também, para evitar que o funcionário não preencha um celular válido ou número fictício. Dentro da mesma loja não podem haver 2 usuários com o mesmo celular cadastrado ou com o mesmo e-mail. E como faremos essa autenticação, pelo Auth (isso pode criar uma sobrecarga no Supabase?) ou  criaremos alguma instância propria para acesso?

### Q14 — Consumidor Final

Correto.

### Q15 — Cadastro automático de cliente

Regra confirmada. Todo cliente cadastrado em uma slug deverá fazer por vontade própria mediante aceite dos termos.

### Q16 — Área logada do cliente

Senha + OTP

### Q17 — Vinculação de pedidos antigos

Não.

### Q18 — Programa de fidelidade

A raspadinha digital deve nascer como parte do programa de fidelidade Achei mais interessante como módulo/campanha promocional independente que pode conceder pontos, cupons, produtos ou mensagens de prêmio

### Q19 — Saldos por conta financeira

A tela `Financeiro → Saldos por conta` entra nesta rodada de saneamento antes da área logada do cliente? →→Sim

### Q20 — Lançamentos históricos não classificados

- não alterar histórico e exibir `Não distribuído` até classificação manual, só preciso de algum local para verificar quais são eles.

### Q21 — PWA por slug

- ambos: shell OptmaMenu para administração + PWA próprio para cada loja pública.

Lembre-se de que um dos grandes atrativos do OptmaMenu será oferecer "quase um site/loja virtual própria ao lojista", de forma que o nome da loja, suas cores, sua logo, seu domínio, suas redes sociais, sua forma de atendimento, etc, devem ser de responsabilidade do lojista. Posteriormente criaremos um serviço extra de criação de templates. O domínio só anote para mais adiante (deixe um campo morto de exemplo de tela), crie uma forma de o nome da slug quando não tiver domínio próprio ficar bem interessante. 

Em tempo, após a entrega vou comprar o domínio optmamenu.com.br para melhorar o SEO e posicionamento. Vamos aproveitar e registrar optmamenu.com e optmamenu.app também.

### Q22 — Atendente virtual/IA da slug

Corretíssimo, esse é o caminho, mesmo porque, doutra forma, precisaríamos de uma estrutura bem grande.

### Q23 — Canais e consentimento

Siga nessa linha proposta.

### Q24 — Alertas para o lojista

Sim, se possível, alguns lojistas (como é o caso do nosso parceiro) vão estar com o celular ligado no webapp e/ou usando um tablet específico. Poderemos ter também, telas de TV mostrando só essa páginas para que o aviso seja melhor visualizado.

### Q25 — Automação de testes no repo local

Me mande todo um script ou prompt para o Antigravity IDE fazer isso de forma autônoma.

### Q26 — Navegadores e dispositivos mínimos de homologação

Siga:

- Chrome/Chromium desktop;
- Firefox desktop;
- Android/Chrome;
- iPhone/Safari (esse não sei se terei disponível, mas, vou atrás)
- tablet Android → Sim /iPad → Não;
- larguras responsivas intermediárias.

Deseja acrescentar Edge desktop como navegador obrigatório? → Não

### Q27 — Offline/conexão ruim

Quero um modo offline operacional para PDV/estoque também. Eventualmente, teremos lojas que não terão internet estável full time, principalmente as do interior.

### Q28 — Fiscal

Confirmado.

### Q29 — Importação e bootstrap

Vamos incluir logo.

Adendo: Criar padrões de documentos para impressão em PDF ao invés de exportar PDF usando outros recursos externos, a menos que tenhamos uma opção free e eficaz, que não comprometa o desempenho e andamento da aplicação.

### Q30 — Critério para considerar “pronto para parceiro”

Só esses.
