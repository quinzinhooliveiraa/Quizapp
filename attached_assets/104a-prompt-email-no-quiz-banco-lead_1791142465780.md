*Revisado pela Qualidade 03/10 — v2 (sem mudanças no texto): os 3 🔴 da 1ª revisão (apiUrl, descadastro 404, schema só-adição com push --force) e os 🟡/🟢 (109 preservado, Pixel padrão, walletPreload, UTM) estão resolvidos e conferidos no código `64e2150`. Veredito: ✅ pode colar (depois do 109 testado).*

# Prompt 104a — e-mail obrigatório no quiz + lead + /retomar do lead + descadastro (decisão #13, colar na terça 06/10/2026)

*Otimizador, revisado 03/10/2026 com o relatório da Qualidade (`empresa/dados/2026-10-03-qa-base-e-revisao-104-109.md`). O 104 original foi dividido em **104a** (este: banco + quiz + lead) e **104b** (sequência de e-mails). Índice e ordem em `104-prompt-email-no-quiz.md`.*

**Ordem de colar:** 109 → testar → **104a** → testar → 104b → testar. O 104a tem que entrar **depois** do 109 e preservar o Pix automático do erro de bandeira.

**Por quê:** a sequência de 5 e-mails só pega quem digita o e-mail no checkout. No Clarity de 02/10, 13 de 20 que abriram o checkout saíram em até 15 s sem digitar nada. Pedir o e-mail no quiz, antes do resultado, é o que os quiz funnels fazem (Luvly, Mad Muscles).

**Isto reinicia o teste #7** (decisão #13): os 14 dias a R$ 29,90 contam a partir do deploy do **104a** (é ele que põe o e-mail no quiz no ar). O código grava a data e a hora (item 9).

**Não mexe em preço.** `offers.ts`, a janela de 10 min e os valores continuam iguais. O item 6 só faz o `/retomar` cobrar o preço que o e-mail já promete, também no cartão.

Cole isto no agente do Replit:

---
Implemente as mudanças abaixo, nesta ordem. Não mexa em preço (`artifacts/api-server/src/lib/offers.ts`), na janela de 10 minutos, na página de oferta (`Lp1SalePage`) nem no layout do checkout, a não ser onde está escrito. Use os componentes, classes e cores que já existem.

### REGRAS QUE VALEM PARA TUDO
- **Chamadas do front para a API: SEMPRE com `apiUrl(...)`** (em `App.tsx`) ou `` `${apiBaseUrl}/api/...` `` (em `Admin.tsx`, que importa `apiBaseUrl` de `@/config`). O front fica em www.perguntasdeconexao.com.br e a API fica no Railway (outro domínio): um `fetch("/api/...")` relativo dá 404 em produção. Nenhuma chamada nova pode começar com `fetch("/api`.
- **Banco: só ADICIONAR.** O `start` do api-server roda `drizzle-kit push --force` a cada boot, então o schema vira o banco de produção sozinho, sem perguntar. Por isso: no schema, só ADICIONE (2 tabelas novas e 3 colunas novas nullable em `sessions`). **Não renomeie, não remova e não mude o tipo de nada que já existe**, nem "para arrumar". Não rode `push-force` à mão e não rode push de dentro do Replit "no banco de produção" (o banco do Replit não é o do Railway; o boot já cria tudo).
- **Não mexer no 109:** o aviso "Elo, Hipercard ou Amex? Pague no Pix", o Pix automático no erro de bandeira e o `handleCardErrorPixClick` continuam funcionando (ver item 8).

### 1. Banco de dados (lib/db) — só adições
Em `lib/db/src/schema/index.ts`:
- Tabela nova `quiz_leads` (`quizLeadsTable`):
  `id` text PK (uuid) · `email` text not null (minúsculo) · `visitor_key` text not null · `lp_id` text · `region` text (`BR`/`PT`…) · `diagnosis_label` text · `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` text · `internal` boolean default false · `offer_seen_at` timestamptz · `session_id` text (sessão de checkout criada a partir do `/retomar`) · `abandon_email_1_at` … `abandon_email_5_at` timestamptz · `suppressed_at` timestamptz · `created_at` timestamptz default now().
  Índices em `visitor_key` e em `email`.
