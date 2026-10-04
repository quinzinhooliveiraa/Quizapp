# Prompt 104c — conserto do 104a: Pix não gera sozinho com e-mail do quiz (+ 3 ajustes pequenos)

*Otimizador, 04/10/2026. Origem: a Qualidade testou o 104a no ar (commits 3d0a27f e 1686ef9) e achou que o **item 8 não foi feito**. Código conferido em `codigo/Quizapp`: o `useEffect` do Pix em `App.tsx` (~linha 7943) ainda roda sem `emailTouched`; `emailTouched` e o botão "Gerar meu Pix" não existem. O `emailOrigin` (typed/prefill/resume) já é enviado, isso está feito.*

**Por quê (a conta):** quem chega ao checkout com o e-mail do quiz vê o Pix nascer sozinho em ~3 s, sem tocar em nada. Isso cria sessão/Pix para quem só abriu (sujeira nos números de "checkout/Pix gerado", Pix que vence, e foi justamente o que o 104a quis evitar: 13 de 20 saíram em 15 s sem digitar nada). Custo: nenhum no preço; risco: baixo, mexe só no gatilho do Pix.

**Não mexe em preço, janela de 10 min, `offers.ts`, schema do banco, cartão/`walletPreload`, nem no layout do checkout.** Só App.tsx (checkout) e Admin.tsx, mais a linha de `lead_source` fica **fora** (ver "Fora deste prompt").

Cole isto no agente do Replit:

---
Implemente os 4 itens abaixo, **nesta ordem**. Use as classes e componentes que já existem. Arquivos: `artifacts/perguntas-de-conexao/src/App.tsx` (`CheckoutModalContents` / `useCheckout`) e `artifacts/perguntas-de-conexao/src/pages/Admin.tsx`. Não adicione nada no schema do banco.

### 1. (O ESSENCIAL) Pix só gera quando a pessoa age: `emailTouched` + botão "Gerar meu Pix"
Hoje, com `buyerEmail` válido e `selectedPaymentMethod === "pix"`, o `useEffect` que chama `createCheckout("couple", normalizedEmail, "", true)` roda ao abrir o checkout. Mude assim:

a) Crie `const [emailTouched, setEmailTouched] = useState(Boolean(resumeSessionId))` **dentro do `useCheckout` (junto de `nativeCheckout`, ~linha 6196) e devolva `emailTouched`/`setEmailTouched` no `return` do hook. NÃO crie dentro de `CheckoutModalContents`**: esse componente é desmontado e remontado quando `cardCheckout` aparece/some (o `CheckoutModal` troca entre `<CheckoutModalContents/>` e `<Elements><CheckoutModalContents/></Elements>`, ex.: walletPreload ao abrir, ou `restartCheckout` no erro de cartão), e o estado local voltaria a `false`, quebrando o Pix do 109 e o Pix de quem já digitou. (Começa `true` só no `/retomar`; nos outros casos começa `false`.) Use `setEmailTouched(true)` quando a pessoa:
   - digita no `#checkout-email` (no `onChange`, junto do `setBuyerEmailFromUser`);
   - aceita "Você quis dizer…?" ou toca em "Não, está certo" (`setEmailDismissed`);
   - toca em qualquer botão/aba de pagamento (dentro de `handlePaymentMethodSelect`, antes de qualquer coisa);
   - toca em "Pague no Pix" (a função `handleCardErrorPixClick` já passa por `handlePaymentMethodSelect`, mas marque `true` também no começo dela, explicitamente);
   - **quando o Pix automático do erro de bandeira (109) dispara**: em `handleCardError`, no ramo `isUnsupportedBrandError(...)`, chame `setEmailTouched(true)` **antes** de `handleCardErrorPixClick()`. O 109 tem que continuar gerando o Pix sozinho nesse caso.

