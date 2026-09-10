# 77 — CAPS → caixa mista (só as frases longas)

Regra: caixa alta só em rótulo curto (≤3 palavras). Frase em CAPS vira caixa
mista *(Font p.19-20 🟩)*. Aplicando isso, **só 4 frases** precisam mudar. As
curtas ficam.

Arquivo: `artifacts/perguntas-de-conexao/src/App.tsx` (+ `index.css`).

---

## FICA como está (≤3 palavras, é rótulo)
- "DIAGNÓSTICO PERSONALIZADO" (2 palavras)
- "31 CARTAS", "32 CARTAS" etc. (2)
- "BÔNUS" (1)

Não mexa nessas.

---

## MUDA (frase longa em CAPS)

### 1. Resultado do quiz — "O QUE O TESTE MOSTROU"
No componente `Lp1Diagnosis`, localizar:
```jsx
        <p className="lp1-diagnosis-kicker">O QUE O TESTE MOSTROU</p>
```
Trocar por:
```jsx
        <p className="lp1-diagnosis-kicker">O que o teste mostrou</p>
```

### 2. Resultado do quiz — "UM GOSTINHO DO QUE VEM POR AÍ"
Localizar:
```jsx
              UM GOSTINHO DO QUE VEM POR AÍ
```
Trocar por:
```jsx
              Um gostinho do que vem por aí
```

### 3. Seção de preço — "O QUE VOCÊS LEVAM"
O texto no JSX já é minúsculo; quem deixa maiúsculo é o CSS. Faz as duas coisas:

No App.tsx, localizar:
```jsx
              <p className="lp1-price-includes-title">o que vocês levam</p>
```
Trocar por:
```jsx
              <p className="lp1-price-includes-title">O que vocês levam</p>
```
No index.css, na regra `.lp1-price-includes-title`, garantir:
```css
.lp1-price-includes-title {
  text-transform: none;
}
```
(Adiciona essa linha à regra existente; não apaga o resto dela.)

### 4. Card bônus — "TODO DIA UM NOVO" (4 palavras)
Esse `<span>` usa o mesmo estilo de rótulo do "31 CARTAS", então em vez de tirar
o CAPS (o que bagunçaria os outros), **encurta pra caber na regra** (3 palavras):

Localizar:
```jsx
                <span>todo dia um novo</span>
```
Trocar por:
```jsx
                <span>novo todo dia</span>
```
Fica "NOVO TODO DIA" (3 palavras, dentro da regra) e mantém o visual dos outros
selos.

---

## Ajuste fino (opcional, mas recomendado)
As duas frases do quiz (itens 1 e 2) têm `letter-spacing` largo, feito pra
CAIXA ALTA. Em caixa mista fica espaçado demais. Reduz nas duas classes:
```css
.lp1-diagnosis-kicker { letter-spacing: 0.02em; }
.lp1-diagnosis-questions-label { letter-spacing: 0.02em; }
```

---

## Conferir depois
1. No resultado do quiz: "O que o teste mostrou" e "Um gostinho do que vem por
   aí" em caixa mista, sem espaçamento exagerado.
2. Na seção de preço: "O que vocês levam" em caixa mista.
3. No card bônus: "NOVO TODO DIA" (3 palavras).
4. "DIAGNÓSTICO PERSONALIZADO", "31 CARTAS" e "BÔNUS" continuam em CAPS (é rótulo
   curto, pode).
5. Nenhuma frase com mais de 3 palavras sobrou em CAIXA ALTA na página.