- Tabela nova `email_opt_outs`: `email` text PK, `created_at` timestamptz default now().
- Na tabela `sessions`, três colunas novas, todas nullable: `lead_source` text (valores: `checkout`, `checkout_prefill`, `retomar`, `retomar_quiz`), `abandon_suppressed_at` timestamptz e `resume_email_n` integer (usada no 104b).

Não precisa de SQL extra nem de migração manual: o boot cria.

### 2. Configuração "e-mail obrigatório ou pulável" (sem novo deploy)
- Em `app_settings` (mesmo padrão de `artifacts/api-server/src/lib/primary-landing-page.ts`), chave `quiz_email_mode` com valor `required` (padrão, quando não existe) ou `optional`.
- Rota pública `GET /api/quiz/email-config` → `{ mode: "required" | "optional" }` com `Cache-Control: no-store`.
- Rotas admin `GET` e `PATCH /api/admin/quiz/email-config?sessionId=…`, protegidas por `isAdminSession` igual às de `/admin/landing-pages/primary` em `artifacts/api-server/src/routes/admin.ts`.
- Em `artifacts/perguntas-de-conexao/src/pages/Admin.tsx`, logo abaixo do seletor de landing page principal: um seletor simples **"E-mail no quiz: Obrigatório / Pulável"** que salva na hora (chamadas com `${apiBaseUrl}/api/admin/quiz/email-config`).

### 3. Tela de e-mail no quiz (front)
Arquivo `artifacts/perguntas-de-conexao/src/App.tsx`. O quiz no ar é `Lp1Quiz` com `LP1_SCREENS = LP1_DEFINITIVE_SCREENS`. O tipo de tela `kind: "capture"` já existe e já é desenhado (input `lp1-quiz-capture-input`, link "ver sem e-mail →"). Reaproveite.

**3a. Posição.** Em `LP1_DEFINITIVE_SCREENS`, insira uma tela nova **entre** `s22-carregando` (loading com os 3 pop-ups) e `s24-clima` (resultado):
```ts
{
  id: "s23-email",
  kind: "capture",
  key: "email",
  eyebrow: "SEU RESULTADO ESTÁ PRONTO",
  title: "Para onde enviamos seu diagnóstico completo?",
  body: ["Você vê o resultado na próxima tela e recebe uma cópia no seu e-mail."],
  cta: "Ver meu resultado",
}
```
- O botão principal dessa tela mostra `current.cta` ("Ver meu resultado"), não o rótulo padrão.
- Voltar (←) a partir de `s23-email` vai para `s21-ultimo`, pulando o loading (para não repetir os pop-ups).

**3b. Obrigatório × pulável.** Ao montar o `Lp1Quiz`, busque `fetch(apiUrl("/api/quiz/email-config"))` (se falhar, use `required`).
- `required`: **esconda** o link "ver sem e-mail →" (`button-lp1-quiz-skip-email`) e troque o erro para **"Digite um e-mail válido para ver seu resultado."**
- `optional`: mantém o link "ver sem e-mail →" e o erro atual.

**3c. Aviso de LGPD** (texto pequeno, logo abaixo do input, cor do texto secundário do quiz):
"Usamos seu e-mail só para enviar seu diagnóstico e mensagens do Perguntas de Conexão. Você sai quando quiser, com 1 clique. " + link **"Política de privacidade"** para `/privacidade` com `target="_blank" rel="noopener"`.

**3d. Validação com "Você quis dizer…?".** Reaproveite `suggestEmailFix` (já existe em `App.tsx`, prompt 103), com o mesmo comportamento do checkout:
- Se houver sugestão, mostre embaixo do input: **"Você quis dizer {sugestão}?"** (tocável: troca o e-mail pela sugestão) + **"Não, está certo"** (esconde para aquele e-mail).
- Enquanto a sugestão estiver pendente, "Ver meu resultado" **não avança**.
- Regex de validade igual ao checkout.

