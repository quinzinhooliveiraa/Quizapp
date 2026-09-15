export type SupportDiagnosis = {
  translation: string;
  action: string;
};

function normalizeAccessStatus(status: string | null | undefined): string {
  const aliases: Record<string, string> = {
    "dono com acesso": "tem_acesso",
    "convidado com acesso": "so_convite",
    "sem acesso confirmado": "sem_acesso",
    "não verificado": "desconhecido",
  };
  const normalized = status?.trim().toLowerCase() || "desconhecido";
  return aliases[normalized] || normalized;
}

export function getSupportDiagnosis(
  topic: string | null | undefined,
  accessStatus: string | null | undefined,
): SupportDiagnosis | null {
  const normalizedTopic = topic?.trim().toLowerCase();
  if (!normalizedTopic) return null;

  const normalizedAccessStatus = normalizeAccessStatus(accessStatus);
  if (normalizedAccessStatus === "desconhecido") {
    return {
      translation: "Não consegui verificar o e-mail dela automaticamente.",
      action: "Conferir na mão na aba Compradores.",
    };
  }

  if (normalizedTopic === "sem_acesso") {
    if (normalizedAccessStatus === "tem_acesso") {
      return {
        translation: "O acesso está liberado — ela só não está conseguindo entrar.",
        action:
          "Mandar o link direto /acesso/<sessionId>. Pedir pra conferir o spam se o código não chega.",
      };
    }
    if (normalizedAccessStatus === "so_convite") {
      return {
        translation:
          "Ela é convidada, não compradora. O acesso dela é pelo link do convite, não pelo login.",
        action: "Reenviar o link do convite. Quem compra é o parceiro.",
      };
    }
    return {
      translation: "Diz que comprou, mas esse e-mail não tem nada no sistema.",
      action:
        "Procurar o pagamento no Abacate/Stripe pelo nome dela. Se achar, liberar o acesso na mão. Se não achar, ela não chegou a pagar.",
    };
  }

  if (normalizedTopic === "email_nao_chegou") {
    if (normalizedAccessStatus === "tem_acesso") {
      return {
        translation:
          "Pagou, tem acesso, mas o e-mail não chegou (spam ou falha do Brevo).",
        action:
          "Mandar o link direto /acesso/<sessionId> e conferir o log do Brevo.",
      };
    }
    return {
      translation: "Diz que pagou, mas não existe compra confirmada com esse e-mail.",
      action: "Conferir Abacate/Stripe. Pagamento não confirmado ou e-mail diferente.",
    };
  }

  if (normalizedTopic === "convite") {
    return {
      translation: "Problema com link de convite.",
      action:
        "Conferir se o token ainda é válido e pedir pra quem comprou gerar um novo.",
    };
  }

  if (normalizedTopic === "pagamento") {
    return {
      translation: "Travou no checkout, antes de pagar.",
      action: "Ver se ficou sessão pendente no nome dela e qual erro apareceu.",
    };
  }

  if (normalizedTopic === "outro") {
    return {
      translation: "Assunto geral / sugestão.",
      action: "Só ler e responder.",
    };
  }

  return null;
}