b) No `useEffect` do auto-gerar (o que tem `createCheckout("couple", normalizedEmail, "", true)`), **NÃO coloque `emailTouched` no `return` antecipado do topo** (isso mataria também o ramo do cartão). Mude só a condição do ramo do Pix para `selectedPaymentMethod === "pix" && emailTouched && (!nativeCheckout || pixEmailMismatch)` e inclua `emailTouched` nas dependências. O ramo do cartão desse efeito e o `walletPreload` **não mudam**.

c) Em `handlePaymentMethodSelect`, o `createCheckout` do Pix que ele já chama continua (a pessoa tocou, é intencional).

d) Onde hoje aparece "Preencha seu e-mail acima e o QR aparece aqui." (~linha 8242): se `hasValidBuyerDetails && !emailTouched`, mostre no lugar um botão primário `button button-primary button-full` com o texto **Gerar meu Pix** e `data-testid="button-generate-pix-prefilled"`, que faz `setEmailTouched(true)` e `void createCheckout("couple", normalizedBuyerEmail, buyerName, true)`. Se o e-mail está vazio/inválido, mantenha o texto atual.

e) `/retomar` não muda (o Pix já vem pronto; `emailTouched` já começa `true` lá). Quem digita o e-mail no checkout continua exatamente como hoje (Pix gerado ao completar o e-mail).

### 2. Pix velho de outro e-mail
Hoje, se a pessoa muda o e-mail depois que já existe um Pix, "Pague no Pix" mostra o Pix do e-mail anterior.
- Acrescente `buyerEmail?: string` em `NativeCheckoutData` e preencha com `normalizedEmail` em `createCheckout` (onde monta `const pix: NativeCheckoutData = {...}`). Pix restaurado do storage ou do `/retomar` sem esse campo conta como "igual" (não regenere nada).
- Considere o Pix "do e-mail errado" quando `nativeCheckout?.buyerEmail && nativeCheckout.buyerEmail !== normalizedBuyerEmail`. Nesse caso: **não mostre o QR/código antigo** (mostre o estado de "Gerando seu código Pix…" ou o botão do item 1d se `!emailTouched`) e gere um novo para o e-mail atual, **uma vez por e-mail** (use um `useRef` com o último e-mail tentado para não entrar em loop) e respeitando `emailTouched` e `paymentCreating`. Vale tanto para o `useEffect` quanto para `handlePaymentMethodSelect` e `handleCardErrorPixClick`.
- Não gere Pix para e-mail que ainda não é válido (`hasValidBuyerDetails`).
- **Debounce obrigatório no `useEffect` (só no ramo de regerar por e-mail diferente):** a regex aceita `joao@gmail.c`, então quem digita `joao@gmail.com` geraria 3 Pix (um por e-mail válido intermediário) e piscaria o QR. Use `setTimeout` de ~900 ms antes de chamar `createCheckout` nesse ramo, com `clearTimeout` no cleanup do efeito. Toques explícitos (`handlePaymentMethodSelect`, botão 1d, botão principal) geram na hora, sem debounce e **sem** olhar o `useRef` (o ref só serve para o efeito não repetir depois de uma falha).
- **Calcule uma vez `const pixEmailMismatch = ...` e `const activePix = nativeCheckout && !pixEmailMismatch ? nativeCheckout : null` e use `activePix` no lugar de `nativeCheckout` em `CheckoutModalContents`** (render do QR ~8127, `!(selectedPaymentMethod === "pix" && nativeCheckout)` da barra de compra ~8471, `handleInitialCheckout` ~8056 `if (!nativeCheckout)`, `handlePaymentMethodSelect` ~7868). Sem isso, o QR do e-mail errado some mas a barra de compra continua escondida e o botão principal não regenera.
- `handleInitialCheckout` (botão principal) também deve chamar `setEmailTouched(true)` no começo (é toque intencional).