**3e. Input.** `font-size: 16px` no `.lp1-quiz-capture-input` (abaixo disso o iPhone dá zoom). `data-clarity-mask="true"` no input. `type="email"`, `autocomplete="email"`, `inputmode="email"`.

**3f. UTM.** Hoje `getQuizAttribution()` lê só a URL atual (`/quiz?from=lp1`), que já perdeu os `utm_*`. Ajuste: quando qualquer LP ou o quiz abrir com `utm_*` na URL, guarde-os em `sessionStorage` (`pdc-utm`, só se ainda não existir); `getQuizAttribution()` usa a URL atual e, se vier vazia, o que está em `pdc-utm`. (Isso também melhora o UTM de `quiz_answers`.)

**3g. Ao enviar um e-mail válido** (em `handleNext`, no ramo `current.kind === "capture"`):
1. `const email = answers.email.trim().toLowerCase()`.
2. `safeSetItem("conexao-pending-buyer-email", email)` e `safeSetItem("conexao-email-origin", "quiz")`. É assim que o checkout vem pré-preenchido.
3. Calcule o diagnóstico com as funções que a tela de resultado já usa: `const result = computeLp1DistanceResult(answers)` e `const urgency = getLp1UrgencyMessage(answers, result.routineValue, result.label)`.
4. `fetch(apiUrl("/api/quiz/lead"), { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({...}) })` com `{ email, visitorKey: getOrCreateVisitorKey(), lpId, diagnosisLabel: result.label, diagnosisCopy: urgency.copy, internal: isInternalTrackingEnabled(), ...getQuizAttribution() }`. **Não espere** a resposta para avançar; em caso de erro, `console.warn` e segue.
5. Pixel: `trackMetaPixelEvent("Lead", {}, createMetaEventId("Lead"))` uma vez. **Sem o 4º argumento `true`**: "Lead" é evento PADRÃO da Meta (o `true` manda como `trackCustom` e a otimização por Lead não enxerga).
6. `advance()`.

### 4. Eventos para medir
Use `trackLp1QuizAnswer` (grava em `quiz_answers` com UTM). **Nunca** mande o e-mail como `answerValue`.
- `quiz_email_view`: quando a tela `s23-email` aparece, 1 vez por visitante por sessão (`sessionStorage`) → `screenId: "s23-email", answerKey: "quiz_email_view", answerValue: "true"`.
- `quiz_email_submit`: no envio válido → `answerValue: "true"`. Se a pessoa usar "ver sem e-mail" (modo pulável) → mesmo `answerKey`, `answerValue: "skip"`.
- `quiz_result_view`: quando `Lp1ResultScreen` monta, 1 vez por sessão → `screenId: "quiz-result", answerKey: "quiz_result_view", answerValue: "true"`.
- O `quiz-complete` existente continua igual (é o "chegou à oferta").

### 5. API do lead + e-mail de diagnóstico (back)
Arquivo novo `artifacts/api-server/src/routes/quiz-leads.ts`, registrado em `routes/index.ts`. CORS igual às outras rotas públicas (o front chama de outro domínio).

