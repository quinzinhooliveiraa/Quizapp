# 82 — Checkout: "deck" → "baralho" + tirar o CAPS da pergunta de pagamento

Arquivo: `artifacts/perguntas-de-conexao/src/App.tsx` (+ `index.css`).
São 3 trocas de texto e 1 de CSS. Nada de lógica.

---

## 1. "deck" → "baralho" (3 lugares do checkout)

A LP toda diz "baralho" (é a palavra do público, Copy p.33). Só o checkout fala
"deck". Trocar:

**a)** Localizar:
```
        Ele vale 15 minutos. Toque em <strong>“Garantir meu deck”</strong> aqui
```
Trocar `Garantir meu deck` por `Garantir meu baralho`.

**b)** Localizar:
```
      Toque em “Garantir meu deck” que o QR aparece aqui.
```
Trocar por:
```
      Toque em “Garantir meu baralho” que o QR aparece aqui.
```

**c)** Localizar (texto do botão principal):
```
                      Garantir meu deck <ArrowRight size={17} />
```
Trocar por:
```
                      Garantir meu baralho <ArrowRight size={17} />
```

(Opcional, fora do checkout: na experiência/app ainda tem "Criar meu deck" e
"seu deck". Se quiser padronizar tudo, troca lá também — mas não é do checkout.)

---

## 2. Tirar o CAIXA ALTA de "Como você prefere pagar?"

O texto no JSX já é caixa mista — quem deixa maiúsculo é o CSS
`.checkout-card-heading h3 { text-transform: uppercase; }`, que é compartilhado.
Pra mexer **só** nessa pergunta (e não no "RESUMO", que é 1 palavra e pode
ficar), sobrescreve só o heading de pagamento, no `index.css`:

```css
.checkout-payment-heading h3 {
  text-transform: none;
  letter-spacing: 0.02em;
  font-size: 0.95rem;
}
```

(O `font-size` maior é porque, em caixa mista, o 0.76rem do rótulo fica pequeno
demais pra uma frase. Confere no celular e ajusta se quiser.)

**Alternativa, se você preferir manter o estilo de rótulo (igual ao "RESUMO"):**
em vez do CSS acima, encurta o texto pra caber na regra de ≤3 palavras — troca
`<h3>Como você prefere pagar?</h3>` por `<h3>Como pagar?</h3>` (vira "COMO
PAGAR?", 2 palavras). Escolhe UMA das duas abordagens, não as duas.

---

## Conferir depois (no checkout, celular)
1. O botão diz "Garantir meu baralho", e o texto do Pix também.
2. Não sobrou "deck" em nenhuma tela do checkout.
3. "Como você prefere pagar?" em caixa mista (ou "COMO PAGAR?" curto, se você
   escolheu a alternativa).
4. "RESUMO" pode continuar em CAPS (1 palavra, é rótulo).
