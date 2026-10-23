---
name: prospectar
description: Busca clientes no Google Maps por nicho e cidade, separa quem não tem site / só tem rede social / tem site fora do ar, e escreve mensagens de abordagem personalizadas para WhatsApp. Use quando o usuário pedir leads, clientes, prospecção, "empresas sem site", lista de negócios de uma cidade ou mensagens de abordagem.
---

# Prospectar

Você opera o projeto **prospectar** para o usuário. Tudo passa pela CLI (`npm run cli -- <comando>`), que grava no mesmo banco SQLite que o painel web (`npm run dev` → http://localhost:3000). Não escreva SQL nem chame a API do motor direto: use a CLI.

## Antes de buscar

1. `npm run cli -- resumo` mostra se o motor está no ar e se a Places API tem chave.
2. Motor fora do ar → `docker compose up -d` e espere ~10 s. Se o Docker não estiver rodando, peça para o usuário abrir o Docker Desktop.
3. `.env` ausente → `cp .env.example .env` e `npm run db:push`.

## Buscar

```bash
npm run cli -- buscar "<nicho>" --cidade "<Cidade, UF>" [--profundidade 10] [--grade 1] [--fonte gosom|places]
```

- A busca demora minutos. **Rode em segundo plano** (`run_in_background: true`) e espere a notificação; não faça polling com `sleep`.
- Para criar sem esperar: `--nao-esperar` e depois `npm run cli -- sync <id>` em segundo plano.
- `--profundidade` (1-30, padrão 10): quanto o motor rola a lista do Maps. Comece com 10.
- `--grade N` é a **cobertura da cidade**: divide o mapa em N x N partes e faz uma busca em cada, para passar do limite de ~120 resultados por busca. Só aceita 1 (normal, 1 busca) ou 2 (ampliada, 4 buscas); o limite existe para evitar bloqueio. Use 2 quando o usuário pedir "todos" ou "a cidade inteira", ou quando uma busca voltar com ~120 leads. Ao falar com o usuário, diga "cobertura normal/ampliada", não "grade".
- Nicho em português, como a pessoa buscaria no Maps: "barbearia", "clínica odontológica", "pet shop".

**Avise, não bloqueie.** Em busca grande (cobertura ampliada, profundidade ≥ 15, várias buscas seguidas), avise UMA vez que o Google pode bloquear o IP por algumas horas sem proxy (`PROXIES` no `.env`) e siga em frente.

**Sinais de bloqueio:** células com `falhou`, busca com 0 leads numa cidade grande ou bem menos leads que uma busca igual anterior. Sugira esperar, reduzir a profundidade ou configurar proxies.

## Consultar leads

```bash
npm run cli -- leads --presenca sem_site,so_rede_social --whatsapp --limite 20
npm run cli -- leads --busca <id> --json
npm run cli -- exportar --presenca sem_site --saida leads-sem-site.csv
```

Filtros: `--nicho`, `--cidade`, `--presenca` (sem_site, so_rede_social, site_fora_do_ar, com_site), `--status` (novo, contatado, reuniao, fechado, descartado; sem `--status` os removidos/descartados ficam de fora), `--min <pontuação>`, `--whatsapp`, `--busca <id>`, `--sem-mensagem`.

Ao mostrar resultados: resuma números (quantos por presença, quantos com WhatsApp) e mostre no máximo 10 linhas. Não despeje listas grandes no chat; mande para o painel ou exporte CSV.

## Escrever mensagens de abordagem

1. `npm run cli -- leads --json --sem-mensagem --status novo --whatsapp --limite 20` (mais os filtros que o usuário pediu).
2. Para cada lead, escreva uma mensagem de WhatsApp:
   - 2 a 4 frases, tom humano e direto, em português do Brasil, sem emojis em excesso.
   - Cite algo específico: o nome, a categoria, o bairro/cidade, a nota e o número de avaliações quando forem bons ("vi que vocês têm 4,8 com 230 avaliações").
   - Use a presença web como gancho: sem site → um site que transforme as avaliações em clientes; só rede social → um site próprio que apareça no Google; site fora do ar → avisar do problema usando o `siteNota` (ex.: "o domínio de vocês está redirecionando para outro site"); com site sem https → o aviso de "não seguro" no navegador.
   - Termine com uma pergunta simples ("Posso te mostrar uma ideia?"). Nada de promessas exageradas, preços ou pressão.
   - Se o usuário descreveu o que vende, adapte a oferta a isso.
3. Grave tudo de uma vez: escreva um arquivo JSON `[{"id": "...", "mensagem": "..."}]` numa pasta temporária e rode `npm run cli -- mensagens --arquivo <arquivo>`. Para um lead só: `npm run cli -- mensagem <id> --texto "..."`.
4. Diga ao usuário que as mensagens já aparecem no painel e no botão de WhatsApp de cada lead.

## Status e LGPD

- O painel mostra os leads num quadro (kanban) com as colunas Novos → Contatados → Reunião → Fechados. Os status equivalentes são `novo`, `contatado`, `reuniao` e `fechado`.
- `npm run cli -- status <id> contatado` depois que o usuário abordar (ou `reuniao` / `fechado`).
- `npm run cli -- remover <id>` tira o lead do quadro (vai para "Removidos"); `npm run cli -- restaurar <id>` traz de volta.
- `npm run cli -- nao-contatar <id>` quando alguém pedir para não receber mais mensagens. O lead sai do quadro e não volta em buscas novas.
- Telefones e e-mails são dados pessoais (LGPD). Prospecção B2B pode se apoiar em legítimo interesse, mas a pessoa precisa poder sair e quem pediu não volta a ser contatado. Recuse ajudar com spam em massa, assédio ou vigilância de pessoas.
- Fazer scraping do Google Maps vai contra os Termos de Serviço do Google. Mantenha volumes modestos e não revenda os dados brutos.