**`POST /api/quiz/lead`**
- Valida o e-mail (regex simples, máx. 254 caracteres) e o `visitorKey` (máx. 120). Rate limit por IP igual ao de `/access/check-email` em `connection.ts`.
- Região com `resolveRegion` (igual a `/checkout/create`).
- Se já existe `quiz_leads` com o mesmo `visitor_key` nos últimos 7 dias e ainda sem `abandon_email_1_at`, **atualiza** o e-mail (a pessoa corrigiu). Senão, cria uma linha nova.
- Se o e-mail está em `email_opt_outs`, grava o lead mas não manda nada.
- Manda **na hora** o e-mail de diagnóstico (só 1 por lead) via `sendEmailViaBrevo` (`lib/brevo.ts`). É o que a tela prometeu, então tem que chegar:
  - Assunto: **"Seu diagnóstico: {diagnosisLabel}"**
  - Corpo (texto + HTML no mesmo estilo dos e-mails de `buildAbandonedCheckoutEmail`, assinado Joaquim):
    "Oi. Aqui é o Joaquim, do Perguntas de Conexão. Pessoa de verdade, não robô."
    "Seu resultado do teste — risco de continuar no automático: **{diagnosisLabel}**."
    "{diagnosisCopy}"
    "A boa notícia? Você não precisa esperar isso virar um problema maior para mudar uma noite."
    Só região BR: "Seu acesso com o preço de oferta está aqui: {PUBLIC_BASE_URL}/retomar/{lead.id}". Outras regiões: link para `{PUBLIC_BASE_URL}/quiz`.
    "Este score de conexão é informal e serve apenas para reflexão. Ele não substitui uma avaliação clínica."
    "Joaquim"
    + rodapé de descadastro (item 7).
- Responde `{ ok: true }` (nunca devolve dados do lead).

**Marcar quem viu a oferta:** em `artifacts/api-server/src/routes/offers.ts`, na rota `POST /offer/start`, depois de `startOfferWindow`, rode
`UPDATE quiz_leads SET offer_seen_at = now() WHERE visitor_key = $visitorKey AND offer_seen_at IS NULL`. Se der erro, só loga; a oferta tem que abrir igual.

### 6. `/retomar` com o id do lead + cartão pelo mesmo preço
**6a. `/retomar/{id}` precisa funcionar com o id do lead** (o e-mail de diagnóstico já manda esse link). Em `GET /checkout/resume/:sessionId` (`artifacts/api-server/src/routes/connection.ts`):
- Se não achar sessão com esse id, procure em `quiz_leads`.
  - Se o lead já tem `session_id`, use essa sessão (fluxo normal).
  - Se não tem, crie uma sessão nova: `buyerEmail = lead.email`, `buyerName` = parte antes do @, `paymentMethod = "pix"`, `packageId "couple"` / `packageName "Pacote Casal"` / `inviteLimit 1`, `visitorKey = lead.visitor_key`, `sourceLp = lead.lp_id`, `currency "BRL"`, `internal = lead.internal`, `lead_source = "retomar_quiz"` e **`createdAt = lead.created_at`** (os 5 dias de desconto contam do dia do quiz). Grave `lead.session_id`. Daí em diante, o fluxo é o que já existe.
- A resposta continua com o `sessionId` da sessão (o front já usa `data.sessionId`).

**6b. Cartão no `/retomar` com o mesmo preço do e-mail** (bug de hoje: no `/retomar`, quem troca de Pix para cartão cai em `/checkout/create` sem janela ativa e paga o cheio):
- Front: quando o checkout foi aberto pelo `/retomar` (`resumeSessionId` em `useCheckout`), mande `resumeSessionId` no corpo das chamadas a `/api/checkout/create` (Pix, cartão **e** o pré-carregamento `walletPreload`).
- Back (`/checkout/create`): se vier `resumeSessionId` de uma sessão que existe, não está paga, região BR e `createdAt + 5 dias > agora` → use `offerPricing.offer` em vez de `full`. Senão, regra de hoje. Acrescente o campo no OpenAPI (`lib/api-spec`) e regenere o `lib/api-zod` (o `CreateCheckoutBody` é gerado de lá e descarta campos que não conhece).

