# OptmaMenu — Cronograma de lançamento oficial 01/08/2026

## Status

Cronograma base registrado.

## Objetivo

Chegar em 01/08/2026 com a aplicação pronta para uso real, priorizando estabilidade operacional, fluxo de vendas principal e possibilidade de ajustes incrementais em produção sem quebrar operações dos usuários.

## Princípio de execução

```txt
Podemos antecipar.
Não podemos atrasar.
```

As melhorias futuras podem continuar após o lançamento, desde que não quebrem a operação real dos usuários.

## Marco 1 — Definição funcional completa

### Período

Até 10/07/2026.

### Objetivo

Definir todas as funcionalidades necessárias para a primeira versão real da aplicação.

### Entregáveis

- mapa final de módulos para a versão inicial;
- definição do que entra no lançamento oficial;
- definição do que fica para versões posteriores;
- regras de negócio principais;
- fluxos prioritários fechados;
- riscos conhecidos documentados.

### Foco imediato

- venda balcão / PDV;
- pedido via slug / catálogo online;
- mesa / comanda;
- clientes e permissões de dados;
- dashboard comercial;
- caixa/livro diário;
- estoque e baixa operacional;
- configurações mínimas para operação real.

## Marco 2 — Melhorias e refinamentos visuais

### Período

11/07/2026 a 14/07/2026.

### Objetivo

Executar melhorias de UI/UX e acabamento visual necessários para teste com cliente.

### Entregáveis

- ajustes visuais das telas principais;
- refinamento dos fluxos de PDV, pedidos e mesa;
- mensagens amigáveis;
- estados vazios claros;
- botões e ações consistentes;
- responsividade básica validada;
- redução de fricção para usuários reais.

## Marco 3 — Ambiente de testes externo

### Data

14/07/2026.

### Objetivo

Subir aplicação para ambiente de testes em Vercel ou Netlify.

### Entregáveis

- build publicado;
- variáveis de ambiente configuradas;
- Supabase apontado corretamente;
- acesso externo disponível;
- URL compartilhável para validações controladas.

## Marco 4 — Testes técnicos e automatizados no ambiente

### Data

15/07/2026.

### Objetivo

Executar testes técnicos no ambiente publicado.

### Entregáveis

- testes de build/deploy;
- testes automatizados disponíveis;
- testes de rotas protegidas;
- testes de permissões;
- testes de fluxo crítico;
- testes de Realtime;
- testes de Supabase/RLS/RPC;
- checklist técnico de deploy.

## Marco 5 — Envio para testes reais assistidos

### Data

16/07/2026.

### Objetivo

Disponibilizar a aplicação para testes reais por pessoas próximas ao contexto do cliente.

A intenção não é apenas testar execução funcional, mas validar:

- compreensão do fluxo;
- aderência à realidade do negócio;
- sugestões de melhoria;
- dificuldades operacionais;
- correções de linguagem;
- pontos que precisam de simplificação.

### Estratégia

Distribuir para pessoas executarem testes o mais próximos possível de suas realidades.

## Marco 6 — Melhorias, correções e retestes

### Período

16/07/2026 a 31/07/2026.

### Objetivo

Executar todos os ajustes necessários a partir dos testes reais.

### Entregáveis

- correções de bugs;
- melhorias solicitadas;
- retestes;
- ajustes de UX;
- ajustes de regras de negócio;
- documentação mínima de uso;
- checklist final de produção;
- plano de suporte inicial.

## Marco 7 — Lançamento oficial

### Data

01/08/2026.

### Objetivo

Lançamento oficial da aplicação para uso real.

### Diretriz

A aplicação deve estar segura para operação real, mesmo que novas versões e melhorias continuem sendo publicadas após o lançamento.

## Priorização operacional até o lançamento

### Prioridade máxima

1. venda balcão / PDV;
2. pedido via slug / catálogo online;
3. mesa / comanda;
4. segurança/permissões sem regressão;
5. estoque e baixa correta;
6. caixa/livro diário;
7. dashboard comercial;
8. clientes e proteção de dados.

### Prioridade futura, fora do foco imediato

- pedidos por e-mail;
- vendedor externo;
- colaborador de vendas inserindo pedidos;
- canais alternativos complexos;
- automações avançadas;
- integrações externas sofisticadas.

## Regra para mudanças após uso real

Melhorias podem ocorrer durante o uso real, desde que:

- sejam incrementais;
- não quebrem operações dos usuários;
- tenham rollback claro quando necessário;
- respeitem permissões e segurança;
- não alterem dados críticos sem validação.

## Próxima execução imediata

- restaurar tela `Pedidos` como fila operacional padrão;
- manter `Todos os Status` apenas como consulta opcional;
- continuar entregando melhorias executáveis de PDV, slug e mesa.
