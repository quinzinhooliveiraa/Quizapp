# Prompt 111 — conserto do /retomar: preço certo para quem já abriu o checkout

*Otimizador, 05/10/2026. Origem: Qualidade 04/10 (achado 2 do 104c) + Preço 05/10 (`empresa/estudos/cursos/debate-preco.md`, seção 2). Código conferido em `codigo/Quizapp` commit `816d432`: `artifacts/api-server/src/routes/connection.ts` linhas ~624-652 (`POST /checkout/create` com `resumeSessionId`) e ~1111-1137 (`GET /checkout/resume/:sessionId`). Estado atual: o 104b (e-mails) e o 104c (`emailTouched`) estão no ar; este prompt não mexe neles.*

**O problema (a conta):** ao abrir o checkout, o `walletPreload` cria uma sessão com `paymentMethod` e `lockedPriceCents` gravados com o preço **daquele momento**. No `/retomar`, a variável `hasLockedPaymentPrice` faz o preço gravado vencer sempre. Resultado hoje:
- abriu o checkout **depois** da janela de 10 min: fica em **R$ 47,90 para sempre** (nunca recebe o desconto de 5 dias que a regra e os e-mails prometem);
- abriu **dentro** da janela: fica em **R$ 29,90 sem prazo** (o "acaba em X" dos e-mails vira falso, e isso quebra a regra 2: nada de escassez falsa).

Recuperar a R$ 29,90 dá margem de R$ 24,50 por venda; a R$ 47,90 dá R$ 39,69. O ganho aqui é pequeno em reais (uns R$ 5 a 20 por semana hoje) e **grande em honestidade**: o prazo dos e-mails passa a ser verdadeiro. Confiança: alta na direção, baixa no valor.

**Regra decidida pelo Preço (05/10):** no `/retomar`, durante os 5 dias (`ABANDONED_CHECKOUT_DISCOUNT_MS`) o cliente paga `min(preço gravado, oferta atual = R$ 29,90)`. Passados os 5 dias, paga o preço cheio (R$ 47,90). **Única exceção:** um Pix já gerado e ainda válido (< 15 min, `pixExpiresAt > agora`) mantém o preço dele, para não trocar o QR de quem está pagando.

**NÃO mexe em:** preço da página, `offers.ts`/`pricing.ts`, janela de 10 min (teste #7 em andamento), a sequência de e-mails do 104b, `emailTouched`/botão "Gerar meu Pix" do 104c, schema do banco, front (`App.tsx`: ele já lê `lockedPriceCents` e `discountValidUntil` da resposta), Portugal/EUR (ver abaixo). Só `connection.ts`.

**Portugal/EUR:** não se aplica. O `/retomar` e os e-mails usam `getOfferPricing("BR")` fixo e os leads são BRL; PT não tem sequência de recuperação. Não crie lógica em EUR. O caminho de PT (checkout sem `resumeSessionId`) tem que ficar byte a byte igual.

Cole isto no agente do Replit:

---
Implemente os itens abaixo, **nesta ordem**. Só o arquivo `artifacts/api-server/src/routes/connection.ts` (pode criar o helper no próprio arquivo ou em `artifacts/api-server/src/lib/abandoned-checkout-constants.ts`; sem mudar schema do banco, sem mexer em `lib/db`).

### 1. Uma função só para decidir o valor do /retomar
Crie `resolveResumeAmountCents({ session, anchorAt, now })`, pura, que devolve centavos, usando `getOfferPricing("BR")`:
- `full = full.amountCents`, `offer = offer.amountCents`.
- `discountActive = anchorAt.getTime() + ABANDONED_CHECKOUT_DISCOUNT_MS > now`.
- `target = discountActive ? Math.min(session.lockedPriceCents ?? offer, offer) : full`.
- **Exceção do Pix válido:** se `session.paymentMethod === "pix"` e `session.pixBrcode` e `session.pixBrcodeBase64` e `session.pixChargeId` e `session.pixExpiresAt` existem e `session.pixExpiresAt.getTime() > now` e `session.lockedPriceCents !== null`, devolva `session.lockedPriceCents` (o Pix vale o preço dele).
- Caso contrário, devolva `target`.
- **Nunca** olhe `hasLockedPaymentPrice` para decidir preço. Esse é o bug.

### 2. `GET /checkout/resume/:sessionId` (~linhas 1111-1137)
a) Troque o cálculo de `resumeCents`/`hasLockedPaymentPrice`/`effectiveResumeCents` por `const effectiveResumeCents = resolveResumeAmountCents({ session, anchorAt, now: Date.now() })`. O `anchorAt` e o `discountValidUntil` ficam como hoje (lead: `leadCreatedAt`; senão `session.createdAt`), **com a única mudança do item 3c** (sessão com lead ligado usa o `createdAt` do lead). O prazo dos e-mails do 104b conta a partir dele.
b) **ATENÇÃO À ORDEM (armadilha):** hoje o `UPDATE ... lockedPriceCents = resumeCents` roda **antes** das comparações `session.lockedPriceCents === effectiveResumeCents` do Pix e do cartão. Se você gravar o novo valor antes, o ramo do cartão acha que o PaymentIntent antigo "bate" e devolve o `clientSecret` do valor errado. Portanto:
   - Só grave `lockedPriceCents` direto quando a sessão **ainda não tem tentativa de pagamento** (`session.paymentMethod` nem `pix` nem `card`), como o 104b já faz.
   - Para `pix`/`card`, **não grave antes**: deixe os ramos existentes compararem e, ao criar o Pix novo ou o PaymentIntent novo, gravarem `lockedPriceCents: effectiveResumeCents` (eles já fazem isso).
