*Revisado pela Qualidade 03/10 — v2: (1) e-mail 1 e P.S. do 5 não prometem mais "o Pix já aparece pronto" (depois do 104a, a maioria das sessões com e-mail será de cartão, criada pelo pré-carregamento ao abrir o checkout, e o `/retomar` delas abre no cartão); (2) e-mail 5 usa `{QUANDO}` = hoje/amanhã (a janela de 10h podia cair na véspera); (3) testes 2, 4 e 4b. "11 centavos" (agora `{CENTAVOS}` = 8), "acaba hoje" falso e baralho inexistente: resolvidos. Veredito: ✅ pode colar (depois do 104a testado no ar).*

# Prompt 104b — leads do quiz na sequência de recuperação + 5 e-mails novos (colar DEPOIS do 104a testado)

*Otimizador, 03/10/2026. Junta o item 6 do 104 original (leads na sequência, sem duplicar) com o item 10 da 📨 Recuperação (`empresa/ideias/2026-10-03-auditoria-emails-recuperacao.md`: textos e horários). O CEO decidiu que entra: é correção de promessa falsa ("acaba hoje" que não acaba hoje, Pix que nunca aparece no e-mail 1, "11 centavos" errado), não mudança de preço.*

**Ordem:** 109 → 104a (testado no ar) → **104b**. O 104b depende das tabelas, do `/retomar` do lead e do descadastro do 104a. Leads que entrarem entre o 104a e o 104b não se perdem: o job pega quem viu a oferta nos últimos 3 dias.

**Não mexe em preço:** `{OFERTA}` e `{CHEIO}` saem de `getOfferPricing("BR")`, do jeito que já estão. Não mexe no banco (a coluna `resume_email_n` já veio no 104a).

