import { getOfferPricing } from "./offers";
import { ABANDONED_CHECKOUT_DISCOUNT_MS } from "./abandoned-checkout-constants";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

type SendEmailParams = {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

export async function sendEmailViaBrevo(
  params: SendEmailParams,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  const fromName = process.env.EMAIL_FROM_NAME || "Perguntas de Conexão";
  const replyToEmail = process.env.EMAIL_REPLY_TO?.trim();

  if (!apiKey || !fromEmail) {
    return { ok: false, error: "email not configured" };
  }

  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: fromEmail, name: fromName },
        ...(replyToEmail
          ? { replyTo: { email: replyToEmail, name: fromName } }
          : {}),
        to: [{ email: params.to, name: params.toName || params.to }],
        subject: params.subject,
        htmlContent: params.htmlContent,
        textContent: params.textContent,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        ok: false,
        error: `brevo ${response.status}: ${body.slice(0, 500)}`,
      };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

export function buildLoginCodeEmail(code: string) {
  const subject = `Seu código de acesso: ${code}`;
  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #17121b;">
      <p style="font-size: 14px; color: #6b6070; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 8px;">Perguntas de Conexão</p>
      <h1 style="font-size: 22px; font-weight: 500; margin: 0 0 24px;">Seu código de acesso</h1>
       <p style="font-size: 15px; line-height: 1.55; color: #4a4550; margin: 0 0 20px;">Digite este código para abrir seu baralho. Ele deixa de funcionar em 15 minutos.</p>
      <div style="background: #f4f0f8; border-radius: 12px; padding: 24px; text-align: center; letter-spacing: 0.5em; font-size: 32px; font-weight: 600; color: #17121b; margin: 0 0 20px;">${code}</div>
      <p style="font-size: 13px; line-height: 1.55; color: #8b8290; margin: 0;">Se você não solicitou este código, pode ignorar este email.</p>
    </div>
  `;
  const textContent = `Perguntas de Conexão\n\nSeu código para abrir o baralho: ${code}\n\nEle deixa de funcionar em 15 minutos.\n\nSe você não pediu este código, pode ignorar este email.`;

  return { subject, htmlContent, textContent };
}

export function buildPurchaseAccessEmail(params: {
  buyerName: string;
  accessUrl: string;
  loginUrl: string;
}) {
  const firstName = params.buyerName.trim().split(/\s+/)[0] || "";
  const hi = firstName ? `${firstName}, ` : "";
  const subject = "Pronto — o baralho é de vocês";
  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #17121b;">
      <p style="font-size: 14px; color: #6b6070; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 8px;">Perguntas de Conexão</p>
      <h1 style="font-size: 22px; font-weight: 500; margin: 0 0 16px;">Pagamento confirmado</h1>
      <p style="font-size: 15px; line-height: 1.55; color: #4a4550; margin: 0 0 24px;">${hi}o baralho é de vocês, pra sempre. Guarde este e-mail: é por aqui que você volta a qualquer momento.</p>
      <a href="${params.accessUrl}" style="display: block; text-align: center; background: #8a2f4d; color: #ffffff; text-decoration: none; border-radius: 999px; padding: 15px 20px; font-size: 16px; font-weight: 600; margin: 0 0 24px;">Abrir meu baralho</a>
      <p style="font-size: 15px; line-height: 1.55; color: #4a4550; margin: 0 0 8px;"><strong>Agora chama ele(a).</strong></p>
      <p style="font-size: 15px; line-height: 1.55; color: #4a4550; margin: 0 0 24px;">Dentro do app você gera um convite. A pessoa entra sem pagar de novo.</p>
      <div style="background: #f4f0f8; border-left: 3px solid #b1802f; border-radius: 10px; padding: 18px 20px; margin: 0 0 24px;">
        <p style="font-size: 12px; color: #8b8290; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 8px;">Comecem por esta, hoje à noite</p>
        <p style="font-size: 17px; line-height: 1.4; color: #17121b; font-style: italic; margin: 0;">"Qual parte da nossa rotina você não trocaria por nada?"</p>
      </div>
      <p style="font-size: 13px; line-height: 1.55; color: #8b8290; margin: 0 0 8px;">Este link é a sua chave — não compartilhe. Para chamar seu parceiro(a), use o convite dentro do app.</p>
      <p style="font-size: 13px; line-height: 1.55; color: #8b8290; margin: 0 0 8px;">Se o botão não funcionar, entre em <a href="${params.loginUrl}" style="color: #8a2f4d;">${params.loginUrl}</a> com este mesmo e-mail.</p>
      <p style="font-size: 13px; line-height: 1.55; color: #8b8290; margin: 0;">Você tem 7 dias de garantia. Se não mexer com vocês, é só responder este e-mail.</p>
    </div>
  `;
  const textContent = `Perguntas de Conexão\n\nPagamento confirmado. O baralho é de vocês, pra sempre.\n\nAbra aqui: ${params.accessUrl}\n\nDepois chame seu parceiro(a): dentro do app você gera um convite e a pessoa entra sem pagar de novo.\n\nComecem por esta, hoje à noite:\n"Qual parte da nossa rotina você não trocaria por nada?"\n\nEste link é a sua chave — não compartilhe.\nSe não funcionar, entre em ${params.loginUrl} com este mesmo e-mail.\n\nVocê tem 7 dias de garantia. Se não mexer com vocês, é só responder este e-mail.`;

  return { subject, htmlContent, textContent };
}

