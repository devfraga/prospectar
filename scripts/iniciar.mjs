// npm run iniciar: o comando do dia a dia. Garante o motor no ar, abre o painel e o navegador.

import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";

const PORTA = process.env.PORT || "3000";
const URL_PAINEL = `http://localhost:${PORTA}`;

if (!existsSync(".env") || !existsSync("data/prospectar.db")) {
  console.error("✗ O projeto ainda não foi preparado. Rode primeiro:  npm run setup");
  process.exit(1);
}

try {
  execSync("docker info", { stdio: "ignore" });
  execSync("docker compose up -d", { stdio: "ignore" });
  console.log("✓ Motor de busca no ar");
} catch {
  console.log("⚠ O Docker não está rodando: o painel abre, mas as buscas só funcionam com ele.");
  console.log("  Abra o Docker Desktop e, quando aparecer \"Engine running\", rode  npm run iniciar  de novo.\n");
}

// Só neste computador: o painel não tem senha e mostra dados pessoais dos leads.
const painel = spawn("npx", ["next", "dev", "--hostname", "127.0.0.1", "--port", PORTA], { stdio: "inherit", shell: true });
painel.on("exit", (codigo) => process.exit(codigo ?? 0));

// Abre o navegador quando o painel responder.
const abrir = {
  win32: `start "" ${URL_PAINEL}`,
  darwin: `open ${URL_PAINEL}`,
}[process.platform] ?? `xdg-open ${URL_PAINEL}`;

for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  try {
    await fetch(URL_PAINEL, { signal: AbortSignal.timeout(2000) });
    console.log(`\n✓ Painel aberto em ${URL_PAINEL}  (para fechar: Ctrl + C)\n`);
    try {
      execSync(abrir, { stdio: "ignore" });
    } catch {
      // sem navegador padrão: o endereço já está no terminal
    }
    break;
  } catch {
    // ainda subindo
  }
}
