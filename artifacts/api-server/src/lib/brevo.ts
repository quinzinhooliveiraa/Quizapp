const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

type SendEmailParams = {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
};

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
