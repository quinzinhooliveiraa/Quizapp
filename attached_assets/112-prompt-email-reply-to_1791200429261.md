# Prompt 112 — Reply-To nos e-mails (resposta chega no Gmail do Quinzinho)

*Otimizador, 05/10/2026. Contexto: `perguntasdeconexao.com.br` foi autenticado no Brevo hoje; o remetente novo será `contato@perguntasdeconexao.com.br`, mas o domínio não tem MX, então resposta a `contato@` se perde. Os e-mails do 104b dizem "responde este e-mail que eu leio" e o de acesso diz "é só responder" (garantia): sem Reply-To, essas respostas somem. Código conferido em `codigo/Quizapp` (`git pull` sem novidades): todos os envios passam por `sendEmailViaBrevo` em `artifacts/api-server/src/lib/brevo.ts`.*

**Arquivos:** só `artifacts/api-server/src/lib/brevo.ts`. **Não toca em `connection.ts`, então não conflita com o 111 nem com o 110.** Sem mexer em banco, `offers.ts`, texto dos e-mails ou remetente.

Cole isto no agente do Replit:

---
Em `artifacts/api-server/src/lib/brevo.ts`, na função `sendEmailViaBrevo` (a única que chama a API do Brevo; todos os e-mails passam por ela: transacionais, sequência 104b, código de login, diagnóstico, acesso após compra):

1. Leia `const replyToEmail = process.env.EMAIL_REPLY_TO?.trim();` junto das outras variáveis.
2. No `JSON.stringify` do body, acrescente, **somente se `replyToEmail` existir**: `replyTo: { email: replyToEmail, name: fromName }` (mesmo `fromName` já usado no `sender`). Sugestão: `...(replyToEmail ? { replyTo: { email: replyToEmail, name: fromName } } : {})`.
3. Se `EMAIL_REPLY_TO` não existir ou estiver vazia, o body fica **idêntico ao de hoje** (sem a chave `replyTo`).
4. `EMAIL_REPLY_TO` é opcional: não pode fazer `sendEmailViaBrevo` retornar "email not configured" (a checagem continua só `apiKey` e `EMAIL_FROM`).
5. Não mude mais nada. `pnpm run typecheck` sem erro. Se houver outro lugar que chame `api.brevo.com` direto (não encontrei), aplique o mesmo `replyTo` lá.

**Commit:** `112: replyTo opcional (EMAIL_REPLY_TO) nos envios do Brevo`

### AO TERMINAR: responda com esta lista, item por item
1. Leitura de `EMAIL_REPLY_TO`: **FEITO** ou **NÃO FEITO** (arquivo e linha).
2. `replyTo` no body, só quando existir: **FEITO** ou **NÃO FEITO** (arquivo e linha; cole o trecho).
3. Sem a variável, body igual ao de hoje: **FEITO** ou **NÃO FEITO**.
4. `EMAIL_REPLY_TO` não entra na checagem "email not configured": **FEITO** ou **NÃO FEITO**.
5. Nenhum outro envio ao Brevo fora de `sendEmailViaBrevo`: **FEITO** (confirmado com grep) ou **NÃO FEITO**.
6. Typecheck limpo, só `brevo.ts` alterado: **FEITO** ou **NÃO FEITO**.

---
## Depois do deploy: ordem segura no Railway (Quinzinho)
1. Espere o commit "112" no ar e crie `EMAIL_REPLY_TO=perguntasdeconexao@gmail.com` **primeiro** (sem efeito colateral: só passa a ter Reply-To).
2. Só então troque `EMAIL_FROM=contato@perguntasdeconexao.com.br` (a troca antes do 112 faria respostas caírem num endereço sem caixa).
3. Teste: peça um código de login, responda o e-mail e confira que chega no Gmail; depois chame a Qualidade. Se algo falhar, volte `EMAIL_FROM` ao valor antigo.
