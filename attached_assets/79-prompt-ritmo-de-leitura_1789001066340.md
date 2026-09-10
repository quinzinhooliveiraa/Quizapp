# 79 — Dar às ledes o ritmo da seção "história" (parar de cansar)

Hoje a seção "a real sobre o que acontece" (história) lê fácil: alinhada à
esquerda, parágrafos curtos, respiro. As outras ledes são um parágrafo longo
centralizado — parede de texto que dá preguiça e faz a pessoa pular.

**Base:** UX, capítulo "Effort / Design for Scannability" 🟩 — reduzir o esforço
de leitura. A quebra em parágrafos curtos e o alinhamento à esquerda são craft
de copy (`cabeça do Claude`), não citação de página.

Arquivos: `App.tsx` (função `LandingV2Quiz`) + `index.css`.

---

## 1. CSS — alinhar as ledes à esquerda e dar respiro

As ledes de seção passam a se comportar como a história: coluna estreita
centralizada NA PÁGINA, mas o texto alinhado à esquerda, com espaço entre
parágrafos. Os H2 e os eyebrows continuam centralizados (são curtos).

```css
.lp2-section-lede,
.lp-solution-lede {
  text-align: left;
  max-width: 560px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.65;
}
/* respiro entre parágrafos da mesma lede */
.lp2-section-lede + .lp2-section-lede,
.lp-solution-lede p + p {
  margin-top: 1rem;
}
```

(Se alguma dessas classes tiver `text-align: center` em outra regra, o `left`
acima precisa ganhar — garanta que esta regra venha depois, ou remova o
`center` da regra antiga.)

---

## 2. Copy — quebrar a lede da PROPOSTA em parágrafos curtos

**Localizar** (seção `data-section-name="proposta"`), o `<p className="lp-solution-lede">`:
```jsx
          <p className="lp-solution-lede">
            459 perguntas escritas pra tirar a conversa do automático — sem
            clichê, sem "qual seu animal favorito". Vocês abrem uma carta, leem
            em voz alta e escutam. Separem 10 minutos e vejam onde a conversa
            vai.
          </p>
```
**Trocar por três parágrafos curtos** (mesmas palavras, sem travessão):
```jsx
          <p className="lp-solution-lede">
            459 perguntas escritas pra tirar a conversa do automático. Sem
            clichê, sem "qual seu animal favorito".
          </p>
          <p className="lp-solution-lede">
            Vocês abrem uma carta, leem em voz alta e escutam.
          </p>
          <p className="lp-solution-lede">
            Separem 10 minutos e vejam onde a conversa vai.
          </p>
```

---

## 3. A lede da seção "sei-la"
Ela já ganha um segundo parágrafo no prompt 75 (o do "filósofo"). Com o CSS do
passo 1 alinhando à esquerda, o ritmo dela já melhora. **Não precisa quebrar de
novo aqui** — evita conflito com o 75.

---

## Conferir depois (celular)
1. As ledes de "a proposta" e "sei-la" ficam **alinhadas à esquerda**, não
   centralizadas linha a linha.
2. A lede da proposta virou 3 blocos curtos com espaço entre eles, não um
   bloco só.
3. Os H2 ("Ninguém abre o jogo…", "São perguntas simples…") e os eyebrows
   continuam **centralizados**.
4. Passando o olho, a seção não parece mais uma parede — dá pra escanear.

---

## Depois, se você gostar (não faço agora pra não exagerar)
Mesmo tratamento nas ledes do **preço** (`lp1-price-context` e a lista de
inclusos) e no **subtítulo do hero**. Deixei de fora porque o hero curto
centralizado é convenção, e o preço eu preferia ver o resultado das duas
primeiras antes. Me fala depois de aplicar e a gente estende.
