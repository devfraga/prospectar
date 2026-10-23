---
description: Busca clientes no Google Maps por nicho e cidade
argument-hint: <nicho> em <cidade> [sem site] [cidade inteira]
---

Use a skill `prospectar` para atender: $ARGUMENTS

1. Confira o motor com `npm run cli -- resumo` (suba com `docker compose up -d` se precisar).
2. Extraia o nicho e a cidade do pedido. Se faltar a cidade, pergunte.
3. Rode `npm run cli -- buscar "<nicho>" --cidade "<Cidade, UF>"` em segundo plano. Use `--grade 2` (cobertura ampliada, 4 buscas, o limite) se o pedido falar em "cidade inteira" ou "todos".
4. Ao terminar, mostre: total de leads, quantos sem site, só rede social, site fora do ar, com WhatsApp, e os 10 com maior pontuação. Se o pedido falar em "sem site", liste só esses (`--presenca sem_site,so_rede_social,site_fora_do_ar`).
5. Ofereça gerar as mensagens de abordagem com `/prospectar-mensagens`.
