# Guia avançado

Para quem já está usando e quer ir além: linha de comando, Places API, proxies e como o projeto é organizado.

## Linha de comando (CLI)

Tudo que o painel faz também dá para fazer no terminal, dentro da pasta do projeto:

```bash
npm run cli -- buscar "barbearia" --cidade "Campinas, SP"
npm run cli -- buscar "dentista" --cidade "Ribeirão Preto, SP" --grade 2
npm run cli -- leads --presenca sem_site,so_rede_social --whatsapp
npm run cli -- exportar --presenca sem_site --saida barbearias-sem-site.csv
npm run cli -- status <id-do-lead> contatado      # novo, contatado, reuniao, fechado
npm run cli -- remover <id-do-lead>                # sai do quadro (vai para Removidos)
npm run cli -- restaurar <id-do-lead>
npm run cli -- resumo
npm run cli -- --help
```

| Opção de busca | O que faz |
|---|---|
| `--cidade "Cidade, UF"` | Obrigatória. |
| `--grade 1` ou `2` | Cobertura da cidade: 1 = normal (1 busca), 2 = ampliada (4 buscas). |
| `--profundidade 10` | Quanto rolar a lista em cada busca (1 a 30). |
| `--fonte gosom` ou `places` | Motor local (grátis) ou Places API (paga). |
| `--nao-esperar` | Cria a busca e volta; acompanhe com `npm run cli -- sync`. |

## Fontes de dados

| | Motor local (padrão) | Google Places API (opcional) |
|---|---|---|
| Custo | Grátis | Pago por requisição (SKU "Text Search Enterprise", que inclui telefone e site). O Google dá um uso mensal gratuito por SKU; veja os [preços atuais](https://developers.google.com/maps/billing-and-pricing/pricing). |
| Como funciona | [gosom/google-maps-scraper](https://github.com/gosom/google-maps-scraper) no Docker abre um navegador invisível no Google Maps | API oficial do Google |
| Resultados por busca | ~120 | até 60 |
| Risco | Bloqueio temporário do IP em uso pesado | Nenhum bloqueio; respeita os termos do Google |
| Precisa | Docker | `GOOGLE_PLACES_API_KEY` no `.env` |

Escolha a fonte em cada busca no painel, com `--fonte` na CLI ou com `FONTE_PADRAO` no `.env`.

### Configurar a Places API

1. No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto e ative o faturamento.
2. Ative a **Places API (New)**.
3. Em "Credenciais", crie uma chave de API e restrinja-a à Places API.
4. No arquivo `.env`, preencha `GOOGLE_PLACES_API_KEY="sua-chave"` e reinicie o painel.
5. Na tela de busca, escolha a fonte "Places API".

Defina um orçamento com alerta no Google Cloud para não ter surpresa na fatura.

## Bloqueio do Google e proxies

O motor local acessa o Google Maps como um navegador comum, sem login, então **sua conta Google não corre risco**. O que pode acontecer é o Google **limitar seu IP temporariamente** quando você faz muitas buscas seguidas. Dura de minutos a algumas horas; enquanto isso as buscas voltam vazias ou falham.

- O projeto roda **uma busca por vez**, nunca em paralelo.
- Sinais de bloqueio: buscas com "falhou", 0 resultados numa cidade grande, ou bem menos resultados que uma busca igual anterior.
- Para volume alto ou buscas todo dia, coloque proxies residenciais em `PROXIES` no `.env`, separados por vírgula (`socks5://usuario:senha@host:porta,http://host2:porta`). O motor alterna entre eles. Também dá para colar proxies na tela de busca, em "Proxies (opcional)".

## Trocar a porta do motor

Se a porta 8080 já estiver em uso no seu computador:

1. No `docker-compose.yml`, troque `127.0.0.1:8080:8080` por `127.0.0.1:8081:8080`.
2. No `.env`, coloque `MOTOR_URL="http://localhost:8081"`.
3. Rode `docker compose up -d`.

Nunca troque `127.0.0.1` por `0.0.0.0`: a API do motor não tem senha e ficaria aberta na sua rede.

## Pontuação e mensagem padrão

Em **Configurações**, no painel, você ajusta:

- a **mensagem padrão do WhatsApp**, com as variáveis `{nome}`, `{categoria}`, `{cidade}` e `{presenca}`;
- os **pesos da pontuação** (quanto vale "sem site", "tem WhatsApp", "muitas avaliações" etc.). Ao salvar, todos os leads são recalculados.

## Estrutura do código

```
src/core/      regras e integrações (busca, fontes, presença, telefone, pontuação, enriquecimento)
src/app/       painel Next.js + rotas de API
src/cli/       linha de comando
scripts/       npm run setup / npm run iniciar
prisma/        schema do banco SQLite
tests/         testes (npm test)
.claude/       skill e comandos do Claude Code
docs/          este guia e ideias de nichos
```

Detalhes de arquitetura para quem vai mexer no código estão no [CLAUDE.md](../CLAUDE.md).

Comandos úteis: `npm test`, `npm run typecheck`, `npm run db:studio` (navegar no banco), `npm run motor:down` (desliga o motor), `npm run cli -- enriquecer --refazer` (verifica todos os sites de novo).
