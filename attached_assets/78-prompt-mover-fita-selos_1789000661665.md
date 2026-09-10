# 78 — Mover a fita de selos pra longe do botão do hero

Arquivo: `artifacts/perguntas-de-conexao/src/App.tsx`, função **`LandingV2Quiz`**
(a de `/lp1`). A fita continua rolando (movimento mantido) — só sai de baixo do
hero, onde disputa atenção com o botão dourado *(VA p.11/p.15 🟩 — o dourado
tem que ser o único ímã de movimento perto da decisão)*, e vai pra um ponto sem
botão: entre a seção "a diferença" (comparativo) e "a proposta".

## O que fazer

### 1. RECORTAR a fita de onde ela está
Localizar, logo depois do fechamento da seção do hero (`</section>`), este bloco
inteiro e **recortá-lo** (tirar daqui):
```jsx
        <div className="lp-benefit-marquee" aria-label="Destaques do baralho">
          <div className="lp-benefit-marquee-track">
            <div className="lp-benefit-marquee-group">
              <span className="lp-benefit-marquee-item">459 perguntas</span>
              <span className="lp-benefit-marquee-item">15 baralhos</span>
              <span className="lp-benefit-marquee-item">jogo a distância</span>
              <span className="lp-benefit-marquee-item">acesso vitalício</span>
              <span className="lp-benefit-marquee-item">garantia 7 dias</span>
            </div>
            <div
              className="lp-benefit-marquee-group"
              aria-hidden="true"
            >
              <span className="lp-benefit-marquee-item">459 perguntas</span>
              <span className="lp-benefit-marquee-item">15 baralhos</span>
              <span className="lp-benefit-marquee-item">jogo a distância</span>
              <span className="lp-benefit-marquee-item">acesso vitalício</span>
              <span className="lp-benefit-marquee-item">garantia 7 dias</span>
            </div>
          </div>
        </div>
```

### 2. COLAR a fita entre o comparativo e a proposta
Localizar a abertura da seção proposta (a que tem a classe `lp-solution
lp2-proposta` — NÃO a do bloco `Home`/lp2):
```jsx
      <section
        className="lp-solution lp2-proposta"
        data-section-name="proposta"
      >
```
Colar o bloco da fita **imediatamente ANTES** desse `<section>`.

### 3. Ajustar o respiro (só se precisar)
Onde ela estava, a fita tinha margem pensada pro topo. No lugar novo, se ela
ficar grudada nas seções de cima/baixo, dá um respiro:
```css
.lp-benefit-marquee { margin-block: 1.5rem; }
```

## Conferir depois
1. Abaixo do botão do hero **não tem mais** a fita — só o botão e a linha de
   confiança.
2. A fita aparece **entre** "O que muda numa noite" (comparativo) e "a proposta",
   ainda rolando.
3. O único movimento perto do hero agora é o pulso do botão dourado.

*(Se preferir o outro ponto que você citou — entre os depoimentos e o preço —
é o mesmo recorte, colando antes de `<section className="lp-price"
data-section-name="precos">`. Escolhe um dos dois, não os dois.)*
