*Revisado pela Qualidade 03/10 — v2: o aviso do item 2 vai num estado próprio no topo da aba Pix (o `cardError` é apagado na troca de aba e fica na aba Cartão). Veredito: ✅ pode colar.*

# Prompt 109 — Cartão Elo/Hipercard/Amex: avisar antes e cair no Pix sozinho

*Analista de Dados, 03/10/2026. Causa em `empresa/dados/2026-10-03-cartao-recusado-causa.md`. Não mexe em preço nem na configuração do Stripe.*
*Revisado pelo Otimizador em 03/10/2026 com os 3 ajustes da Qualidade (`empresa/dados/2026-10-03-qa-base-e-revisao-104-109.md`): gatilho amplo (o erro vem como `validation_error`), Pix só onde existe Pix (não Portugal), testes com plano B e 375px.*

**Ordem:** colar o 109 **antes** do 104a. O 104a preserva o Pix automático deste prompt.

---

Cole no Replit:

```
Contexto: nossa conta Stripe é do Brasil e não aceita Elo, Hipercard nem American Express.
Quando o cliente digita um desses no PaymentElement, o Stripe mostra "Este tipo de cartão
não é aceito. Tente usar outro." e a cobrança nem chega ao Stripe. Perdemos uma venda assim
em 02/10. Quero 3 mudanças pequenas no checkout (artifacts/perguntas-de-conexao/src/App.tsx).

REGRA GERAL: tudo o que fala de Pix neste prompt (a linha do item 1 e o Pix automático do
item 2) só existe quando checkoutPricing.pixAvailable === true. Em região sem Pix
(Portugal/EUR), o checkout fica exatamente como hoje: sem linha nova, sem troca para Pix.

1) AVISO ANTES. Na aba Cartão, embaixo de "Visa · Mastercard" (perto da linha 7084) e logo
   acima do PaymentElement (CardPaymentForm, perto da linha 7136), só se
   checkoutPricing.pixAvailable, mostrar uma linha curta (1 linha no celular, texto pequeno,
   cor do texto secundário):
   "Aceitamos Visa e Mastercard. Elo, Hipercard ou Amex? Pague no Pix, mesmo preço."
   "Pague no Pix" é clicável e faz o mesmo que o botão "Pague no Pix — mesmo preço"
   (handleCardErrorPixClick, perto da linha 7556): troca para a aba Pix; se o e-mail é
   válido, o Pix é gerado com o e-mail já digitado; se não tem e-mail, foca o campo de
   e-mail e NÃO gera nada.

2) PIX AUTOMÁTICO QUANDO A BANDEIRA NÃO PASSA. Em handleCardError (perto da linha 7737),
   crie uma função isUnsupportedBrandError(message, info) que devolve true se:
     (a) info?.code for "card_not_supported" ou "invalid_card_type", OU
     (b) info?.type === "validation_error" E a mensagem bater na regex
         /não é aceit|não aceit|nao e aceit|not supported|not accepted|não suportad|isn't accepted|is not accepted/i
   (o Stripe manda esse erro como validation_error, com código que ainda não confirmamos,
   e o texto muda com o idioma; por isso as duas checagens).
   Se isUnsupportedBrandError for true E checkoutPricing.pixAvailable:
     - registrar o erro como hoje (trackCardError), ANTES de trocar de aba;
     - trocar para a aba Pix e gerar o Pix com o e-mail preenchido (mesma ação do item 1);
     - ATENÇÃO: handlePaymentMethodSelect chama setCardError("") e a caixa de erro do cartão
       fica na aba Cartão, então a mensagem abaixo NÃO pode ir em cardError. Crie um estado
       novo (ex.: brandSwitchNotice) e mostre o aviso no TOPO da área do Pix (acima do QR /
       do campo de e-mail), com a cor de aviso que o checkout já usa. Ele some se a pessoa
       voltar para a aba Cartão. Com e-mail válido, o texto é:
       "Esse cartão não passa aqui (só Visa e Mastercard). Gerei seu Pix com o mesmo preço:"
     - se não houver e-mail válido: troca para Pix, foca o e-mail e mostra (no mesmo lugar)
       "Esse cartão não passa aqui (só Visa e Mastercard). Coloque seu e-mail e o Pix aparece, mesmo preço."
   Se pixAvailable for false: comportamento de hoje (só a mensagem do Stripe).
   Para os outros erros de cartão, manter o comportamento atual do prompt 103 (botão).

3) REGISTRAR O MOTIVO. No trackCardError (perto da linha 6160), o lastSection hoje grava
   type|code|declineCode|método. Acrescentar no fim os primeiros 30 caracteres da mensagem
   do erro (sem dado do cartão, só o texto do Stripe), respeitando o limite de 80 caracteres
   (encurtar o método para "c"/"p" se precisar). Para isso, passe a mensagem junto no
   CardErrorTrackingInfo (campo novo opcional message).

Não mudar: preço, cronômetro, Stripe (servidor), AbacatePay, textos do Pix, região PT/EUR.

Teste antes de publicar (modo teste do Stripe):
- Cartão de teste Discover 6011 1111 1111 1117 (bandeira que a conta BR não aceita)
  -> deve abrir a aba Pix com a mensagem do item 2 VISÍVEL no topo dela e o Pix gerado
  sozinho, com o e-mail preenchido.
  PLANO B: se o Discover passar no modo teste (o modo teste nem sempre barra a bandeira),
  simule no console/código chamando
  handleCardError("Este tipo de cartão não é aceito. Tente usar outro.", { type: "validation_error" })
  e confira o mesmo resultado. Diga qual dos dois caminhos você usou.
- Cartão 4242 4242 4242 4242 -> paga normal, sem aviso extra além da linha do item 1.
- Sem e-mail digitado, tocar em "Pague no Pix" da linha do item 1 -> foca o campo de
  e-mail e NÃO gera Pix nem cria sessão.
- Em 375px de largura (iPhone SE): a linha do item 1 cabe sem empurrar o botão de pagar
  para fora da tela; print da aba Cartão.
- Forçar região PT (EUR): a linha do item 1 NÃO aparece e o erro de bandeira NÃO troca para Pix.
- No admin, conferir que apareceu 1 evento card_error com o texto da mensagem no lastSection.

Commit: "109: aviso de bandeira + Pix automático no erro de cartão não aceito"
```

---

**Por que isso e não "ligar Elo no Stripe":** a conta Stripe Brasil não processa Elo/Hipercard/Amex (doc do Stripe: Amex "todos os países exceto Brasil"; Discover, rede que inclui Elo, não lista o Brasil). Não há botão para ligar. Aceitar Elo de verdade exigiria outro processador de cartão (decisão do CEO/Financeiro, fora deste prompt).

**Depois de colar:** chamar a 🧪 Qualidade para testar no site no ar. O item 3 mostra, no primeiro erro real, qual `code` o Stripe manda; se for diferente dos previstos, acrescentar na lista do item 2.