### 7. Descadastro (LGPD)
- API: `POST /api/email/sair/:id` (o id pode ser de `sessions` ou de `quiz_leads`): acha o e-mail, insere em `email_opt_outs` (idempotente), responde `{ ok: true }`. Id desconhecido → `{ ok: true }` também (não revela nada).
- Front: rota nova **`/sair/:id`** no `Router` de `App.tsx` (ao lado de `/retomar/:sessionId`). Ao abrir, chama `fetch(apiUrl("/api/email/sair/" + id), { method: "POST" })` e mostra uma página simples no estilo da marca (fundo vinho, sem layout novo): "Pronto. Você não vai receber mais e-mails do Perguntas de Conexão." Se a chamada falhar: "Não consegui agora. Responda qualquer e-mail nosso com 'sair' que eu tiro você na mão."
- O link de descadastro aponta para o **front**: `{PUBLIC_BASE_URL}/sair/{id}`. **Não** use `{PUBLIC_BASE_URL}/api/...`: `PUBLIC_BASE_URL` é o domínio do front, onde `/api/*` dá 404.
- Rodapé (última linha pequena) em **todos** os e-mails de `buildAbandonedCheckoutEmail` (já agora, nos 5 atuais) e no de diagnóstico: "Não quer mais receber? Sair da lista: {PUBLIC_BASE_URL}/sair/{id}".
- No job atual de `sendAbandonedCheckoutEmails`, não mandar para e-mail que esteja em `email_opt_outs`.
- E-mails de compra/acesso (transacionais) **não** checam opt-out.

### 8. Checkout: e-mail pré-preenchido não gera Pix sozinho + origem do lead
Arquivo `App.tsx`, `useCheckout` / `CheckoutModalContents`.
- Hoje, se `buyerEmail` já vem preenchido, o `useEffect` que chama `createCheckout("couple", normalizedEmail, "", true)` gera o Pix **ao abrir**, sem a pessoa tocar em nada. Mude assim:
  - Crie `emailTouched` (useState, começa `false`). Vira `true` quando a pessoa: digita no `#checkout-email`; aceita "Você quis dizer…?"; toca em "Não, está certo"; toca em qualquer botão de pagamento; **toca em "Pague no Pix" (o botão do 103 e a linha do 109, ou seja, `handleCardErrorPixClick`)**; ou **quando o Pix automático do erro de bandeira do 109 dispara** (marque `emailTouched = true` ali antes de trocar para Pix).
  - O auto-gerar do Pix (o `useEffect`) só roda se `emailTouched === true`. Quem digita o e-mail no checkout continua igual a hoje.
  - Se o e-mail veio pré-preenchido e válido e a pessoa ainda não tocou em nada: no lugar de "Preencha seu e-mail acima e o QR aparece aqui." mostre um botão primário **"Gerar meu Pix"** (`data-testid="button-generate-pix-prefilled"`), que marca `emailTouched = true` e gera o Pix. É 1 toque.
  - O `/retomar` não muda (lá o Pix já vem pronto do servidor).
  - Não mexa no comportamento do pré-carregamento do cartão/carteira (`walletPreload`), só nos campos que ele manda (abaixo).
- **Origem do lead:** mande `emailOrigin` no corpo de **todas** as chamadas a `/api/checkout/create` (Pix, cartão e `walletPreload`): `"resume"` se veio do `/retomar`, `"prefill"` se o e-mail veio pré-preenchido e a pessoa não editou, `"typed"` nos outros casos. No back, grave em `sessions.lead_source`: `typed → "checkout"`, `prefill → "checkout_prefill"`, `resume → "retomar"`. (Campo novo no OpenAPI + regenerar o zod, como no 6b.)