**Antes de colar (Quinzinho):**
1. O e-mail 4 tem um depoimento. Ele está num print **real** em `Depoimentos/`? Se **sim**, apague a linha marcada `[SEM DEPOIMENTO]` no texto do e-mail 4 abaixo e deixe a `[COM DEPOIMENTO]` (tirando a marcação). Se **não** ou não sabe, cole como está (vai sem depoimento).
2. No Railway: `EMAIL_FROM_NAME` = `Perguntas de Conexão` (decisão #24, 04/10: sem o nome do Quinzinho no remetente), e confirme que o `EMAIL_FROM` cai numa caixa que você lê (os e-mails dizem "responde este e-mail").

Cole isto no agente do Replit:

---
Implemente as mudanças abaixo. Não mexa em preço (`offers.ts`), na janela de 10 minutos, no checkout nem no schema do banco (`lib/db`): **não adicione, não renomeie, não remova nada no schema** (o boot roda `drizzle-kit push --force`). Tudo o que precisa no banco já existe (`quiz_leads`, `email_opt_outs`, `sessions.lead_source`, `sessions.abandon_suppressed_at`, `sessions.resume_email_n`). Chamadas novas do front para a API: sempre com `apiUrl(...)`.

### 1. Leads do quiz entram na mesma sequência (`artifacts/api-server/src/lib/abandoned-checkout.ts`, `sendAbandonedCheckoutEmails`)
**1a.** Além das `sessions`, o job busca `quiz_leads` com:
`region = 'BR'` · `offer_seen_at` preenchido · `suppressed_at` nulo · e-mail fora de `email_opt_outs` · (`internal = false` **ou** o e-mail está na lista de e-mails de admin, para dar para testar) · e-mail 1 sai **20 min depois de `offer_seen_at`** (não do `created_at`), e só se `offer_seen_at` tiver no máximo 3 dias. Os e-mails 2 a 4 seguem com +24h do anterior; o 5 segue a regra do item 2e. Idade máxima da sequência: 5 dias contados do `created_at` (o fim do desconto).
- Use o **mesmo** `buildAbandonedCheckoutEmail` com `id = lead.id` (o link fica `/retomar/{lead.id}`) e `createdAt = lead.created_at`. Grave `abandon_email_N_at` na linha do lead.

**1b. Um e-mail por pessoa, não por linha** (vale para `sessions` e `quiz_leads`; hoje a mesma pessoa pode ter várias sessões com e-mail, de cartão e de Pix). Antes de mandar qualquer e-mail para o endereço X:
- Se existe `sessions` com `buyer_email = X` e `access_granted = true` → **não manda**; marca a linha como suprimida (`suppressed_at` no lead / `abandon_suppressed_at` na sessão).
- Se X está em `email_opt_outs` → não manda; suprime.
- Para o **e-mail 1**: se outra linha (sessão ou lead) com o mesmo X já recebeu o e-mail 1 nos últimos 7 dias → não manda; suprime esta.
- Para o **e-mail 1 de um lead do quiz**: se existe sessão de checkout com o mesmo X criada nos últimos 3 dias → suprime o lead; quem leva a sequência é a sessão.
- Nas `sessions`, inclua `abandon_suppressed_at IS NULL` na busca de candidatos.
- Processe em ordem de `created_at`, uma linha por vez (como já é), para a segunda linha do mesmo e-mail ver a primeira já marcada.

### 2. Textos e horários novos (`lib/brevo.ts` → `buildAbandonedCheckoutEmail`, e `lib/abandoned-checkout.ts`)
**2a.** Substitua os 5 assuntos e textos pelos da seção "OS 5 TEXTOS" abaixo, mantendo o HTML atual (estilo, assinatura) e o rodapé de descadastro do 104a ("Não quer mais receber? Sair da lista: {PUBLIC_BASE_URL}/sair/{id}"). Parágrafos = `<p>`; no texto puro, linha em branco entre parágrafos. Lista do e-mail 4 = `<ul>`.

**2b. Variáveis** (calculadas no servidor; o e-mail não usa nome da pessoa):
- `discountEndsAt = createdAt + ABANDONED_CHECKOUT_DISCOUNT_MS` (5 dias). Exporte essa constante de **um lugar só** e use a mesma em `connection.ts` (onde o `/retomar` decide o preço) e aqui, para o e-mail e o `/retomar` nunca discordarem.
- `{OFERTA}` = `getOfferPricing("BR").offer` e `{CHEIO}` = `.full`, formato "R$ 29,90".
- `{PRAZO}` = `discountEndsAt` em `America/Sao_Paulo`, formato "quarta, 08/10, às 14h37" (dia da semana minúsculo; se o minuto for 00, "às 14h").
- `{HORA}` = só a hora no mesmo formato ("14h37" ou "14h").
- `{QUANDO}` = `"hoje"` se a data (em `America/Sao_Paulo`) do momento do envio for a mesma de `discountEndsAt`; senão `"amanhã"`. (A janela do item 2e começa 10h antes do fim: se o desconto acaba às 3h, o e-mail pode sair às 18h da véspera, e "hoje às 3h" seria falso.)
- `{CENTAVOS}` = `Math.round(offer.amountCents / 365)` (R$ 29,90 → 8).
- `{LINK}` = `{PUBLIC_BASE_URL}/retomar/{id}?e={N}` (N = número do e-mail, 1 a 5).

**2c.** Remova o bloco do código Pix (`pixBrCode` / `pixIsStillValid`) do e-mail 1: o Pix vence em 15 min e o e-mail sai depois de 20, então nunca aparece. O `/retomar` gera um Pix novo pelo preço de oferta.

**2d. Pré-cabeçalho:** um `<span>` invisível no começo do HTML (`display:none; max-height:0; overflow:hidden; opacity:0`) com o pré-cabeçalho de cada e-mail.

**2e. Horário do e-mail 5:** em vez de "+24h depois do 4", envie quando **agora ≥ discountEndsAt − 10h** e o 4 saiu há ≥ 12h. **Nunca** envie se agora ≥ discountEndsAt − 1h: nesse caso marque `abandon_email_5_at` sem mandar, para a sequência fechar. Isso garante que "acaba hoje às {HORA}" é verdade. Mesma regra para sessões e leads.

**2f. Origem da venda:** o front `ResumeCheckoutRoute` (`/retomar/:sessionId`) lê o `?e=` da URL e repassa na chamada `apiUrl("/api/checkout/resume/" + id + "?e=" + n)`. No `GET /checkout/resume`, se `e` for 1 a 5, grave em `sessions.resume_email_n` (o último recebido). No admin, junto da divisão por `lead_source`, uma linha: "Vendas pelo /retomar por e-mail: e1 x · e2 x · e3 x · e4 x · e5 x" (sessões com `access_granted = true` agrupadas por `resume_email_n`). E na linha "Leads do quiz", acrescente "receberam e-mail 1".

### OS 5 TEXTOS (cole exatamente; só troque as variáveis)

**E-mail 1** — 20 min depois de ver a oferta (lead) ou de sair do checkout (sessão)
Assunto: você parou bem na melhor parte
Pré-cabeçalho: guardei seu preço de oferta até {PRAZO}

Oi. Aqui é o Joaquim, eu que criei o Perguntas de Conexão. Pessoa de verdade, não robô.

Vi que você fez o teste, viu o resultado de vocês e parou bem antes de liberar as perguntas.

Tudo bem. Seu preço de oferta ficou guardado: {OFERTA} em vez de {CHEIO}, até {PRAZO}. Depois disso volta ao normal sozinho, não tem como eu estender.

Pra liberar é só abrir este link. Ele abre direto no pagamento, Pix ou cartão, pelo mesmo preço:
{LINK}

Pra você não estranhar: se pagar no Pix, ele sai no meu nome, Joaquim Emmanuel de Oliveira. Sou eu mesmo.

Amanhã te conto por que eu criei isso. Tem a ver com um "sei lá" que quase virou o normal aqui em casa.

Travou alguma coisa? Responde este e-mail que eu leio.

Joaquim

**E-mail 2** — +24h
Assunto: o dia que a nossa conversa morreu num "sei lá"
Pré-cabeçalho: não foi maldade. eu só não sabia o que responder.

Oi.

Ontem falei que ia te contar por que eu criei isso.

Teve uma noite que a minha namorada sentou do meu lado querendo conversar de verdade. Ela falou "vamos conversar". E eu? Fui respondendo "sei lá", "sei lá", até a conversa morrer ali.

Não foi maldade. Eu simplesmente não sabia o que responder, e desconversar era mais fácil.

O problema é que aquilo foi virando o normal: dois que se gostam, lado a lado, cada um no seu celular, sem assunto.

Talvez do seu lado quem diz "sei lá" seja a outra pessoa. Guarda isso, porque amanhã faz sentido.

Eu fui atrás de uma saída. Não foi terapia, não foi jantar caro, não foi "se esforçar mais". Foi uma coisa só, bem simples. Amanhã te conto qual.

Seu acesso continua aqui: {LINK}

Joaquim

P.S. Seu preço de {OFERTA} vale até {PRAZO}.

**E-mail 3** — +24h
Assunto: o problema nunca foi vocês
Pré-cabeçalho: "vamos conversar" não é pergunta. é cobrança.

Oi.

A virada foi essa: o problema nunca foi a gente. Era a pergunta.

"Vamos conversar" não é pergunta, é cobrança. Pede que o outro traga alguma coisa sem dizer o quê. Ninguém responde isso.

Aí eu troquei por perguntas prontas, que já chegam com o assunto na mão. "Você se arrepende de algo sobre a nossa história até aqui?" Essa tem resposta. Abre uma porta.

E tem um detalhe que eu só percebi depois: quando a pergunta vem do jogo, não é você cobrando. Ninguém fica na defensiva. Até quem é do "sei lá" responde, porque agora tem o que responder.

Foi daí que nasceu o Perguntas de Conexão: 459 perguntas, do leve ao picante, uma por noite.

Destrava aqui: {LINK}

Joaquim

P.S. {OFERTA} até {PRAZO}. Depois volta para {CHEIO}.

**E-mail 4** — +24h
Assunto: o que ninguém te conta sobre 10 minutos de conversa
Pré-cabeçalho: não é "um baralho de perguntas". é outra coisa.

Oi.

Todo mundo acha que é "um baralho de perguntas". O que acontece de verdade é outra coisa.

É a paz meio esquisita de quem foi escutado.
É rir junto num dia que ia acabar cada um no seu celular.
E é redescobrir uma pessoa que você achava que já conhecia inteira.

[SEM DEPOIMENTO] (nenhum parágrafo aqui)
[COM DEPOIMENTO] Foi o que uma cliente me escreveu: "Teve uma pergunta que fez meu namorado falar uma coisa que eu nunca tinha ouvido dele daquele jeito. (...) Foi conhecer de um jeito novo alguém que eu já conheço."

Na prática é assim:
- abre no celular, sem baixar nada;
- você manda um convite e a outra pessoa entra sem pagar de novo;
- dá pra jogar junto ou à distância, cada um no seu celular, ao mesmo tempo;
- paga uma vez e é de vocês pra sempre.

Tá a um passo: {LINK}

Joaquim

P.S. O preço de {OFERTA} vale até {PRAZO}. Depois volta para {CHEIO}.

**E-mail 5** — no dia em que o desconto acaba (regra 2e)
Assunto: seu desconto acaba {QUANDO} às {HORA}
Pré-cabeçalho: depois volta para {CHEIO}. e você ainda tem 7 dias de garantia.

Oi.

Esse é meu último e-mail sobre isso.

O preço de {OFERTA} que ficou guardado pra você acaba {QUANDO} às {HORA}. Depois volta para {CHEIO}, e o sistema não deixa eu reabrir.

Se ficou algum receio: são 7 dias de garantia. Não fez sentido pra vocês, devolvo 100%, sem drama.

Dá {CENTAVOS} centavos por noite no primeiro ano. Menos que uma pizza, e não acaba no fim da noite.

Daqui a um ano vocês vão estar juntos do mesmo jeito. A pergunta é se vão estar conversando ou só dividindo o sofá.

Garantir por {OFERTA}: {LINK}

Joaquim

P.S. Se pagar no Pix, aparece no meu nome, Joaquim Emmanuel de Oliveira. Sou eu mesmo, pode confiar.

(As marcações `[SEM DEPOIMENTO]` / `[COM DEPOIMENTO]` nunca aparecem no e-mail. Se as duas linhas ainda estiverem aqui, use a versão SEM depoimento.)

### Teste antes de subir
1. Lead de teste (e-mail de admin, `offer_seen_at` = agora − 21 min) → rodar o job → chega o e-mail 1 com assunto, pré-cabeçalho, preço de oferta, preço cheio, prazo em horário de Brasília, link `/retomar/{lead.id}?e=1` e rodapé `/sair/{id}`. **Sem** bloco de código Pix.
2. Uma sessão de checkout com o mesmo e-mail **não** recebe outro e-mail 1. Comprar com esse e-mail → o job para a sequência dele. (O job ignora sessões `internal = true`: para este teste, crie a sessão no banco de teste com `internal = false`, senão ele passa sem testar nada.)
3. Abrir o link do e-mail 1 → checkout com Pix pelo preço de oferta; `sessions.resume_email_n = 1`.
4. Lead interno com `created_at` = agora − 4 dias e 15 h (e-mail 4 já enviado há 13 h) → o e-mail 5 sai com a hora certa de Brasília e bate com o fim do desconto no `/retomar`. Com `created_at` = agora − 5 dias → o e-mail 5 **não** sai e fica marcado. Com o fim do desconto caindo no dia seguinte (ex.: 03h e envio às 20h) → assunto "acaba amanhã às 3h".
4b. Abrir o link de um e-mail de uma sessão de **cartão** (as criadas pelo pré-carregamento ao abrir o checkout) → abre no pagamento com o preço de oferta (cartão), e a aba Pix também mostra o preço de oferta.
5. `{CENTAVOS}` com o preço atual dá 8. Nenhum e-mail menciona "11 centavos", "baralho separado" nem "travou bem na hora".
6. E-mail em `email_opt_outs` → nada sai para ele.
7. `git diff lib/db` vazio. Preço cheio, preço de oferta e janela de 10 min iguais (`/api/offer/state`). `pnpm run typecheck` sem erro.

**Commit:** `104b: leads do quiz na recuperação + 5 e-mails reescritos com prazo real`
---

## Depois do deploy (Quinzinho)
1. Confira no GitHub o commit "104b: …".
2. Chame a 🧪 Qualidade: ela força um lead de teste e confere o e-mail 1 na sua caixa (entrada e spam).
3. Não julgar a sequência antes de ~150 pessoas nela (critério da Recuperação). 0 vendas pelo `/retomar` nesse volume = algo quebrado.
