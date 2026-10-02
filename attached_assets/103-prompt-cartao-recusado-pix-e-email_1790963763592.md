# Prompt para o Replit — cartão recusado vira Pix + e-mail com erro de digitação + registro do erro (02/10/2026)

**Por quê:** gravação do Clarity `1okj390` (02/10 11:43, Stripe `pi_3UM7k0…`): a pessoa fez o quiz, escolheu cartão, levou "Este tipo de cartão não é aceito. Tente usar outro." e foi embora. A tela não ofereceu Pix. E o e-mail dela estava errado (`...@gmail.comb`), então nem a recuperação chega. Relatório: `empresa/dados/2026-10-02-clarity-gravacoes-oferta.md`.

**Correção de bug, não teste:** não muda preço, oferta, texto da página nem layout. Vale igual para R$ 29,90 e R$ 37,90, então não suja o teste da decisão #7. Suba **hoje**, para os dois períodos do teste terem a correção.

Cole isto no agente do Replit:

---
Faça só estas 3 mudanças no checkout, nada mais. Não mexa em preço, em `offers.ts`, na janela de 10 minutos, em textos ou no layout existentes.

### 1. Cartão falhou → oferecer Pix na hora (só quando o Pix existe, ou seja, Brasil)
Arquivo: `artifacts/perguntas-de-conexao/src/App.tsx`, componente `CheckoutModalContents`.

- Hoje, quando o cartão (ou Apple/Google Pay) falha, `handleCardError` só põe a mensagem em `cardError`, que aparece em `<p className="checkout-purchase-error">` acima do botão "Quero meu acesso" (e também perto da linha ~8016).
- Logo abaixo dessa mensagem de erro, **somente se** `cardError` não estiver vazio **e** `checkoutPricing.pixAvailable === true`, mostre um bloco pequeno:
  - Texto: **"Pague no Pix — mesmo preço ({checkoutPricing.display})"**
  - Um botão: **"Gerar meu Pix"** (`data-testid="button-card-error-pix"`).
- O botão chama `handlePaymentMethodSelect("pix")` (a função que já existe). Ela já troca a aba para Pix e, se o e-mail for válido, gera o Pix com o e-mail que a pessoa já digitou. Depois rola a tela até o código Pix (`.checkout-payment-card`, `scrollIntoView({ behavior: "smooth", block: "center" })`).
- Se o e-mail ainda não for válido, só troca para Pix e foca o campo de e-mail (`focusCheckoutEmail()`).
- Use as classes e cores que já existem (botão secundário/outline do checkout). Nada de componente novo grande.
- Faça o mesmo onde o `cardError` aparece no outro ponto (linha ~8016), se esse trecho também for exibido para o comprador.

### 2. E-mail com domínio digitado errado → "Você quis dizer …?"
Mesmo arquivo. Crie uma função pura `suggestEmailFix(email: string): string | null`:
- Separe usuário e domínio (`@`). Compare o domínio (minúsculo) com esta lista de correções. Se bater, devolva `usuario@dominioCorreto`; se não, `null`.
- Domínios certos: `gmail.com`, `hotmail.com`, `outlook.com`, `yahoo.com.br`, `yahoo.com`, `icloud.com`, `live.com`, `bol.com.br`, `uol.com.br`, `msn.com`.
- Corrigir pelo menos estes erros comuns:
  - gmail: `gmail.comb`, `gmail.con`, `gmail.cm`, `gmail.co`, `gmail.om`, `gmail.cmo`, `gmail.vom`, `gmail.xom`, `gmail.comm`, `gmail.com.br`, `gmial.com`, `gmal.com`, `gmaill.com`, `gamil.com`, `gnail.com`, `gmai.com`, `gimail.com`, `gmail.c`
  - hotmail: `hotmial.com`, `hotmal.com`, `hotmai.com`, `hotmaill.com`, `hotamil.com`, `hotmail.con`, `hotmail.comb`, `hotmail.co`, `hotmail.cm`, `hotmil.com`
  - outlook: `outlok.com`, `outloo.com`, `outlook.con`, `outlook.comb`, `outllok.com`
  - yahoo: `yaho.com.br`, `yahoo.com.b`, `yahoo.con.br`, `yhaoo.com.br`
  - icloud: `iclod.com`, `icloud.con`, `icoud.com`, `icluod.com`
