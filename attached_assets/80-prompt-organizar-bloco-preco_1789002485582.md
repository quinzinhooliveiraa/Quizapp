# 80 — Organizar o quadrante do preço (tempo → preço → prova)

Arquivo: `artifacts/perguntas-de-conexao/src/App.tsx`, função `LandingV2Quiz`,
dentro de `<div className="lp-price-main">`.

## Por que está bagunçado (medido no código)
- A linha do preço junta quantidade + preço + "10 centavos" numa frase só, com
  travessão, e **quebra em 2 linhas** no celular.
- A linha "acesso vitalício, uma vez só, sem mensalidade" **repete** o último
  item da checklist logo acima ("Sem mensalidade. Paga uma vez.") — duas linhas
  cinzas dizendo a mesma coisa.

## O conserto — 3 degraus limpos

**Localizar:**
```jsx
              <div className="lp-price-main">
                <p className="lp-price-time">
                  Uma por noite, dá mais de um ano de conversa.
                </p>
                <p className="lp-price-value">
                  459 perguntas por{" "}
                  <span className="lp-price-figure" style={{ whiteSpace: "nowrap" }}>
                    R$ 47,90
                  </span>{" "}
                  — dá 10 centavos cada.
                </p>
                <p className="lp-price-once">
                  acesso vitalício, uma vez só, sem mensalidade
                </p>
              </div>
```

**Trocar por:**
```jsx
              <div className="lp-price-main">
                <p className="lp-price-time">
                  Uma por noite, dá mais de um ano de conversa.
                </p>
                <p className="lp-price-value">
                  459 perguntas por{" "}
                  <span className="lp-price-figure" style={{ whiteSpace: "nowrap" }}>
                    R$ 47,90
                  </span>
                </p>
                <p className="lp-price-once">
                  dá 10 centavos por pergunta
                </p>
              </div>
```

O que mudou:
1. **Preço numa linha só** — tirei o "— dá 10 centavos cada" de dentro dela, então
   não quebra mais nem tem travessão. Continua "459 perguntas por R$ 47,90"
   (quantidade antes do preço, Pricing p.37 🟩).
2. **A prova virou uma linha só e nova:** "dá 10 centavos por pergunta" — o valor
   por unidade, que é o único dado que ainda não tinha sido dito (Pricing p.19/p.21 🟩).
3. **Tirei "acesso vitalício, uma vez só, sem mensalidade"** — a checklist logo
   acima já diz "Sem mensalidade. Paga uma vez." Não precisa repetir a 2 linhas
   de distância.

Fica: **tempo (grande) → preço (uma linha) → 10 centavos (pequeno)**. Três
degraus, sem quebra, sem repetição.

## (Opcional) apertar o respiro pra ler como um bloco só
Se as três linhas ficarem espaçadas demais entre si:
```css
.lp-price-main .lp-price-value { margin-top: 0.5rem; }
.lp-price-main .lp-price-once { margin-top: 0.25rem; }
```

## Conferir depois (celular)
1. "459 perguntas por R$ 47,90" cabe em **uma linha**, sem travessão.
2. Embaixo, só "dá 10 centavos por pergunta".
3. Sumiu a linha "acesso vitalício, uma vez só, sem mensalidade" (já está na
   checklist acima).
4. O quadrante lê como 3 degraus, não como um monte de linhas soltas.
