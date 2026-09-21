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
  sequence: 1 | 2;
  sessionId: string;
  buyerName: string;
  buyerEmail: string;
  pixBrCode?: string | null;
}) {
  const firstName = params.buyerName.trim().split(/\s+/)[0] || "vocês";
  const safeFirstName = escapeHtml(firstName);
  const baseUrl =
    process.env.PUBLIC_BASE_URL || "https://www.perguntasdeconexao.com.br";
  const resumeUrl = `${baseUrl}/retomar/${encodeURIComponent(params.sessionId)}`;
  const safeResumeUrl = escapeHtml(resumeUrl);
  const pixBlock =
    params.sequence === 1 && params.pixBrCode
      ? `
        <p style="font-size: 15px; line-height: 1.55; color: #4a4550; margin: 0 0 10px;">Se você escolheu Pix, é mais rápido ainda: copia o código abaixo, cola no app do seu banco e pronto, 30 segundos e tá liberado pra hoje à noite.</p>
        <div style="background: #f4f0f8; border-radius: 10px; padding: 14px; margin: 0 0 22px; overflow-wrap: anywhere;">
          <code style="font-size: 11px; line-height: 1.45; color: #4a4550;">${escapeHtml(params.pixBrCode)}</code>
        </div>
      `
      : "";

  if (params.sequence === 2) {
    const subject =
      process.env.ABANDON_EMAIL_2_SUBJECT || "último dia do seu desconto";
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #17121b;">
        <p style="font-size: 14px; color: #6b6070; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 8px;">Perguntas de Conexão</p>
        <h1 style="font-size: 22px; font-weight: 500; margin: 0 0 24px;">${subject}</h1>
        <p style="font-size: 15px; line-height: 1.55; color: #4a4550; margin: 0 0 20px;">Oi, ${safeFirstName}</p>
        <p style="font-size: 15px; line-height: 1.55; color: #4a4550; margin: 0 0 20px;">Passando só pra avisar: seu desconto no Perguntas de Conexão vira abóbora hoje. Depois disso volta pro valor cheio.</p>
        <p style="font-size: 15px; line-height: 1.55; color: #4a4550; margin: 0 0 24px;">São 459 perguntas pra vocês saírem do "e aí, como foi seu dia" e terem conversa de verdade, uma por noite, pra mais de um ano.</p>
        <a href="${safeResumeUrl}" style="display: block; text-align: center; background: #8a2f4d; color: #ffffff; text-decoration: none; border-radius: 999px; padding: 15px 20px; font-size: 16px; font-weight: 600; margin: 0 0 24px;">Garantir meu acesso com desconto</a>
        <p style="font-size: 13px; line-height: 1.55; color: #8b8290; margin: 0;">Se precisar de ajuda pra pagar, é só responder aqui.</p>
        <p style="font-size: 13px; line-height: 1.55; color: #8b8290; margin: 24px 0 0;">Perguntas de Conexão</p>
      </div>
    `;
    const textContent = `Perguntas de Conexão\n\nOi, ${firstName}\n\nPassando só pra avisar: seu desconto no Perguntas de Conexão vira abóbora hoje. Depois disso volta pro valor cheio.\n\nSão 459 perguntas pra vocês saírem do "e aí, como foi seu dia" e terem conversa de verdade, uma por noite, pra mais de um ano.\n\nGarantir meu acesso com desconto: ${resumeUrl}\n\nSe precisar de ajuda pra pagar, é só responder aqui.\n\nPerguntas de Conexão`;
    return { subject, htmlContent, textContent };
  }

  const subject =
    process.env.ABANDON_EMAIL_1_SUBJECT ||
    "vocês pararam bem na melhor parte";
  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #17121b;">
      <p style="font-size: 14px; color: #6b6070; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 8px;">Perguntas de Conexão</p>
      <h1 style="font-size: 22px; font-weight: 500; margin: 0 0 24px;">${subject}</h1>
      <p style="font-size: 15px; line-height: 1.55; color: #4a4550; margin: 0 0 20px;">Oi, ${safeFirstName}</p>
      <p style="font-size: 15px; line-height: 1.55; color: #4a4550; margin: 0 0 20px;">Você foi até o fim do teste e parou bem na hora de destravar as perguntas. Acontece: a vida corre, o celular apita, e a gente deixa pra depois.</p>
      <p style="font-size: 15px; line-height: 1.55; color: #4a4550; margin: 0 0 20px;">Mas olha o que ficou te esperando: 459 perguntas, 15 baralhos. Uma por noite dá mais de um ano de conversa de verdade com quem importa. E o baralho que mais combinou com vocês no teste já tá separado.</p>
      <p style="font-size: 15px; line-height: 1.55; color: #4a4550; margin: 0 0 10px;"><strong>Falta só um passo:</strong></p>
      <a href="${safeResumeUrl}" style="display: block; text-align: center; background: #8a2f4d; color: #ffffff; text-decoration: none; border-radius: 999px; padding: 15px 20px; font-size: 16px; font-weight: 600; margin: 0 0 24px;">Voltar e finalizar meu acesso</a>
      ${pixBlock}
      <p style="font-size: 15px; line-height: 1.55; color: #4a4550; margin: 0 0 20px;">Segurei o seu desconto, mas só até amanhã. Depois volta pro valor cheio.</p>
      <p style="font-size: 15px; line-height: 1.55; color: #4a4550; margin: 0 0 24px;">Travou alguma coisa na hora de pagar? Responde este e-mail que eu resolvo pra você.</p>
      <p style="font-size: 13px; line-height: 1.55; color: #8b8290; margin: 0;">Perguntas de Conexão</p>
    </div>
  `;
  const pixText = params.pixBrCode
    ? `\n\nSe você escolheu Pix, é mais rápido ainda: copia o código abaixo, cola no app do seu banco e pronto, 30 segundos e tá liberado pra hoje à noite.\n${params.pixBrCode}`
    : "";
  const textContent = `Perguntas de Conexão\n\nOi, ${firstName}\n\nVocê foi até o fim do teste e parou bem na hora de destravar as perguntas. Acontece: a vida corre, o celular apita, e a gente deixa pra depois.\n\nMas olha o que ficou te esperando: 459 perguntas, 15 baralhos. Uma por noite dá mais de um ano de conversa de verdade com quem importa. E o baralho que mais combinou com vocês no teste já tá separado.\n\nFalta só um passo:\n\nVoltar e finalizar meu acesso: ${resumeUrl}${pixText}\n\nSegurei o seu desconto, mas só até amanhã. Depois volta pro valor cheio.\n\nTravou alguma coisa na hora de pagar? Responde este e-mail que eu resolvo pra você.\n\nPerguntas de Conexão`;
  return { subject, htmlContent, textContent };
}