- Regra genérica extra: se o domínio terminar em `.comb`, `.con`, `.cpm`, `.vom` ou `.xom`, troque essa terminação por `.com`.

No campo de e-mail do checkout (`id="checkout-email"`):
- Calcule `const emailSuggestion = suggestEmailFix(buyerEmail.trim().toLowerCase())`.
- Se houver sugestão, mostre logo abaixo do campo (no lugar do `checkout-email-error`, mesmo estilo de texto pequeno): **"Você quis dizer {sugestão}?"** com o e-mail sugerido como botão/link tocável. Ao tocar: `setBuyerEmail(sugestão)`, salva em `safeSetItem("conexao-pending-buyer-email", sugestão)` e some o aviso.
- Ao lado, um link pequeno **"Não, está certo"** que esconde o aviso para aquele e-mail (guarde num `useState` o e-mail que a pessoa confirmou).
- **Importante:** enquanto houver sugestão pendente (não aceita e não dispensada), trate o e-mail como **ainda não válido** para gerar o Pix e para salvar o comprador. Ou seja, inclua `!emailSuggestion || emailDismissed === buyerEmail` na condição `hasValidBuyerDetails` (ou equivalente) para o Pix não ser gerado com o e-mail errado. Só os domínios da lista disparam isso; qualquer outro e-mail segue como hoje.
- Aplique a mesma função nos outros campos de e-mail do checkout (`/retomar` usa o mesmo modal; confira).

### 3. Registrar o erro de cartão para o admin
**Front (`App.tsx`):**
- Em `CardPaymentForm` e `CheckoutWalletActions`, quando `result.error` (de `stripe.confirmPayment` ou `elements.submit`) existir, além da mensagem, passe também `type`, `code` e `decline_code` do erro. Ex.: mude `onError: (message: string) => void` para `onError: (message: string, info?: { type?: string; code?: string; declineCode?: string }) => void`. No `catch` genérico, mande `info = { type: "exception" }`.
- Em `handleCardError(message, info)`: se `info` existir, dispare um evento de rastreio `card_error`. Para isso:
  - Adicione `"card_error"` ao tipo `LandingTrackingEvent`.
  - Em `useCheckout`, permita que `onTrackingEvent` receba um terceiro parâmetro `extra` (o `trackCtaClick` de `useLpTracking` já aceita `extra`) e exponha uma função `trackCardError(info)` que chama `onTrackingEvent?.("card_error", undefined, { lastSection: \`${info.type ?? "-"}|${info.code ?? "-"}|${info.declineCode ?? "-"}|${selectedPaymentMethod}\`.slice(0, 80) })`.
  - **Não** envie número de cartão, nome, e-mail nem a mensagem completa. Só os códigos.
- Dispare no máximo 1 evento por tentativa de pagamento (não a cada render).

**Back (`artifacts/api-server/src/routes/tracking.ts`):**
- Adicione `"card_error"` em `EVENT_TYPES`. O código vai no campo `lastSection` que já existe na tabela `page_events` (sem migração de banco).
- Em `/admin/analytics` (ou no relatório que o admin já mostra), acrescente `cardErrors`: total no período e a lista dos últimos 20 (`createdAt`, `lastSection`, `device`, `claritySessionId`), excluindo `internal = true`.
- No painel admin, mostre uma linha simples **"Erros de cartão: N"** com a lista abaixo (data/hora de Brasília + código). Sem gráfico.

### Teste antes de subir
1. Stripe em modo de teste, cartão `4000 0000 0000 0002` (recusado): tem que aparecer a mensagem de erro **e** o bloco "Pague no Pix — mesmo preço (R$ 29,90)". Tocar em "Gerar meu Pix" gera o Pix com o e-mail já digitado.
2. No admin aparece "Erros de cartão: 1" com o código `card_error|card_declined|generic_decline|card` (ou parecido).
3. Digitar `teste@gmail.comb`: aparece "Você quis dizer teste@gmail.com?"; o Pix **não** é gerado até tocar na sugestão ou em "Não, está certo".
4. Digitar `teste@empresa.com.br`: nada muda em relação a hoje.
5. Com preço de Portugal (sem Pix): erro de cartão aparece **sem** o bloco do Pix.
6. O resto do checkout (preço, textos, ordem, cores, botão) fica idêntico.
---

Depois do deploy, anote a data e a hora em `empresa/estado-atual.md` ("103 no ar") e me avise: o Verificador confere ao vivo.