export function buildAbandonedCheckoutEmail(params: {
  sequence: 1 | 2 | 3 | 4 | 5;
  id: string;
  createdAt: Date;
  sentAt: Date;
}) {
  const timezone = "America/Sao_Paulo";
  const pricing = getOfferPricing("BR");
  const discountEndsAt = new Date(
    params.createdAt.getTime() + ABANDONED_CHECKOUT_DISCOUNT_MS,
  );
  const baseUrl = (
    process.env.PUBLIC_BASE_URL || "https://www.perguntasdeconexao.com.br"
  ).replace(/\/+$/, "");
  const resumeUrl = `${baseUrl}/retomar/${encodeURIComponent(params.id)}?e=${params.sequence}`;
  const dateParts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(discountEndsAt);
  const dateValues = Object.fromEntries(
    dateParts.map((part) => [part.type, part.value]),
  );
  const weekday = dateValues.weekday.toLowerCase().replace(/-feira$/, "");
  const deadlineHour = `${Number(dateValues.hour)}h${
    dateValues.minute === "00" ? "" : dateValues.minute
  }`;
  const deadline = `${weekday}, ${dateValues.day}/${dateValues.month}, às ${deadlineHour}`;
  const dateKey = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  };
  const when =
    dateKey(params.sentAt) === dateKey(discountEndsAt) ? "hoje" : "amanhã";
  const centsPerNight = Math.round(pricing.offer.amountCents / 365);
  type Paragraph = string | { list: string[] };
  const paragraphsBySequence: Record<
    1 | 2 | 3 | 4 | 5,
    { subject: string; preheader: string; paragraphs: Paragraph[] }
  > = {
    1: {
      subject: "você parou bem na melhor parte",
      preheader: `guardei seu preço de oferta até ${deadline}`,
      paragraphs: [
      "Oi. Aqui é o Joaquim, eu que criei o Perguntas de Conexão. Pessoa de verdade, não robô.",
        "Vi que você fez o teste, viu o resultado de vocês e parou bem antes de liberar as perguntas.",
        `Tudo bem. Seu preço de oferta ficou guardado: ${pricing.offer.display} em vez de ${pricing.full.display}, até ${deadline}. Depois disso volta ao normal sozinho, não tem como eu estender.`,
        `Pra liberar é só abrir este link. Ele abre direto no pagamento, Pix ou cartão, pelo mesmo preço:\n{LINK}`,
        "Pra você não estranhar: se pagar no Pix, ele sai no meu nome, Joaquim Emmanuel de Oliveira. Sou eu mesmo.",
        'Amanhã te conto por que eu criei isso. Tem a ver com um "sei lá" que quase virou o normal aqui em casa.',
        "Travou alguma coisa? Responde este e-mail que eu leio.",
        "Joaquim",
      ],
    },
    2: {
      subject: 'o dia que a nossa conversa morreu num "sei lá"',
      preheader: "não foi maldade. eu só não sabia o que responder.",
      paragraphs: [
        "Oi.",
        "Ontem falei que ia te contar por que eu criei isso.",
        'Teve uma noite que a minha namorada sentou do meu lado querendo conversar de verdade. Ela falou "vamos conversar". E eu? Fui respondendo "sei lá", "sei lá", até a conversa morrer ali.',
        "Não foi maldade. Eu simplesmente não sabia o que responder, e desconversar era mais fácil.",
        "O problema é que aquilo foi virando o normal: dois que se gostam, lado a lado, cada um no seu celular, sem assunto.",
        'Talvez do seu lado quem diz "sei lá" seja a outra pessoa. Guarda isso, porque amanhã faz sentido.',
        'Eu fui atrás de uma saída. Não foi terapia, não foi jantar caro, não foi "se esforçar mais". Foi uma coisa só, bem simples. Amanhã te conto qual.',
        "Seu acesso continua aqui: {LINK}",
        "Joaquim",
        `P.S. Seu preço de ${pricing.offer.display} vale até ${deadline}.`,
      ],
    },
    3: {
      subject: "o problema nunca foi vocês",
      preheader: '"vamos conversar" não é pergunta. é cobrança.',
      paragraphs: [
        "Oi.",
        "A virada foi essa: o problema nunca foi a gente. Era a pergunta.",
        '"Vamos conversar" não é pergunta, é cobrança. Pede que o outro traga alguma coisa sem dizer o quê. Ninguém responde isso.',
        'Aí eu troquei por perguntas prontas, que já chegam com o assunto na mão. "Você se arrepende de algo sobre a nossa história até aqui?" Essa tem resposta. Abre uma porta.',
        'E tem um detalhe que eu só percebi depois: quando a pergunta vem do jogo, não é você cobrando. Ninguém fica na defensiva. Até quem é do "sei lá" responde, porque agora tem o que responder.',
        "Foi daí que nasceu o Perguntas de Conexão: 459 perguntas, do leve ao picante, uma por noite.",
        "Destrava aqui: {LINK}",
        "Joaquim",
        `P.S. ${pricing.offer.display} até ${deadline}. Depois volta para ${pricing.full.display}.`,
      ],
    },
    4: {
      subject: "o que ninguém te conta sobre 10 minutos de conversa",
      preheader: 'não é "um baralho de perguntas". é outra coisa.',
      paragraphs: [
        "Oi.",
        'Todo mundo acha que é "um baralho de perguntas". O que acontece de verdade é outra coisa.',
        "É a paz meio esquisita de quem foi escutado.",
        "É rir junto num dia que ia acabar cada um no seu celular.",
        "E é redescobrir uma pessoa que você achava que já conhecia inteira.",
        "Na prática é assim:",
        {
          list: [
            "abre no celular, sem baixar nada;",
            "você manda um convite e a outra pessoa entra sem pagar de novo;",
            "dá pra jogar junto ou à distância, cada um no seu celular, ao mesmo tempo;",
            "paga uma vez e é de vocês pra sempre.",
          ],
        },
        "Tá a um passo: {LINK}",
        "Joaquim",
        `P.S. O preço de ${pricing.offer.display} vale até ${deadline}. Depois volta para ${pricing.full.display}.`,
      ],
    },
    5: {
      subject: `seu desconto acaba ${when} às ${deadlineHour}`,
      preheader: `depois volta para ${pricing.full.display}. e você ainda tem 7 dias de garantia.`,
      paragraphs: [
        "Oi.",
        "Esse é meu último e-mail sobre isso.",
        `O preço de ${pricing.offer.display} que ficou guardado pra você acaba ${when} às ${deadlineHour}. Depois volta para ${pricing.full.display}, e o sistema não deixa eu reabrir.`,
        "Se ficou algum receio: são 7 dias de garantia. Não fez sentido pra vocês, devolvo 100%, sem drama.",
        `Dá ${centsPerNight} centavos por noite no primeiro ano. Menos que uma pizza, e não acaba no fim da noite.`,
        "Daqui a um ano vocês vão estar juntos do mesmo jeito. A pergunta é se vão estar conversando ou só dividindo o sofá.",
        `Garantir por ${pricing.offer.display}: {LINK}`,
        "Joaquim",
        "P.S. Se pagar no Pix, aparece no meu nome, Joaquim Emmanuel de Oliveira. Sou eu mesmo, pode confiar.",
      ],
    },
  };

  const email = paragraphsBySequence[params.sequence];
  const paragraphs = email.paragraphs;
  const textParagraph = (paragraph: Paragraph) => {
    if (typeof paragraph === "string") {
      return paragraph.replaceAll("{LINK}", resumeUrl);
    }
    return paragraph.list.map((item) => `- ${item}`).join("\n");
  };
  const textContent = paragraphs.map(textParagraph).join("\n\n");
  const linkedParagraph = (value: string) =>
    escapeHtml(value).replaceAll(
      "{LINK}",
      `<a href="${escapeHtml(resumeUrl)}">${escapeHtml(resumeUrl)}</a>`,
    );
  const htmlParagraph = (paragraph: Paragraph) => {
    if (typeof paragraph === "string") {
      const content = linkedParagraph(paragraph).replaceAll("\n", "<br>");
      return `<p style="font-size: 15px; line-height: 1.55; margin: 0 0 16px;">${content}</p>`;
    }
    const items = paragraph.list
      .map((item) => `<li style="margin: 0 0 8px;">${escapeHtml(item)}</li>`)
      .join("");
    return `<ul style="font-size: 15px; line-height: 1.55; margin: 0 0 16px; padding-left: 24px;">${items}</ul>`;
  };
  const htmlContent = [
    `<span style="display:none; max-height:0; overflow:hidden; opacity:0;">${escapeHtml(email.preheader)}</span>`,
    '<div style="font-family: Arial, sans-serif; max-width: 560px; padding: 24px; color: #17121b;">',
    paragraphs.map(htmlParagraph).join("\n  "),
    "</div>",
  ].join("\n");
  return { subject: email.subject, htmlContent, textContent };
}