### 3. Admin: hora no "ativa desde" e linha do critério da #13
Em `Admin.tsx`:
- Nos dois lugares que mostram "Configuração ativa desde …" (~linha 1379) e "Ativo desde …" (~linha 2010), troque `toLocaleDateString("pt-BR")` por data **e hora** em Brasília: `toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })`.
- No bloco "Funil de e-mail e acesso", embaixo dos números, acrescente uma linha: se `data.emailFunnel.started >= 80` e `data.completionRate < 45`, em vermelho: **"Critério da #13 atingido: troque 'E-mail no quiz' para Opcional."** Senão, em texto normal: `"{started} inícios · {completionRate}% chegaram à oferta"`. (`completionRate` já vem do `GET /admin/quiz-analytics` e é completados ÷ visitantes; não crie campo novo.) Mantenha o rótulo "Opcional" que já existe no seletor.

### 4. Privacidade no Clarity
No input de e-mail da tela do quiz (`className="lp1-quiz-capture-input"`, `data-testid="input-lp1-quiz-email"`, ~linha 3435) e no `#checkout-email`, acrescente o atributo `data-clarity-mask="true"` para a gravação não mostrar o e-mail digitado.

### Teste antes de subir
1. Quiz do zero com e-mail → oferta → abrir o checkout: o e-mail está lá e **nenhum Pix é gerado** (Network sem `/api/checkout/create` de Pix); aparece "Gerar meu Pix"; tocar gera o Pix pelo preço da oferta.
2. Abrir o checkout sem e-mail lembrado e digitar um e-mail válido: o Pix gera sozinho como antes.
3. Com e-mail pré-preenchido, tocar na aba Cartão e voltar para Pix, ou tocar "Pague no Pix": gera.
4. Teste do 109 com e-mail pré-preenchido: erro de bandeira (simule com `handleCardError("Este tipo de cartão não é aceito. Tente usar outro.", { type: "validation_error" })`) → troca para Pix e o Pix gera sozinho com a mensagem do 109.
5. Gere o Pix e depois troque o e-mail por outro válido: o QR antigo some e vem um novo para o e-mail novo (mesmo e-mail digitado de novo não gera outro). `/retomar/{id}` continua abrindo com o Pix pronto.
6. Com e-mail pré-preenchido, deixe o walletPreload do cartão terminar (aguarde ~3 s com o checkout aberto, o que remonta o componente), depois digite um e-mail novo: o Pix tem que gerar (prova de que `emailTouched` não se perde). Digite um e-mail devagar: só 1 chamada `/api/checkout/create` de Pix no fim.
7. Portugal/EUR (`?region=pt` ou como o app simula): sem aba Pix, cartão funciona como antes, nenhum botão "Gerar meu Pix".
8. Admin: "ativa desde" mostra dd/mm/aa e hora; a linha do critério aparece. Preço cheio, preço de oferta e janela de 10 min iguais a antes (`/api/offer/state`). `pnpm run typecheck` sem erro; nada mudou em `lib/db`.

**Commit:** um só: `104c: Pix só gera com toque (emailTouched) + Pix do e-mail atual + admin hora/critério + clarity mask`

### AO TERMINAR: responda com esta lista, item por item
Para **cada** item (1a, 1b, 1c, 1d, 1e, 2, 3 hora, 3 critério, 4 quiz, 4 checkout) escreva **FEITO** ou **NÃO FEITO** com o arquivo e a linha onde está. Não pule nenhum e não agrupe. Se algo não foi feito, diga por quê. Cole também o trecho do `useEffect` do Pix já corrigido.

---

## Fora deste prompt (de propósito)
- **`lead_source`** (grava typed/prefill/resume em vez de checkout/checkout_prefill/retomar): o 104b **não lê** `lead_source` (conferido), então não bloqueia nada. É só rótulo: a divisão fica com os nomes crus até alguém precisar. Corrigir exige mexer em `connection.ts` e o admin; fica para depois, junto do próximo ajuste de back.

## Depois do deploy (Quinzinho)
1. Confira o commit "104c: …" no GitHub e anote a hora (site atualiza ~10 min depois).
2. Chame a 🧪 Qualidade para repetir os testes 1, 4 e 5 no ar. Só então siga para o **104b**.
