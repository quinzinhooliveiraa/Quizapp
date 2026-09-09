# Prompt 68 — fazer a tabela comparativa PARECER uma comparação

Cole no Replit. Mexe só na seção `data-section-name="comparativo"` (a
`.lp2-comparison`, eyebrow "a diferença", H2 "O que muda numa noite.").
Não altere nenhuma outra seção.

## O problema

As duas colunas são visualmente idênticas — mesmo tamanho, mesmo peso, quase a
mesma cor. O olho lê "duas listas paralelas", não "lado ruim × lado bom". O
livro pede a tabela lado a lado *(Copy p.36-37)*, mas o que faz a comparação
funcionar é **o contraste entre os lados** *(VA p.11)*, e ele não existe hoje.

## A ideia (é de livro)

**Color p.13:** luz = comportamento "bom", escuro = comportamento "ruim". Então:
o lado **"com o baralho" vira um card claro** (bom, acionável) e o lado
**"sem nada" fica apagado e sem card** (ruim, recuado). Isso cria o contraste
que faltava e ainda codifica ruim/bom pela luz.

---

## O que fazer

### 1. O lado "com o baralho" (`.lp2-comparison-with`) vira um card CLARO

```css
.lp2-comparison-with {
  background: #f7f5ff;
  border-radius: 14px;
  padding: 18px 15px;
  box-shadow: 0 14px 40px rgba(0,0,0,0.35);
}
/* texto escuro dentro do card claro */
.lp2-comparison-with,
.lp2-comparison-with * {
  color: #241d33 !important;
}
```

### 2. O cabeçalho desse lado SAI do dourado

Hoje o título "Hoje à noite, com o baralho" é dourado (`rgb(255,197,158)`).
Dourado é a cor exclusiva de **comprar** *(VA p.11)* e, além disso, some no card
claro. Deixe-o escuro e forte:

```css
.lp2-comparison-with > *:first-child {   /* o cabeçalho da coluna */
  color: #241d33 !important;
  font-weight: 700;
}
```

### 3. O lado "sem nada" (`.lp2-comparison-without`) fica MAIS apagado

Ele já é branco a 68%. Rebaixa mais, pra ele recuar de vez e o lado claro saltar:

```css
.lp2-comparison-without,
.lp2-comparison-without * {
  color: rgba(249, 248, 251, 0.45) !important;
}
.lp2-comparison-without { background: transparent; }
```

### 4. Trocar os títulos das colunas (quebrar a simetria)

Hoje os dois começam com "Hoje à noite," — isso deixa os dois gêmeos. Troque o
texto dos dois cabeçalhos para:

```
coluna esquerda:  Sem o baralho
coluna direita:   Com o baralho
```

Só o texto do cabeçalho muda. As 4 linhas de cada coluna continuam iguais.

### 5. (opcional) A seta antes → depois

Se quiser deixar o objetivo explícito, põe uma seta pequena entre as colunas,
no centro vertical, na cor lilás da marca (`#c4acff`), tamanho ~20px: `→`.
Ela transforma "duas colunas" em "isto vira aquilo". Se o espaço no celular
ficar apertado (as colunas hoje são 144px cada), **pula esta parte** — as 4
mudanças acima já resolvem.

---

## Confira depois de aplicar (celular, 375px)

1. Olhando a seção por meio segundo, dá pra dizer **na hora** qual lado é o bom
   (o claro) e qual é o ruim (o apagado)?
2. Todo o texto do card claro está **escuro e legível** — nada branco no branco.
3. O lado "Sem o baralho" está visivelmente mais apagado que o outro.
4. Não sobrou **nenhum** dourado nesta seção — dourado só no botão de compra.
5. Os títulos são "Sem o baralho" / "Com o baralho".

---

## Por que (não precisa executar — é só o motivo)

- **Card claro no lado bom, escuro no ruim:** luz = "bom", escuro = "ruim"
  *(Color p.13)*; e luz = acionável *(Color p.15)* — o lado claro é pra onde você
  quer que a pessoa se mova.
- **O contraste é o que faz o olho entender que são opostos** *(VA p.11 —
  cor/coisa que contrasta captura atenção)*. Sem contraste, viram duas listas.
- **Tirar o dourado:** dourado é a cor única de comprar *(VA p.11)*; repetir ela
  aqui dilui o botão.
- **A tabela em si está certa:** mentalidade de prevenção (evitar o silêncio)
  pede o lado a lado *(Copy p.36-37, Wan, Hong & Sternthal 2009)*. Só a execução
  visual é que faltava.

**Evitado de propósito:** verde/vermelho no lugar do claro/escuro. Briga com a
paleta roxo/dourado, e no livro o vermelho é excitação/ação, não par de
"certo/errado" *(Color p.22-23)*.
