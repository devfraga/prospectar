import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Módulo nativo do SQLite: roda no Node, fora do bundle.
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
  // A raiz é sempre a pasta do projeto, mesmo que exista um package-lock/yarn.lock perdido numa pasta acima.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
