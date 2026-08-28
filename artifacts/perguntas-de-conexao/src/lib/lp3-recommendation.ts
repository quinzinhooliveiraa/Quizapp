import type { Lp3NarrativeType } from "@/lib/lp3-narrative";

const recommendationBridges: Record<Lp3NarrativeType, string> = {
  routine:
    "Este baralho cria espaço para conversas que normalmente acabam sendo engolidas pela rotina.",
  discovery:
    "Este baralho ajuda vocês a continuar descobrindo coisas novas um sobre o outro.",
  "waiting-conversation":
    "Este baralho ajuda a encontrar uma primeira pergunta para abrir uma conversa que ficou esperando.",
  reconnection:
    "Este baralho cria espaço para vocês retomarem momentos de conexão.",
  beginning:
    "Este baralho ajuda vocês a continuar descobrindo quem está do outro lado.",
  distance:
    "Este baralho ajuda a criar presença através da conversa, mesmo quando vocês estão longe.",
  intimacy:
    "Este baralho lembra que a intimidade também começa nas conversas.",
  healthy:
    "Este baralho ajuda vocês a continuar cultivando a curiosidade, mesmo quando a relação está bem.",
};

export function getLp3RecommendationBridge(
  narrativeType: Lp3NarrativeType,
): string {
  return recommendationBridges[narrativeType];
}