c) Confira o comportamento esperado de cada ramo depois da mudança:
   - Pix válido (< 15 min): reaproveita o mesmo QR e o mesmo preço.
   - Pix vencido (ou sem QR) com preço diferente do `effectiveResumeCents`: gera Pix novo no preço certo (o ramo `else if` existente já cobre; não duplique).
   - Cartão: se `lockedPriceCents === effectiveResumeCents` reaproveita o PaymentIntent; se não, cria um novo com `resumePricing` no valor certo.
   - `resumePricing` continua sendo `offer` se `effectiveResumeCents === offerCents`, senão `full` com `amountCents: effectiveResumeCents`.
d) Acrescente um `req.log.info` quando o valor mudar em relação ao gravado: `{ sessionId, de: session.lockedPriceCents, para: effectiveResumeCents, motivo }` com motivo `"desconto_5_dias"` / `"fora_dos_5_dias"` / `"pix_valido_mantido"`. É para a Qualidade e o Analista conferirem; não grave nada novo no banco.

### 3. `POST /checkout/create` com `resumeSessionId` (~linhas 624-652)
É o mesmo defeito: quem volta ao `/retomar` e troca para cartão, ou o `walletPreload` do cartão, cai aqui e hoje também obedece o preço gravado.
a) No bloco `if (resumeSession)`, troque o `hasLockedPaymentPrice`/`discountIsActive` por `resolveResumeAmountCents(...)`, **mas aqui a exceção do Pix válido NÃO vale**: quem escolhe cartão ou pede Pix novo paga sempre `target` (o mais baixo permitido), nunca é cobrado mais caro por ter um Pix antigo. Implemente passando `ignorePixException: true` ao helper (ou calculando `target` direto).
b) Âncora do prazo: use `createdAt` do lead ligado à sessão (`quizLeadsTable.sessionId = resumeSession.id`) se existir, senão `resumeSession.createdAt`. É o mesmo critério dos e-mails (`candidate.createdAt`), para o GET e o POST nunca discordarem.
c) Faça o mesmo ajuste de âncora no GET quando a sessão veio por id direto e tem lead ligado: use o `createdAt` do lead ligado (hoje o `SELECT` do `linkedLead` só pega `id` e `offerSeenAt`; inclua `createdAt`). Para `isLeadResume` continua `leadCreatedAt`.
d) `pricing` continua sendo `resumePricing.offer` quando o valor for `offerCents`, senão `resumePricing.full` com o `amountCents` calculado. O resto do `POST` (Meta, tracking, Pix, Stripe) não muda. O ramo **sem** `resumeSession` (janela de 10 min por `visitorKey`) **não muda nada**.

### 4. Pontas soltas que NÃO devem mudar (confira no diff)
- `ABANDONED_CHECKOUT_DISCOUNT_MS` continua a mesma constante (5 dias).
- Webhooks do Stripe/AbacatePay continuam liberando o acesso pela sessão, sem checar valor. Não adicione checagem de valor neles.
- O endpoint de verificação do cartão (`paymentIntent.amount !== session.lockedPriceCents`) não muda.
- Nada em `abandoned-checkout.ts` (job dos e-mails).
- **Sessão já paga no `/retomar`:** o `409 "Este checkout já foi pago"` do POST, o `accessGranted` na resposta do GET e o redirecionamento do front para `/post-purchase` ficam **exatamente como estão** (o prompt 110, do upsell, depende disso e será colado depois). Não toque em `App.tsx`, `stripe.ts` nem nos webhooks.

