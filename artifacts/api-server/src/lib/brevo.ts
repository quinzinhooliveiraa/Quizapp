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
      return { ok: false, error: `brevo ${response.status}: ${body.slice(0, 500)}` };
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