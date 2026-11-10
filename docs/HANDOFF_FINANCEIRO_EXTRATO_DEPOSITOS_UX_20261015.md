# Handoff — Financeiro: Extrato, Livro Diário, Depósitos, caixa e UX (15/10/2026)

## Fronteira de escopo
Esta é uma proposta documentada para **rodada própria do Financeiro**, fora das correções pré-testes finais. **Nenhum lançamento foi criado, ajustado, conciliado ou fechado nesta rodada.**

## Solicitações recebidas — com modelo de implementação

### 1. Troco enviado / tradução / lançamentos
- Tradução amigável de `Cash change sent` para **Troco enviado**, mantendo código técnico para auditoria. Localizar a origem do rótulo (lançamento e renderização) e corrigir na fonte; não editar descrições históricas sem política de versionamento.
- Verificar se a saída de troco realmente movimenta uma conta/caixa. Se for transferência entre contas ou mão de terceiros, registrar movimento em duas pernas/conta transitória, **não despesa operacional fictícia**.
- Livro Diário: mostrar o fato econômico e suas partidas de forma coerente com o Extrato. Não duplicar operações entre dois modelos financeiros.

### 2. Extrato por data com leitura compacta
Agrupar por dia: **14/10/2026 — saldo do dia: R$ 16.958,98**.

Cabeçalho compacto de cada linha: **Lançamento | Forma | Tipo (C/D) | Valor | Saldo após**. Legenda: **C = Crédito/entrada; D = Débito/saída**. Manter data no agrupamento; hora, número, documento, pagador/credor, responsável, conta, referência e conciliação em expansão vertical. Orientar a navegação por toque (tablet/celular) e teclado; permitir expandir tudo/recolher tudo.

Coluna de **Situação** separada do tipo contábil, evitando o `S` significar simultaneamente Saída e Status. Possíveis situações: Pendente, Enviado, Conferência, Concluído, Conciliado, Ocorrência. Quando exibir abreviações, legenda explícita ao pé do extrato.

### 3. Ações operacionais em dropdown
Em vez de vários botões grandes: **Ações** → Nova entrada; Nova saída; Depósito; Transferência entre contas; Sangria; Ajuste permitido (conforme permissão). Atalho de depósito pode ser destacado caso seja uso frequente.

### 4. Depósito rastreável, em duas etapas
**Depósito não é sangria, pagamento de despesa nem mera transferência concluída imediatamente.**

- Origem (ex.: Caixa principal), destino (conta bancária apta a receber espécie; **não presumir que a OptmaPay aceita depósito físico**), valor, data/hora, responsável portador, observação.
- Ação **Enviar depósito**: dinheiro sai da custódia do caixa e passa para conta transitória / dinheiro em deslocamento; registra usuário, data, código, responsável. Não creditar o banco ainda.
- Ação **Comprovar depósito**: anexar comprovante ou referência, valor confirmado, data/hora e recebedor; só então liquidar conta transitória e creditar destino.
- **Conciliação** independente: aguardando conferência, conciliado, diferença, estorno/reversão. Exibir conciliação por conta/competência, nunca como simples rótulo visual.
- Ocorrência: perda parcial, nota falsa, roubo, diferença entre enviado e depositado, devolução integral/parcial; exigir motivo, trilha, regra de autorização, ajustes financeiros consistentes e idempotentes.
- Não editar um único status que gere créditos fictícios. Toda mudança tem lançamento pareado e rollback/compensação quando aplicável.

### 5. Fechamentos históricos
Verificação somente leitura no Supabase em 15/10: há **14 registros de fechamento, todos `closed`**, de 02/05 a 25/07/2026. **Um registra diferença**. O pedido de deixar apenas três últimos para teste deve ser interpretado como separação de cenários de homologação / pendência de aprovação. Não declarar registros mais antigos 100% sem contagem/prova; não manipular dados fechados para mascarar diferença. Planejar retestes em datas simuladas ou novas sessões autorizadas, com logs.

### 6. Botão Atualizar e spinners
- Botão padrão com texto **Atualizar** + ícone circular; em telas estreitas, ícone com `aria-label="Atualizar dados"` e tooltip.
- Só animar enquanto uma requisição efetiva está carregando. Clique deve forçar reconsulta, sem depender do Realtime; desabilitar enquanto carrega e retornar erro/horário da última atualização se necessário.
- Atualização em tempo real pode ocorrer silenciosamente com rótulo opcional "Atualizado há ...", sem spinner infinito; em conexões lentas, indicador de carregamento contextual (skeleton ou spinner dentro da seção) e estados vazio/erro diferentes.
- Filtros de todas as telas recolhíveis, badges de filtros aplicados, botão Limpar sempre acessível e resumo de período; cards compactos por padrão, expandir/recolher tudo nos históricos. Colunas secundárias por expansão, nunca obrigar rolagem horizontal para operação essencial.

## Testes / aceite da futura rodada Financeiro
- [ ] Tradução de labels de troco no Extrato e Livro Diário; conciliação com partidas reais.
- [ ] Depósito: registrado → enviado → comprovado → conciliado; verificar conta de origem, conta transitória e destino a cada passo.
- [ ] Depósito parcial, diferença, nota falsa/perda, cancelamento antes do envio, estorno depois do envio, idempotência, permissões e auditoria.
- [ ] Separar sangria, pagamento, transferência entre contas e depósito; evitar receita/despesa duplicada.
- [ ] Extrato C/D agrupado por data, responsivo e expansível com saldo após correto.
- [ ] Atualizar realmente reconsulta e informa falha de conexão em mobile/desktop.
- [ ] Verificar 14 fechamentos, tratar diferenças honestamente, preservar histórico; sem fechamento automaticamente "100% OK" por conveniência.

## Coordenação com RC
Pacote Financeiro é **adiado conscientemente** na frente pré-testes para evitar regressão contábil. Ao iniciar frente Financeiro, validar baseline GitHub/Supabase/Vercel e usar este documento sem confundir propostas com funcionalidades já implantadas.