### Teste antes de subir (use sessões de teste `internal`, UTM `qa-interno`)
Monte as sessões direto no banco ou pela API, mudando `created_at` do lead/sessão para simular o dia:
1. Sessão com cartão gravado a **R$ 47,90** (aberta fora da janela), lead com 1 dia → `/retomar/{id}` abre com **R$ 29,90** e um PaymentIntent novo de 2990 (Stripe). Confira os três juntos: o `clientSecret` devolvido pertence a um PaymentIntent de 2990 no Stripe, `sessions.locked_price_cents` = 2990 e `stripe_payment_intent_id` é o novo (é o teste da armadilha do 2b). Pague com 4242 em modo teste e veja o `/checkout/card/verify` aceitar.
2. Sessão com cartão gravado a **R$ 29,90**, lead com 3 dias → continua **R$ 29,90**, mesmo PaymentIntent (não cria outro).
3. Sessão com cartão gravado a R$ 29,90, lead com **6 dias** → abre com **R$ 47,90** (PaymentIntent novo de 4790). O `discountValidUntil` da resposta já é passado.
4. Sessão com Pix a R$ 47,90 gerado há **5 min** (válido) → `/retomar` devolve o **mesmo** QR e R$ 47,90 (exceção).
5. Mesma sessão com o Pix **vencido** (> 15 min), lead com 1 dia → Pix **novo** a R$ 29,90.
6. Sessão sem tentativa de pagamento (`paymentMethod` nulo), lead com 1 dia → R$ 29,90 e, com 6 dias, R$ 47,90 (igual ao 104b).
7. Na tela `/retomar/{id}` (375px): o valor mostrado, o contador e o QR/cartão batem com a resposta da API. Trocar de Pix para Cartão e voltar não muda o valor para cima.
8. Checkout normal (sem `/retomar`): janela de 10 min igual a antes (`/api/offer/state`), R$ 29,90 dentro e R$ 47,90 fora. Pix só gera com toque (104c) continua valendo.
9. Portugal/EUR (`?region=pt`): checkout igual a antes, sem aba Pix, nenhum `resolveResumeAmountCents` no caminho.
10. `pnpm run typecheck` sem erro; nenhuma mudança em `lib/db` nem em `offers.ts`/`pricing.ts`. Se o `api-server` já tiver teste automatizado, acrescente um teste da função pura com os casos 1-6; se não tiver, **não instale framework**.

**Commit:** um só: `111: /retomar reprecifica por min(gravado, oferta) por 5 dias, cheio depois; Pix válido mantido`

### AO TERMINAR: responda com esta lista, item por item
Para **cada** item (1, 2a, 2b, 2c, 2d, 3a, 3b, 3c, 3d, 4) escreva **FEITO** ou **NÃO FEITO** com o arquivo e a linha onde está. Não pule nenhum e não agrupe. Se algo não foi feito, diga por quê. Cole também o corpo de `resolveResumeAmountCents` e o trecho do `GET /checkout/resume` que decide `effectiveResumeCents` e grava `lockedPriceCents`.

---

## Riscos (para o Quinzinho e a Qualidade)
1. **Ordem do `UPDATE` (o mais perigoso):** gravar o valor novo antes de comparar com o PaymentIntent faz o cartão devolver o `clientSecret` do valor antigo (cobra R$ 47,90 achando que é 29,90 na tela). Está no item 2b e é o primeiro que a Qualidade deve olhar.
2. **GET e POST discordando do prazo:** se um usar `session.createdAt` e outro o `createdAt` do lead, a tela mostra um valor e o pagamento cobra outro. Itens 3b e 3c existem por isso.
3. **PaymentIntent antigo continua aberto no Stripe** (e Pix antigo no Abacate): se a pessoa pagar o antigo numa aba esquecida, o webhook libera o acesso mesmo assim (comportamento atual, bom para o cliente), mas o evento do Meta usa o `lockedPriceCents` novo. Valor pequeno e raro; não cancelar PaymentIntent neste prompt.
4. **Impacto em dinheiro e no teste #7:** pequeno e na direção certa. Não reinicia o relógio da #7 (a regra vale igual nos dois períodos); anotar no diário a hora do deploy. **Tem que estar no ar antes do anúncio de sexta.** Se não der, segurar até 01/11 para não mudar regra no meio do período com tráfego pago.

5. **Conflito com o 110:** os dois mexem em `connection.ts`. O 111 vai primeiro; ele só altera o cálculo de preço, então o 110 entra por cima sem conflito de lógica (só de linhas, se houver).

## Depois do deploy (Quinzinho)
1. Confira o commit "111: …" no GitHub e anote a hora (site atualiza ~10 min depois).
2. Chame a 🧪 Qualidade para repetir os testes 1, 3, 4, 5 e 7 no ar (e 8 e 9 como regressão). Só depois avise o Tráfego que o anúncio de sexta pode sair.
