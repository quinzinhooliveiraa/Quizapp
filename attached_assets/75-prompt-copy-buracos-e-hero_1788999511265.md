# 75 — Copy: ponte causal no hero + os 3 buracos da voz do cliente

Arquivo: `artifacts/perguntas-de-conexao/src/App.tsx`
**Só a LP1 = a função `LandingV2Quiz`** (a que renderiza em `/lp1`). NÃO mexa no
bloco da função `Home` (variante v1/lp2), que tem textos parecidos.

São 4 mudanças de texto/JSX. Nenhuma mexe em lógica.

---

## 1. Ponte causal no subtítulo do hero

**Localizar** (dentro de `LandingV2Quiz`, `<p className="lp-hero-sub">`):
```
Você quer a conversa. Ele responde "sei lá" — e morre ali. São 459
perguntas escritas pra isso não acontecer. Vocês abrem uma carta,
leem em voz alta e escutam.
```
**Trocar por:**
```
Você quer a conversa. Ele responde "sei lá", e morre ali. O problema
nunca foi ele: era a pergunta. São 459 perguntas escritas pra abrir
sozinhas. Vocês leem uma carta em voz alta e escutam.
```
*(Copy p.26 🟩 — o diagnóstico vem antes da solução, e o número vira
consequência. Já sem travessão.)*

---

## 2. Buracos 6 + 4 — vergonha e "e se EU não souber", na seção 2

**Localizar** (seção `data-section-name="sei-la"`, o `<p className="lp2-section-lede">`
que termina com):
```
            os dois já estão dentro da conversa.
          </p>
```
**Inserir LOGO DEPOIS desse `</p>` um novo parágrafo:**
```jsx
          <p className="lp2-section-lede">
            E ninguém vai achar que você virou filósofo: quem faz a pergunta é
            a carta, não você. Vale pros dois, aliás. Você também não precisa
            chegar com resposta pronta: "nunca pensei nisso" já é um começo.
          </p>
```
*(Buraco 6 — vergonha "virei filósofo", 1.272 curtidas. Buraco 4 — "nunca sei
responder, n me conheço", 1.208 curtidas. Copy p.39 🟩 · voz do cliente.)*

---

## 3. Buraco 4 (parte 2) — FAQ novo, como o PRIMEIRO da lista

**Localizar** o início do array de FAQ:
```
            {[
              [
                "Isso substitui terapia de casal?",
```
**Inserir o novo item ANTES do "Isso substitui terapia de casal?":**
```jsx
              [
                "E se eu é que não souber responder?",
                "Acontece com todo mundo, e é por isso que a primeira carta de cada baralho é leve. Você não precisa de resposta pronta: pode dizer \"nunca pensei nisso\" e pensar em voz alta junto. Metade das boas conversas nasce aí.",
              ],
```
*(Copy p.21 🟩 — assumir a limitação aumenta a confiança no resto.)*

---

## 4. Buraco 5 — o DEPOIS (a imagem do prêmio), no fim da história

**Localizar** o fim da seção `data-section-name="historia"`:
```
            <p>
              São um casal que ficou sem as perguntas certas. É isso que a gente
              construiu.
            </p>
```
**Inserir LOGO DEPOIS desse `</p>` um novo parágrafo:**
```jsx
            <p>
              E quando a pergunta certa aparece, a conversa volta. Depois dela
              costuma sobrar uma paz meio esquisita de boa: a de quem foi
              escutado de verdade.
            </p>
```
*(Copy p.10-11 🟩 — falta a imagem concreta do depois; a página só vendia
mecanismo. Linguagem de promessa, na sua voz.)*
⚠️ **Importante:** isto é promessa no seu nome, NÃO um depoimento. Não coloque
aspas nem nome de cliente — seria o "50 casais" de novo.

---

## Conferir depois (celular)
1. O subtítulo do hero agora tem "O problema nunca foi ele: era a pergunta."
2. A seção 2 ("Ninguém abre o jogo…") ganhou o parágrafo do "filósofo".
3. O FAQ começa com "E se eu é que não souber responder?".
4. A história fecha com a linha da "paz meio esquisita de boa".
5. Nenhum texto da função `Home` (lp2) mudou.
