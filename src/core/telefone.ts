// Normalização de telefones brasileiros e link de WhatsApp.

// DDDs válidos no Brasil (Anatel).
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export type TipoTelefone = "celular" | "fixo" | "especial" | "internacional" | "invalido";

export interface Telefone {
  tipo: TipoTelefone;
  /** +5511987654321, ou null quando não dá para discar de forma confiável. */
  e164: string | null;
  /** (11) 98765-4321 */
  formatado: string | null;
  ehCelular: boolean;
}

const INVALIDO: Telefone = { tipo: "invalido", e164: null, formatado: null, ehCelular: false };

export function normalizarTelefone(bruto: string | null | undefined): Telefone {
  if (!bruto) return INVALIDO;
  const texto = bruto.trim();
  let d = texto.replace(/\D/g, "");
  if (!d) return INVALIDO;

  // Número de outro país: mantém como veio, sem tentar adivinhar se é celular.
  if (texto.startsWith("+") && !d.startsWith("55")) {
    return { tipo: "internacional", e164: `+${d}`, formatado: texto, ehCelular: false };
  }

  // 0800, 0300, 4004, 3003...: não têm DDD e não abrem WhatsApp.
  if (/^0[358]00/.test(d) || /^(4004|4003|4020|3003|3004)\d{4}$/.test(d)) {
    return { tipo: "especial", e164: null, formatado: texto, ehCelular: false };
  }

  // +55 só é código do país se sobrar DDD + número (55 também é DDD do RS).
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  // Zero de discagem interurbana: 0 11 98765-4321.
  if (d.startsWith("0") && (d.length === 11 || d.length === 12)) d = d.slice(1);

  if (d.length !== 10 && d.length !== 11) return INVALIDO;
  const ddd = Number(d.slice(0, 2));
  if (!DDDS.has(ddd)) return INVALIDO;

  let numero = d.slice(2);
  if (numero.length === 8 && /^[6-9]/.test(numero)) {
    // Celular antigo, anterior ao nono dígito.
    numero = `9${numero}`;
  }

  if (numero.length === 9) {
    if (!numero.startsWith("9")) return INVALIDO;
    return {
      tipo: "celular",
      e164: `+55${ddd}${numero}`,
      formatado: `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`,
      ehCelular: true,
    };
  }

  if (!/^[2-5]/.test(numero)) return INVALIDO;
  return {
    tipo: "fixo",
    e164: `+55${ddd}${numero}`,
    formatado: `(${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`,
    ehCelular: false,
  };
}

/** Link wa.me com a mensagem já preenchida. Só faz sentido para celular. */
export function linkWhatsApp(e164: string, texto?: string): string {
  const numero = e164.replace(/\D/g, "");
  return texto ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : `https://wa.me/${numero}`;
}