### 9. Painel admin: funil do quiz com e-mail
Em `GET /admin/quiz-analytics` (`artifacts/api-server/src/routes/tracking.ts`) e na seção "Respostas do quiz" de `Admin.tsx`, acrescente um bloco **"Funil do quiz"** (visitantes distintos, `internal = false`, no período escolhido):
`Começaram o quiz` (qualquer resposta) → `Viram a tela de e-mail` (`quiz_email_view`) → `Deixaram o e-mail` (`quiz_email_submit = true`) → `Viram o resultado` (`quiz_result_view`) → `Chegaram à oferta` (`quiz-complete`), cada etapa com o % sobre "Começaram".
- Embaixo: **"E-mail no quiz no ar desde: dd/mm/aaaa hh:mm (Brasília)"**. No boot do servidor, se a chave `quiz_email_live_since` não existe em `app_settings`, grave `now()` (só na primeira vez; nunca sobrescreve). Use esse momento como início padrão do filtro desse bloco.
- Linha de alerta (decisão #13): se, desde `quiz_email_live_since`, "Começaram" ≥ 80 e "Chegaram à oferta ÷ Começaram" < 45%, mostre em vermelho: **"Critério da #13 atingido: troque 'E-mail no quiz' para Pulável."** Senão, mostre os dois números (ex.: "62 inícios · 58% chegaram à oferta").
- Linha **"Leads do quiz"** no período: total · viram a oferta · compraram (e-mail igual a uma sessão com `access_granted = true`). Sem gráfico.
- Onde o admin conta checkouts/Pix por sessão, mostre também a divisão por `lead_source` (checkout / checkout_prefill / retomar / retomar_quiz). Uma linha de texto basta.

### Teste antes de subir
1. Quiz do zero (aba anônima). Depois do loading aparece "Para onde enviamos seu diagnóstico completo?", **sem** "ver sem e-mail" (modo Obrigatório), com o aviso de privacidade e o link abrindo em outra aba.
2. `teste@gmail.comb` → "Você quis dizer teste@gmail.com?"; o botão não avança até aceitar ou tocar "Não, está certo". Inválido → "Digite um e-mail válido para ver seu resultado."
3. E-mail válido → vai para o resultado; chega o e-mail "Seu diagnóstico: …" com o mesmo rótulo da tela; `quiz_leads` tem a linha.
4. **No site publicado**, aba Network: o `POST` vai para `https://<domínio da API no Railway>/api/quiz/lead` e volta 200 (não para www.perguntasdeconexao.com.br). O mesmo para `/api/quiz/email-config`. Procure no código: nenhuma chamada nova com `fetch("/api`.
5. Seguir até a oferta → `offer_seen_at` preenchido. Abrir o checkout: o e-mail já está lá, **nenhum Pix é gerado sozinho**, aparece "Gerar meu Pix"; tocar gera o Pix pelo preço da oferta.
6. **Repetir o teste do 109** com o e-mail pré-preenchido do quiz: erro de bandeira (Discover ou a simulação `handleCardError("Este tipo de cartão não é aceito. Tente usar outro.", { type: "validation_error" })`) → troca para Pix e o Pix é gerado sozinho com a mensagem do 109. A linha "Pague no Pix" da aba Cartão também gera.
7. No admin, trocar para "Pulável" → num quiz novo aparece "ver sem e-mail →", sem novo deploy.
8. `/retomar/{id do lead}` abre o checkout com Pix pelo preço de oferta; trocar para cartão também mostra o preço de oferta.
9. Abrir o link "Sair da lista" do e-mail de diagnóstico real → página `/sair/{id}` com a confirmação; o e-mail aparece em `email_opt_outs`.
10. 375px (iPhone SE) com o teclado aberto na tela de e-mail: input (16px, sem zoom), aviso LGPD e botão "Ver meu resultado" continuam visíveis/alcançáveis.
11. Admin mostra "Funil do quiz", "no ar desde", "Leads do quiz" e a divisão por `lead_source`. Preço cheio, preço de oferta e janela de 10 min iguais a antes (`/api/offer/state`).
12. Schema: confira no diff de `lib/db/src/schema/index.ts` que só há linhas ADICIONADAS (nenhuma removida ou renomeada). `pnpm run typecheck` sem erro.

**Commit:** um commit só com esta mensagem:
`104a: e-mail obrigatório no quiz + lead + /retomar do lead + descadastro (reinicia teste #7)`
---

## Depois do deploy (Quinzinho)
1. Confira no GitHub que o commit "104a: …" apareceu e anote a hora. O site atualiza uns ~10 min depois.
2. Faça o quiz com um e-mail seu e confira que o "Seu diagnóstico" chegou (caixa de entrada **e** spam). **Sem isso, não liga anúncio.**
3. No admin, o bloco "Funil do quiz" mostra **"E-mail no quiz no ar desde …"**: é o novo início oficial do teste #7. Mande essa linha para a empresa.
4. Chame a 🧪 Qualidade para testar no ar. Só depois cole o **104b**.
