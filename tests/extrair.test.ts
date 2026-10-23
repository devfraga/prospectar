import { describe, expect, it } from "vitest";
import { extrairEmails, extrairRedes, linksDeContato } from "../src/core/extrair";

const html = `
<html><body>
  <a href="mailto:contato@clinicasorriso.com.br?subject=oi">Fale com a gente</a>
  <p>Suporte: atendimento@gmail.com</p>
  <img src="logo@2x.png">
  <p>email@example.com</p>
  <a href="/fale-conosco">Fale conosco</a>
  <a href="https://outrosite.com/contato">Parceiro</a>
  <a href="https://www.instagram.com/p/abc123">post</a>
  <a href="https://www.instagram.com/clinicasorriso/">Instagram</a>
  <a href="https://www.facebook.com/sharer.php?u=x">compartilhar</a>
  <a href="https://www.facebook.com/clinicasorriso">Facebook</a>
</body></html>`;

describe("extrairEmails", () => {
  it("pega mailto e texto, tira lixo e põe o do domínio primeiro", () => {
    expect(extrairEmails(html, "https://www.clinicasorriso.com.br")).toEqual([
      "contato@clinicasorriso.com.br",
      "atendimento@gmail.com",
    ]);
  });

  it("HTML vazio não quebra", () => {
    expect(extrairEmails("", "x.com")).toEqual([]);
  });
});

describe("extrairRedes", () => {
  it("ignora links de post e de compartilhar", () => {
    expect(extrairRedes(html)).toEqual({
      instagram: "https://www.instagram.com/clinicasorriso",
      facebook: "https://www.facebook.com/clinicasorriso",
    });
  });
});

describe("linksDeContato", () => {
  it("só links do mesmo site, completando com caminhos comuns", () => {
    expect(linksDeContato(html, "clinicasorriso.com.br")).toEqual([
      "http://clinicasorriso.com.br/fale-conosco",
      "http://clinicasorriso.com.br/contato",
      "http://clinicasorriso.com.br/sobre",
    ]);
  });
});
