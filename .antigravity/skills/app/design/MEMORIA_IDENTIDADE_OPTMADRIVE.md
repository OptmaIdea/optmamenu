# Memória de identidade visual - OptmaDrive

Atualizado em: 2026-06-28

## Decisão central

A identidade do OptmaDrive usa um símbolo combinado de **volante + via**. O círculo comunica controle, continuidade e histórico; os três apoios remetem ao volante; a forma coral central é uma estrada em perspectiva; o tracejado mostarda reforça trajeto e acompanhamento.

O desenho deve continuar reconhecível em 24 px, em uma cor e sem o nome. Não adicionar carro, bomba de combustível, velocímetro, chave ou outros elementos ao símbolo principal. Esses conceitos pertencem à iconografia dos módulos, não à marca.

## Relação com a família OptmaIdea

- Verde-água `#19A999`: cor dominante e vínculo familiar.
- Coral `#F1613A`: movimento e ação.
- Mostarda `#FAA832`: percurso, atenção e assinatura OptmaIdea.
- Grafite azulado `#29324E`: cor de apoio específica do OptmaDrive; transmite controle e estabilidade sem introduzir o azul clássico de interface.
- Off-white `#F9F6F0`: fundo acolhedor.

## Tipografia

- Marca: Candara, mantendo continuidade com OptmaIdea, OptmaMenu e OptmaSMSGate.
- Produto/interface: **Plus Jakarta Sans** variável (400, 500, 600 e 700) como fonte principal.
- Fallback web preferencial: **Inter**, por manter desenho neutro, boa legibilidade e métricas próximas às de uma sans contemporânea.
- Fallbacks nativos: `"Segoe UI"` no Windows, `Roboto` no Android, `"Helvetica Neue"` em versões antigas do ecossistema Apple e, por último, `Arial`/`sans-serif`.
- Candara fica reservada à assinatura da marca e a peças institucionais; não deve ser fallback do corpo da interface, pois sua disponibilidade e aparência variam entre sistemas.
- Números operacionais: Plus Jakarta Sans com `font-variant-numeric: tabular-nums`.

Stack recomendada:

```css
font-family: "Plus Jakarta Sans", Inter, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

Para evitar mudanças perceptíveis entre dispositivos, o produto deve servir Plus Jakarta Sans como webfont local (`woff2`) e carregar os pesos realmente usados. Inter funciona como segunda fonte controlada; as fontes nativas entram apenas quando as duas webfonts não estiverem disponíveis. Não usar `system-ui` antes desses fallbacks nomeados, pois ele muda de desenho conforme o sistema operacional.

## Arquivos criados

- `optmadrive_simbolo.svg`: símbolo vetorial transparente.
- `optmadrive_icone_app.svg`: ícone de app 1024 x 1024 com área segura.
- `optmadrive_logo_horizontal.svg`: assinatura horizontal editável.
- `GUIA_IDENTIDADE_OPTMADRIVE.docx`: racional, aplicações e padrões de produto.

## Regras permanentes

1. Preservar proporções e espaço livre mínimo equivalente a 25% do diâmetro do símbolo.
2. Não inclinar, contornar, aplicar sombra, bevel, brilho ou degradê obrigatório.
3. Em uma cor, usar grafite azulado sobre claro ou branco sobre escuro.
4. Usar coral apenas para ação/destaque; não para erros. Erros devem manter vermelho semântico próprio.
5. Testar toda redução em 24 px, 32 px e 48 px.
6. Antes de registro ou lançamento comercial, realizar busca de anterioridade de marca e símbolos semelhantes no INPI.

## Aplicação atual no produto

- A interface usa Plus Jakarta Sans variável local, com Inter variável local como fallback controlado.
- O tema escuro usa `#29324E` como fundo-base.
- A logo clara é usada no tema claro e a logo escura no tema escuro.
- Na logo escura, “Optma” usa `#F4F6F8` e “Mobilidade sob controle” usa `#FFFEF5`.
- As cores da interface são centralizadas como tokens em `src/App.css`; não devem ser adicionadas cores avulsas.
- Pesos tipográficos da interface ficam entre 400 e 700.

## Estado desta memória

Direção visual aprovada e aplicada como padrão inicial do produto, ainda sujeita ao redesenho fino no CorelDRAW e a testes de reconhecimento com usuários.
