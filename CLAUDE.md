# CLAUDE.md: prospectar

Projeto de prospecção de clientes pelo Google Maps: busca negócios por nicho e cidade, classifica a presença web (sem site, só rede social, site fora do ar, com site), pontua os leads e gera links de WhatsApp com mensagem.

## Quando o usuário pedir leads, buscas ou mensagens
Siga a skill `prospectar` (`.claude/skills/prospectar/SKILL.md`). Use a CLI (`npm run cli -- ...`), nunca SQL direto. Comandos: `/prospectar`, `/prospectar-mensagens`, `/prospectar-setup`.

## Instalação e uso diário
- Instalar ou conferir a instalação: siga `INSTALAR-COM-CLAUDE.md` (o usuário provavelmente não é programador).
- "Abre o prospectar" / "liga o painel": rode `npm run iniciar` em segundo plano (sobe o motor, abre o painel e o navegador).
- `npm run setup` prepara tudo (.env, banco, motor) e pode rodar de novo sem problema.

## Arquitetura
- `src/core/`: toda a lógica, sem dependência do Next. Usada pelo painel, pela CLI e pelos testes.
  - `busca.ts`: máquina de estados `avancarBusca(id)`, chamada a cada polling. Um job do motor por vez, inclusive entre buscas.
  - `fontes/gosom.ts`: cliente do motor Docker (`gosom/google-maps-scraper`, API em `localhost:8080`, sem autenticação).
  - `fontes/places.ts`: Google Places API (New), opcional, precisa de `GOOGLE_PLACES_API_KEY`.
  - `presenca.ts`, `telefone.ts`, `pontuacao.ts`, `extrair.ts`, `mensagem.ts`: regras puras, com testes em `tests/`.
  - `importar.ts`: upsert por `placeId`; nunca sobrescreve status, notas ou mensagem do usuário.
  - `enriquecer.ts`: visita o site do lead (HTTP simples) para status, https, e-mails e redes.
- `src/app/`: painel Next.js (App Router). Páginas leem o core direto; ações chamam as rotas em `src/app/api/`.
- `src/cli/index.ts`: CLI com commander.
- `scripts/setup.mjs` e `scripts/iniciar.mjs`: `npm run setup` e `npm run iniciar`, em Node puro (sem dependências).
- `prisma/schema.prisma`: Prisma 7 + SQLite (`data/prospectar.db`) com adaptador better-sqlite3. Cliente gerado em `src/generated/prisma`.

## Convenções
- Código, nomes e mensagens em português do Brasil.
- Campos de tipo são String no banco; valores válidos em `src/core/tipos.ts`.
- Mudou o schema? `npm run db:push`.
- Antes de concluir: `npm test` e `npm run typecheck`.

## Cuidados
- Nunca exponha a porta 8080 do motor fora de `127.0.0.1`.
- Leads são dados pessoais (LGPD): não despeje listas grandes no chat, respeite `naoContatar`.
- Em buscas grandes, avise uma vez sobre bloqueio de IP e proxies; não bloqueie o usuário.
