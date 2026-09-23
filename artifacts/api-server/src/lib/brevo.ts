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
  sessionId: string;
  buyerName: string;
  buyerEmail: string;
  pixBrCode?: string | null;
}) {
  const baseUrl =
    process.env.PUBLIC_BASE_URL || "https://www.perguntasdeconexao.com.br";
  const resumeUrl = `${baseUrl}/retomar/${encodeURIComponent(params.sessionId)}`;
  type Paragraph =
    | string
    | { prefix: string; linkText: string; suffix?: string }
    | { code: string };

  const linkParagraph = (prefix: string): Paragraph => ({
    prefix,
    linkText: resumeUrl,
  });
  const paragraphsBySequence: Record<1 | 2 | 3 | 4 | 5, Paragraph[]> = {
    1: [
      "Oi. Aqui é o Joaquim, eu que criei o Perguntas de Conexão. Pessoa de verdade, não robô.",
      "Vi que você fez o teste todo e travou bem na hora de liberar as perguntas.",
      ...(params.pixBrCode
        ? [
            "Se foi Pix, é rápido: copia o código aqui embaixo e cola no app do banco. Uns 30 segundos e libera.",
            { code: params.pixBrCode },
          ]
        : []),
      linkParagraph("Ou volta por aqui: "),
      'Amanhã te conto por que eu criei isso. Tem a ver com um "sei lá" que quase virou o normal aqui em casa.',
      "Travou algo no pagamento? Só responder este e-mail que eu leio.",
      "Joaquim",
    ],
    2: [
      "Oi.",
      "Ontem falei que ia te contar por que eu criei isso.",
      'Teve uma noite que a minha namorada sentou do meu lado querendo conversar de verdade. Ela falou "vamos conversar". E eu, sinceramente? Fui respondendo "sei lá", "sei lá", até a conversa morrer ali.',
      "Não foi maldade. Eu simplesmente não sabia o que responder, e era mais fácil desconversar.",
      "O problema é que aquilo foi virando o normal da gente: dois que se gostam, lado a lado, cada um no celular, sem assunto.",
      'Se você já ouviu (ou já deu) esse "sei lá", conhece essa parede.',
      'Eu fui atrás de uma saída. Não foi terapia, não foi "esforço", não foi marcar um jantar caro. Foi uma coisa só, bem simples, e amanhã te conto qual.',
      linkParagraph("Teu acesso continua aqui: "),
      "Joaquim",
    ],
    3: [
      "Oi.",
      "A virada foi essa: o problema nunca foi a gente. Era a pergunta.",
      '"Vamos conversar" não é pergunta, é cobrança. Pede que o outro traga algo sem dizer o quê. Ninguém responde isso.',
      'Aí eu troquei por perguntas prontas, que já chegam com o assunto na mão. "Você se arrepende de algo sobre a nossa história até aqui?" Essa tem resposta. Abre uma porta.',
      "Foi daí que nasceu o Perguntas de Conexão: 459 perguntas pra abrir conversa sozinhas, uma por noite. O baralho que mais combinou com vocês no teste já tá separado.",
      linkParagraph("Destrava aqui: "),
      "Joaquim",
    ],
    4: [
      "Oi.",
      'Todo mundo acha que é "um baralho de perguntas". O que acontece de verdade é outra coisa.',
      "É a paz meio esquisita de boa de quem foi escutado.",
      "É rir junto num dia que ia acabar cada um no seu celular.",
      "E principalmente, é redescobrir uma pessoa que você achava que já sabia tudo. Foi o que uma cliente me escreveu:",
      '"Teve uma pergunta que fez meu namorado falar uma coisa que eu nunca tinha ouvido dele daquele jeito. A gente ficou um tempão conversando depois, e eu pensei: como é que eu namoro essa pessoa há tanto tempo e nunca conversamos sobre isso? Foi conhecer de um jeito novo alguém que eu já conheço."',
      "E dá pra fazer à distância, cada um no seu celular, ao mesmo tempo. É pros dois. E é vitalício: baralho novo entra pra sempre, sem pagar de novo.",
      linkParagraph("Tá a um passo: "),
      "Joaquim",
    ],
    5: [
      "Oi.",
      "Esse é meu último e-mail sobre isso.",
      "O desconto que eu segurei pra você acaba hoje. Depois volta pro valor cheio, e eu não consigo reabrir.",
      "Se ficou algum receio: são 7 dias de garantia. Não fez sentido pra vocês, devolvo 100%, sem drama.",
      "Dá 11 centavos por noite pra tirar a conversa de vocês do automático. Vale o risco?",
      linkParagraph("Garantir com desconto: "),
      "Joaquim",
      " (quando for pagar, o Pix aparece no meu nome, Joaquim Emmanuel de Oliveira. Sou eu mesmo, pode confiar.)",
    ],
  };

  const paragraphs = paragraphsBySequence[params.sequence];
  const textContent = paragraphs
    .map((paragraph) => {
      if (typeof paragraph === "string") return paragraph;
      if ("code" in paragraph) return paragraph.code;
      return `${paragraph.prefix}${paragraph.linkText}${paragraph.suffix ?? ""}`;
    })
    .join("\n\n");
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; padding: 24px; color: #17121b;">
      ${paragraphs
        .map((paragraph) => {
          if (typeof paragraph === "string") {
            return `<p style="font-size: 15px; line-height: 1.55; margin: 0 0 16px;">${escapeHtml(paragraph)}</p>`;
          }
          if ("code" in paragraph) {
            return `<p style="font-size: 13px; line-height: 1.45; margin: 0 0 16px; overflow-wrap: anywhere;"><code>${escapeHtml(paragraph.code)}</code></p>`;
          }
          return `<p style="font-size: 15px; line-height: 1.55; margin: 0 0 16px;">${escapeHtml(paragraph.prefix)}<a href="${escapeHtml(resumeUrl)}">${escapeHtml(paragraph.linkText)}</a>${escapeHtml(paragraph.suffix ?? "")}</p>`;
        })
        .join("\n      ")}
    </div>
  `;
  const subjects: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: "você parou bem na melhor parte",
    2: 'o dia que a nossa conversa morreu num "sei lá"',
    3: "o problema nunca foi vocês",
    4: "o que ninguém te conta sobre 10 minutos de conversa",
    5: "último e-mail (seu desconto acaba hoje)",
  };
  return { subject: subjects[params.sequence], htmlContent, textContent };
}
