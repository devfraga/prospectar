// npm run setup: prepara o projeto na primeira vez. Pode rodar de novo sem problema.
// Cria o .env, cria o banco e sobe o motor de busca no Docker.

import { execSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";

const passo = (t) => console.log(`\n▶ ${t}`);
// Sem o aviso "Update available" do Prisma: confunde quem está começando.
const rodar = (cmd) => execSync(cmd, { stdio: "inherit", env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" } });

function dockerNoAr() {
  try {
    execSync("docker info", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const [versao] = process.versions.node.split(".").map(Number);
if (versao < 22) {
  console.error(`✗ Você está com o Node ${process.versions.node}. O projeto precisa do Node 22 ou mais novo: https://nodejs.org`);
  process.exit(1);
}

passo("Arquivo de configuração (.env)");
if (existsSync(".env")) {
  console.log("  Já existe. Mantive o seu.");
} else {
  copyFileSync(".env.example", ".env");
  console.log("  Criado a partir do .env.example.");
}

passo("Banco de dados");
rodar("npx prisma db push");
rodar("npx prisma generate");

passo("Motor de busca (Docker)");
let motorOk = false;
if (dockerNoAr()) {
  console.log("  Subindo o motor. Na primeira vez ele baixa ~1 GB, pode demorar alguns minutos...");
  rodar("docker compose up -d");
  motorOk = true;
} else {
  console.log("  ⚠ O Docker não está rodando.");
  console.log("    Abra o Docker Desktop, espere aparecer \"Engine running\" e rode  npm run setup  de novo.");
}

console.log(`\n${motorOk ? "✓ Tudo pronto!" : "✓ Quase pronto: falta só o Docker."}`);
console.log("  Para abrir o painel:  npm run iniciar\n");
