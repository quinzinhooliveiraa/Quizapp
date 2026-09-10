# 86 — URGENTE: consertar o e-mail que trava o pagamento sem erro

**Sintoma (confirmado em gravação):** pessoa clica em pagar sem preencher o
e-mail, o Pix não gera, e NÃO aparece erro nenhum. Mata conversão.

**Causa:** o campo de e-mail é `required` + `type="email"` e o botão é
`type="submit"`. O navegador bloqueia o envio pela validação nativa ANTES da
validação do código rodar — e como o campo fica no topo e o botão na barra fixa
embaixo, a bolha nativa não aparece no celular. A validação com mensagem que já
existe (`handleInitialCheckout` → `setEmailError`) nunca executa.

Arquivo: `artifacts/perguntas-de-conexao/src/App.tsx`. **3 mudanças.**

---

## 1. Desligar a validação nativa do form (pra a do código rodar)

Localizar:
```jsx
            className="checkout-email-form checkout-store-form"
            onSubmit={handleInitialCheckout}
          >
```
Trocar por (adiciona `noValidate`):
```jsx
            className="checkout-email-form checkout-store-form"
            onSubmit={handleInitialCheckout}
            noValidate
          >
```

## 2. Quando o e-mail estiver inválido: mostrar o erro E levar a pessoa até ele

Localizar em `handleInitialCheckout`:
```ts
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setEmailError("Confira o e-mail — parece que falta alguma coisa.");
      valid = false;
    }
```
Trocar por:
```ts
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setEmailError(
        buyerEmail.trim()
          ? "Confira o e-mail — parece que falta alguma coisa."
          : "Falta o e-mail pra liberar seu acesso.",
      );
      const emailField = document.getElementById("checkout-email");
      emailField?.scrollIntoView({ behavior: "smooth", block: "center" });
      (emailField as HTMLInputElement | null)?.focus({ preventScroll: true });
      valid = false;
    }
```
Isso mostra a mensagem certa (uma pra vazio, outra pra formato errado), rola a
tela até o campo e foca nele — a pessoa vê o problema na hora.

## 3. Um aviso no lugar onde a pessoa clicou (a barra de baixo)

Localizar a barra do botão:
```jsx
              <div className="checkout-purchase-bar">
                <div className="checkout-purchase-total">
                  <span>Total</span>
                  <strong>R$ 47,90</strong>
                </div>
                <button
                  className="button button-primary checkout-purchase-button"
                  type="submit"
```
Inserir, logo depois de `<div className="checkout-purchase-bar">`:
```jsx
                {emailError ? (
                  <p className="checkout-purchase-error" role="alert">
                    ↑ Preencha o e-mail ali em cima pra continuar.
                  </p>
                ) : null}
```
E no `index.css`:
```css
.checkout-purchase-error {
  margin: 0 0 0.5rem;
  color: #c0392b;
  font-size: 0.85rem;
  font-weight: 600;
  text-align: center;
}
```

---

## Conferir depois (celular) — o teste que reproduz o bug
1. Abre o checkout, **não preenche o e-mail**, toca em "Garantir meu…".
2. Agora TEM que: aparecer a mensagem embaixo do botão ("↑ Preencha o e-mail…"),
   a tela rolar até o campo, e a mensagem vermelha embaixo do campo.
3. Preenche um e-mail inválido ("abc"): mesma coisa, mensagem "Confira o e-mail".
4. Preenche um e-mail válido: o Pix gera normalmente.

> Prioridade máxima — isso está derrubando venda agora. Cola esse antes de
> qualquer outro.
