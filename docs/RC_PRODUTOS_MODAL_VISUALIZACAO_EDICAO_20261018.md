# RC — Produtos: primeira rodada de visualização e edição responsivas (18/10/2026)

## Baseline e escopo

Branch de homologação `agent/homologacao-geral-20260820`. Trabalho limitado à UX dos modais administrativos, sem alteração de schema, estoque, precificação, reservas ou lançamentos financeiros.

**Ressalva de aceite anterior:** o login administrativo com autofill do Chrome foi confirmado pelo usuário com um clique após reload e novo preenchimento. A TRF-20261015-144225-589 foi conferida pelo usuário na tela de transferência (etapas, itens, aviso de divergência). A ocorrência consolidada na Vida do Produto permanece reteste visual próprio, sem bloquear o prosseguimento.

## Janela de visualização

- Modal acessível com semântica de diálogo, tecla Escape e botão Fechar.
- Celular/tablet retrato: painel de imagens e conteúdo compartilham rolagem vertical única, sem cortar o formulário após a imagem. Desktop preserva disposição em duas colunas.
- Imagem principal ampliável por toque ou clique; Escape fecha primeiro a ampliação, depois o modal. Setas, miniaturas e controles têm rótulos acessíveis.
- Acesso direto a **Vida do Produto** a partir da janela.
- Removidas afirmações sem base: autor `Admin`, criação com data atual fictícia e data de descontinuação `new Date()`.
- Botão Editar aparece somente se a janela recebeu `onEdit`; assim não sugere ação indisponível a perfis sem permissão.
- Classificação de estoque da janela alinhada à função de status do `/inventory`: limites zero são não configurados, não implicam excedente.

## Janela de edição

- Melhorado layout mobile para permitir rolagem vertical do conjunto imagens + campos. Desktop mantém painéis com rolagem separada.
- Imagens menores no celular para não dominar a altura; formulários preservados.
- Nenhuma lógica de salvar, inativar, excluir ou modificar estoque foi alterada.

## Retestes necessários

- [ ] Mobile Android: abrir visualização de Abacate, rolar até o rodapé, conferir saldo físico/reservado/disponível, navegar para Vida do Produto.
- [ ] Tablet retrato/paisagem: abrir e editar produto, rolar por imagens/campos/regras e alcançar botões de Salvar/Cancelar.
- [ ] Desktop claro/escuro: imagem ampliada, miniaturas, Escape retorna à janela sem fechá-la; segundo Escape fecha.
- [ ] Sem permissão de edição: modal de consulta sem botão de Editar.
- [ ] Produto sem created_at: mostrar ausência de data; produto descontinuado: não mostrar data fictícia.
- [ ] Mín/máx = 0: não mostrar excedente indevidamente.
- [ ] Salvar produto teste, reabrir e conferir persistência sem alterar saldo físico por esta mudança.
- [ ] Verificar eventuais modais aninhados de categoria, reativação e inativação, no mobile e desktop.

Refinamentos visuais globais (tooltips e cores) continuam em frente própria. Revisão mais profunda de Produtos, fichas e campos permanece pendente de aceite dos modais.
