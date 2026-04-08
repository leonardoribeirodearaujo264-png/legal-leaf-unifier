/**
 * Mapeamento fixo de poderes especiais curtos por produto.
 * Quando o produto do contrato corresponde a um dos modelos abaixo,
 * o texto é usado diretamente — sem chamar a IA.
 */

const POWER_PRESETS: Record<string, string> = {
  "férias prêmio":
    "Especificamente para requerer em espécie as férias prêmio não gozadas no Estado de Minas Gerais.",
  "devolução ipsm":
    "Especificamente para requerer o retroativo da contribuição previdenciária paga ao IPSM de forma excedente.",
  "ipsm":
    "Especificamente para requerer o retroativo da contribuição previdenciária paga ao IPSM de forma excedente.",
  "alíquota":
    "Especificamente para requerer o retroativo da contribuição previdenciária paga ao IPSM de forma excedente.",
  "aliquota":
    "Especificamente para requerer o retroativo da contribuição previdenciária paga ao IPSM de forma excedente.",
  "retroativo":
    "Especificamente para requerer o retroativo da contribuição previdenciária paga ao IPSM de forma excedente.",
  "psm":
    "Especificamente para requerer o retroativo da contribuição previdenciária paga ao IPSM de forma excedente.",
  "terço de férias":
    "Especificamente para requerer o pagamento do terço de férias excedente aos 30 dias anuais e que não foram quitados.",
  "vale refeição":
    "Especificamente para requerer o pagamento retroativo do auxílio/vale alimentação em face do Estado de Minas Gerais.",
  "vale alimentação":
    "Especificamente para requerer o pagamento retroativo do auxílio/vale alimentação em face do Estado de Minas Gerais.",
  "atraso de obra":
    "Especificamente para requerer a indenização por atraso na entrega de imóvel adquirido pelo(a) Outorgante.",
};

/**
 * Retorna o texto fixo de poderes especiais se o produto/objeto
 * corresponder a um dos modelos conhecidos, ou `null` caso contrário.
 */
export function getPresetPower(productOrObject: string | null | undefined): string | null {
  if (!productOrObject) return null;

  const normalized = productOrObject.trim().toLowerCase();

  for (const [key, value] of Object.entries(POWER_PRESETS)) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  return null;
}
