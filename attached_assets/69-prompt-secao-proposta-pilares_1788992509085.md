# Prompt 69 — consertar o layout dos dois pilares (seção "a proposta")

Cole no Replit. Mexe só na seção `data-section-name="proposta"`, nos dois cards
`.lp-pillar` dentro de `.lp-solution-pillars.lp1-two-pillars`. **Não muda
nenhuma palavra da copy** — só o layout. Não altere nenhuma outra seção.

## O problema (medido)

- Os dois pilares estão lado a lado em colunas de 135px, e o texto cabe em só
  **82px**. Por isso "10 minutos por noite" quebra em 3 linhas e "Não precisam
  estar juntos" em 4. Fica ilegível.
- A foto (`lp-pillar-photo`, 82×46px) está em **só um** dos dois cards, o que faz
  o par parecer quebrado/desalinhado.
- O card com foto tem ícone **e** foto (redundante) e fica muito mais alto que o
  outro.

## O que fazer

### 1. Empilhar os dois pilares em largura cheia (um embaixo do outro)

```css
.lp-solution-pillars.lp1-two-pillars {
  grid-template-columns: 1fr;   /* era 2 colunas de ~135px */
  gap: 16px;
}
```

Com isso o texto ganha a largura inteira e para de quebrar palavra por palavra.

### 2. Deixar cada pilar com o ícone ao lado do texto (não empilhado)

Para o card não virar uma coluna alta, põe o ícone à esquerda e o texto à
direita:

```css
.lp-pillar {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 14px;
  align-items: start;
  text-align: left;
}
.lp-pillar-icon { margin: 0; }
.lp-pillar strong,
.lp-pillar p { text-align: left; }
```

(Se hoje o conteúdo do `.lp-pillar` não estiver agrupado num wrapper, deixe o
ícone como primeira coluna e envolva `strong + p (+ a frase em negrito)` numa
`<div>` que ocupe a segunda coluna. Se for mais simples, pode manter tudo em
coluna única centralizada — o que **não** pode continuar é a largura de 82px.)

### 3. Tirar a foto do card 2

Remova o `<img class="lp-pillar-photo">` do segundo pilar. Com os cards agora em
largura cheia e com ícone, a foto minúscula só desequilibra. Os dois pilares
ficam simétricos: ícone + título + texto.

> Se você faz **questão** de foto, a única saída boa é dar uma foto **a cada**
> pilar, do mesmo tamanho, ocupando a largura do card (não 82px espremidos).
> Mas o padrão recomendado aqui é **sem foto** — mais limpo e simétrico.

### 4. Conferir a frase em negrito

No card 2, "respondam juntos, cada um no seu celular" está em negrito como bloco
separado. Mantém o texto, mas garante que ela fique na mesma coluna do corpo,
como continuação — não como um terceiro bloco solto.

---

## Confira depois de aplicar (celular, 375px)

1. "10 minutos por noite" cabe em **1 linha** (no máximo 2). Nada de 3-4 linhas.
2. Os dois pilares têm **a mesma cara**: ícone + título + texto. Nenhum tem foto
   e o outro não.
3. As alturas dos dois ficaram parecidas — nenhum é o dobro do outro.
4. Nenhuma palavra da copy mudou.

---

## Por que (não precisa executar — é só o motivo)

- **A copy e o objetivo já estavam certos:** a seção mata risco funcional —
  tempo ("10 min") e distância ("não precisam estar juntos") *(Copy p.39,
  Lantos 2011)* — e a lede menciona a alternativa clichê sozinha *(Copy p.23)*.
  O conteúdo não muda.
- **O conserto é de legibilidade e simetria**, não de livro: coluna de 82px
  quebra o texto palavra a palavra, e foto num lado só lê como bug. `cabeça do
  Claude` — não há citação nos seus PDFs pra largura de linha; é UX. A parte de
  livro aqui é só não deixar isso atrapalhar a copy que já está boa.
