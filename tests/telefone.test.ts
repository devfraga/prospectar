import { describe, expect, it } from "vitest";
import { linkWhatsApp, normalizarTelefone } from "../src/core/telefone";

describe("normalizarTelefone", () => {
  it("reconhece celular no formato do Google Maps", () => {
    const t = normalizarTelefone("(11) 98765-4321");
    expect(t).toMatchObject({ tipo: "celular", e164: "+5511987654321", formatado: "(11) 98765-4321", ehCelular: true });
  });

  it("aceita +55 e espaços", () => {
    expect(normalizarTelefone("+55 19 99876-5432").e164).toBe("+5519998765432");
  });

  it("reconhece fixo", () => {
    const t = normalizarTelefone("(19) 3232-1010");
    expect(t).toMatchObject({ tipo: "fixo", e164: "+551932321010", ehCelular: false });
  });

  it("não confunde DDD 55 (RS) com código do país", () => {
    expect(normalizarTelefone("(55) 99123-4567").e164).toBe("+5555991234567");
  });

  it("remove o zero de discagem interurbana", () => {
    expect(normalizarTelefone("0 21 98888-7777").e164).toBe("+5521988887777");
  });

  it("adiciona o nono dígito em celular antigo", () => {
    expect(normalizarTelefone("(31) 8765-4321")).toMatchObject({ tipo: "celular", e164: "+5531987654321" });
  });

  it("marca 0800 e 4004 como especiais, sem WhatsApp", () => {
    expect(normalizarTelefone("0800 123 4567")).toMatchObject({ tipo: "especial", e164: null, ehCelular: false });
    expect(normalizarTelefone("4004-1234")).toMatchObject({ tipo: "especial", e164: null });
  });

  it("rejeita DDD inexistente e lixo", () => {
    expect(normalizarTelefone("(20) 98765-4321").tipo).toBe("invalido");
    expect(normalizarTelefone("abc").tipo).toBe("invalido");
    expect(normalizarTelefone(null).tipo).toBe("invalido");
  });

  it("mantém número estrangeiro sem marcar como celular", () => {
    expect(normalizarTelefone("+1 415-555-0100")).toMatchObject({ tipo: "internacional", e164: "+14155550100", ehCelular: false });
  });
});

describe("linkWhatsApp", () => {
  it("monta wa.me com texto codificado", () => {
    expect(linkWhatsApp("+5511987654321", "Olá, tudo bem?")).toBe(
      "https://wa.me/5511987654321?text=Ol%C3%A1%2C%20tudo%20bem%3F",
    );
  });
});
