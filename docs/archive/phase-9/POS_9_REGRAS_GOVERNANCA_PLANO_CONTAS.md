# POS 9 — Regras de governança do Plano de Contas

## Objetivo

Evitar que o Plano de Contas vire uma árvore inconsistente, duplicada ou técnica demais para o usuário final.

O plano deve continuar amigável para o lojista, mas tecnicamente seguro para balancete, auditoria, classificações automáticas e análises futuras.

---

## 1. Nenhuma conta lançável deve ficar solta

Toda conta lançável ativa deve ter um grupo pai.

Exemplo correto:

```text
2 - Saídas
  2.3 - Despesas administrativas
    2.3.1 - Despesa operacional
      2.3.1.1 - Aluguel
      2.3.1.2 - Energia elétrica
      2.3.1.3 - Internet
```

Exemplo a evitar:

```text
Energia elétrica
```

sem estar dentro de um grupo.

---

## 2. Grupos base são protegidos

Grupos estruturais criados pelo sistema não devem ser apagados pelo usuário.

Exemplos:

```text
1 - Entradas
2 - Saídas
3 - Transferências internas
1.1 - Receitas operacionais
2.3 - Despesas administrativas
```

Regra:

- não podem ser apagados;
- não devem ser inativados pela tela comum;
- podem ter nome ajustado apenas por fluxo administrativo controlado;
- alterações devem ir para auditoria.

Sinalização sugerida no metadata:

```json
{
  "system_group": true,
  "protected_account": true
}
```

---

## 3. Conta com lançamento nunca deve ser apagada

Se uma conta já foi usada em `cashbook_entries.account_plan_code`, ela não pode ser excluída fisicamente.

Permitido:

- inativar, se não for grupo base;
- manter histórico;
- impedir novos lançamentos futuros;
- continuar aparecendo em relatórios históricos quando o período tiver movimento.

Proibido:

- apagar fisicamente;
- trocar código técnico se já houver lançamento;
- reutilizar o código para outro significado.

---

## 4. Grupo com subníveis não deve ser apagado

Se uma conta/grupo possui filhos, ela não pode ser apagada.

Permitido:

- renomear com auditoria;
- reorganizar filhos por fluxo controlado;
- inativar apenas se todos os filhos estiverem inativos e sem impacto operacional futuro.

---

## 5. Somente contas criadas pelo usuário e sem uso podem ser apagadas

Apagar deve ser exceção.

Pode apagar somente quando todos forem verdadeiros:

- foi criada pelo usuário;
- não é grupo base;
- não tem lançamentos;
- não tem contas filhas;
- não é usada por preset/sistema;
- não é referência de classificação automática.

Sinalização sugerida no metadata:

```json
{
  "created_from_ui": true,
  "user_created": true
}
```

---

## 6. Numeração deve ser sugerida automaticamente

Ao criar uma conta filha, o sistema deve sugerir o próximo número livre.

Exemplo:

```text
2 - Saídas
  2.3 - Despesas administrativas
    2.3.1 - Despesa operacional
      2.3.1.1 - Aluguel
      2.3.1.2 - Energia elétrica
      2.3.1.3 - Internet
```

Se o usuário criar outra conta dentro de `2.3.1`, o sistema sugere:

```text
2.3.1.4
```

A sugestão deve considerar irmãos ativos e inativos para evitar reutilização indevida de número histórico.

---

## 7. Duplicidade de código exibido deve ser tratada

O campo `display_code` não deve se repetir entre contas ativas no mesmo plano, exceto quando for uma situação temporária de migração ainda não saneada.

Regra futura:

- impedir nova duplicidade em RPC;
- validar duplicidades existentes em diagnóstico;
- corrigir duplicidades por migration de saneamento.

---

## 8. Alterações de título e estrutura exigem auditoria

Alterações relevantes devem ser registradas:

- nome;
- código exibido;
- grupo pai;
- tipo;
- natureza;
- flags `is_group`, `is_postable`, `affects_financial_result`, `is_transfer`;
- status ativo/inativo.

Tabela futura sugerida:

```text
cashbook_account_plan_audit_logs
```

Campos sugeridos:

```text
id
account_code
action
changed_by
changed_at
old_data
new_data
metadata
```

---

## 9. Compras de bens duráveis não são consumo comum

A base deve orientar o usuário, sem engessar.

Exemplos:

- energia, internet, aluguel: despesa administrativa;
- material de limpeza/escritório: material de consumo;
- matéria-prima/insumos: custo operacional;
- computador, balcão, mesa, freezer, equipamento: bens/equipamentos/investimento, não consumo comum.

Sugestão de grupo futuro:

```text
2.9 - Investimentos e bens duráveis
  2.9.1 - Equipamentos
  2.9.2 - Móveis e utensílios
  2.9.3 - Informática
```

A depender da visão contábil futura, isso pode migrar para módulo patrimonial/ativo fixo. Para o usuário final, manter linguagem simples: `Bens e equipamentos`.

---

## 10. Transferências internas não são receita nem despesa

Transferências devem ficar em bloco próprio:

```text
3 - Transferências internas
```

Elas movimentam dinheiro entre contas financeiras, mas não devem afetar resultado.

Flags esperadas:

```text
is_transfer = true
affects_financial_result = false
```

---

## 11. Empréstimos recebidos e pagos

Empréstimo recebido aumenta caixa/banco, mas não é venda.

Sugestão:

```text
1.4.2 - Empréstimo recebido
```

Pagamento de empréstimo deve separar principal e juros:

```text
2.8.2 - Pagamento de empréstimo
2.6.1 - Juros de empréstimo
```

Regra:

- principal do empréstimo não é despesa operacional;
- juros são despesa financeira;
- ambos devem ter fluxo guiado futuro no Livro Diário.

---

## 12. Próximas implementações técnicas

1. Criar diagnóstico de duplicidade de `display_code`.
2. Criar migration de saneamento dos grupos duplicados.
3. Criar RPC para sugerir próximo código filho.
4. Criar RPC de delete seguro.
5. Criar tabela de auditoria do plano de contas.
6. Ajustar tela para:
   - bloquear exclusão/inativação de grupos protegidos;
   - ocultar botão apagar quando não permitido;
   - mostrar dica de classificação para bens duráveis, consumo e despesas.
