import { describe, expect, it } from "vitest";
import { calcularPontuacao, PESOS_PADRAO } from "../src/core/pontuacao";
import { celulasDaGrade, dentroDoBbox, type Bbox } from "../src/core/grade";

describe("calcularPontuacao", () => {
  it("sem site + celular + ativo + nota boa", () => {
    expect(calcularPontuacao({ presenca: "sem_site", ehCelular: true, avaliacoes: 50, nota: 4.7 })).toBe(80);
  });

  it("com site e sem nada mais dá zero", () => {
    expect(calcularPontuacao({ presenca: "com_site", ehCelular: false })).toBe(0);
  });

  it("nunca passa de 100", () => {
    const pesos = { ...PESOS_PADRAO, semSite: 90 };
    expect(calcularPontuacao({ presenca: "sem_site", ehCelular: true, avaliacoes: 99, nota: 5, emails: "a@b.com" }, pesos)).toBe(100);
  });

  it("não contatar zera", () => {
    expect(calcularPontuacao({ presenca: "sem_site", ehCelular: true, naoContatar: true })).toBe(0);
  });
});

describe("grade", () => {
  // Campinas, aproximadamente
  const bbox: Bbox = [-23.06, -22.75, -47.25, -46.95];

  it("gera N x N células dentro do bbox", () => {
    const c = celulasDaGrade(bbox, 3);
    expect(c).toHaveLength(9);
    for (const cel of c) {
      expect(dentroDoBbox(cel.lat, cel.lon, bbox, 0)).toBe(true);
      expect(cel.raio).toBeGreaterThanOrEqual(1000);
      expect(cel.zoom).toBeGreaterThanOrEqual(11);
      expect(cel.zoom).toBeLessThanOrEqual(17);
    }
  });

  it("grade 1 é o centro", () => {
    const [c] = celulasDaGrade(bbox, 1);
    expect(c.lat).toBeCloseTo(-22.905, 3);
    expect(c.lon).toBeCloseTo(-47.1, 3);
  });

  it("dentroDoBbox usa margem e mantém quem não tem coordenada", () => {
    expect(dentroDoBbox(-22.74, -47.1, bbox)).toBe(true); // 0,01 fora, dentro da margem de 10%
    expect(dentroDoBbox(-21.0, -47.1, bbox)).toBe(false);
    expect(dentroDoBbox(undefined, undefined, bbox)).toBe(true);
  });
});
