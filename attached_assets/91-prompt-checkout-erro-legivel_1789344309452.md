# 91 — prompt: deixar o erro do checkout legível

> Contexto: o bug que travava o pagamento sem avisar já foi consertado (o
> `noValidate`, a mensagem separada pro campo vazio, o scroll/foco e o aviso na
> barra estão todos no código — conferi). Isto aqui é o passo que ficou
> faltando: **a mensagem existe, mas está pequena demais pra cumprir a função.**

---

## O QUE FAZER

Arquivo: `artifacts/perguntas-de-conexao/src/index.css`

### 1. (o importante) Aumentar a mensagem de erro do e-mail

A classe `.checkout-email-error` está definida **duas vezes** no arquivo:

- linha ~9589 → `font-size: 12px`
- linha ~22818 → `font-size: 0.64rem`

As duas têm a mesma especificidade, então a **segunda sempre ganha**. Resultado:
a mensagem de erro do e-mail renderiza a `0.64rem`, que dá cerca de **10px**.

Na regra da **linha ~22818**, trocar:

```css
.checkout-email-error {
  margin: 0;
  color: #a2384b;
  font-size: 0.64rem;
  line-height: 1.35;
  font-weight: 600;
}
```

por:

```css
.checkout-email-error {
  margin: 0;
  color: #a2384b;
  font-size: 0.85rem;
  line-height: 1.4;
  font-weight: 600;
}
```

Só o `font-size` (e o `line-height`, que acompanha). Não mexer na cor nem no
peso — estão bons.

### 2. (opcional, mesma tela) Mensagem específica em vez de vaga

Arquivo: `artifacts/perguntas-de-conexao/src/App.tsx`, linha ~3556.

Hoje, quando a pessoa digita um e-mail com formato errado, a mensagem é
`"Confira o e-mail — parece que falta alguma coisa."` — ela não diz o que
falta. Trocar por uma checagem do que está errado de fato:

```ts
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      const digitado = buyerEmail.trim();
      setEmailError(
        !digitado
          ? "Falta o e-mail pra liberar seu acesso."
          : !digitado.includes("@")
            ? "Falta o @ no e-mail."
            : "Falta o final do e-mail, depois do @ (ex.: gmail.com).",
      );
      const emailField = document.getElementById("checkout-email");
      emailField?.scrollIntoView({ behavior: "smooth", block: "center" });
      (emailField as HTMLInputElement | null)?.focus({ preventScroll: true });
      valid = false;
    }
```

A mensagem do campo vazio continua exatamente igual à de hoje — só os casos de
formato errado ficam específicos.

---

## POR QUÊ

**Item 1** — é a mesma família do bug que custou venda: a informação existe, mas
não chega na pessoa. Antes ela não existia; agora ela existe em corpo ~10px,
vermelho escuro, no celular, pra alguém apressado com o cartão na mão. O aviso
da barra de baixo (`.checkout-purchase-error`) já está em `0.85rem` — a
mensagem principal, que fica colada no campo e diz o que fazer, não deveria ser
a menor das duas. `0.85rem` alinha as duas.

**Item 2** — *The Science of Copywriting*, p.33-34, "Avoid Hedges, Disclaimers,
and Tag Questions": hedges reduzem credibilidade, e o livro lista **"Seems"**
nominalmente (Blankenship & Holtgraves, 2005). "Parece que falta alguma coisa"
é exatamente isso. Mas o motivo mais forte aqui nem é o livro: é que numa tela
de pagamento a pessoa precisa saber **o que** corrigir, não que algo está
vagamente errado.
