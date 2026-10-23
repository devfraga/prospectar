# Instalação guiada pelo Claude

> **Para a pessoa:** você não precisa ler este arquivo. Ele é o roteiro que o Claude Code segue para instalar o Prospectar no seu computador. Veja o [README](README.md).

---

**Claude, este roteiro é para você.** A pessoa que pediu a instalação provavelmente não é programadora.

## Como conduzir

- Fale em português do Brasil, simples, sem jargão. Antes de cada passo, diga em uma frase o que vai fazer e por quê.
- Faça um passo por vez e confira o resultado antes de seguir.
- Quando precisar de algo que só a pessoa pode fazer (abrir o Docker Desktop, aceitar termos, reiniciar o computador, digitar uma senha de administrador), peça com instruções claras e espere a confirmação.
- Antes de instalar qualquer programa no computador, diga o que vai instalar e peça autorização.
- Comandos longos (`npm install`, `npm run setup` na primeira vez, `git clone`): avise que pode demorar e rode em segundo plano quando possível.
- Nunca exponha a porta 8080 fora de `127.0.0.1`, nunca sobrescreva um `.env` existente e não peça chaves de API: o projeto funciona sem nenhuma.

## Passo 1. Descubra o sistema e confira os programas

Descubra se é Windows, Mac ou Linux. Depois confira:

```bash
node --version
git --version
docker --version
```

| Programa | Precisa | Se faltar (Windows) | Se faltar (Mac) |
|---|---|---|---|
| Node.js | versão 22 ou mais | `winget install OpenJS.NodeJS.LTS` | `brew install node` ou instalador LTS de https://nodejs.org |
| Git | qualquer versão | `winget install Git.Git` | `xcode-select --install` |
| Docker Desktop | instalado e rodando | `winget install Docker.DockerDesktop` | `brew install --cask docker` ou https://www.docker.com/products/docker-desktop/ |

- Se o `winget` não existir ou falhar, passe para a pessoa o link de download e as instruções do [README](README.md#passo-1-instale-os-3-programas).
- Depois de instalar o Node ou o Git, o terminal atual pode não enxergá-los. Tente de novo num terminal novo; se ainda não funcionar, peça para a pessoa fechar e abrir o Claude Code.
- Docker Desktop no Windows: pode pedir para reiniciar o computador e para ativar o WSL 2. Explique que isso é normal. Depois de reiniciar, a pessoa volta ao Claude Code e você continua do passo onde parou.

## Passo 2. Docker Desktop rodando

```bash
docker info
```

Se der erro, peça para a pessoa:

1. Abrir o **Docker Desktop** (menu Iniciar no Windows, Launchpad no Mac).
2. Aceitar os termos e pular o cadastro ("Skip"), se aparecer.
3. Esperar aparecer **"Engine running"** e avisar você.

Rode `docker info` de novo até funcionar.

## Passo 3. Tenha o projeto na máquina

Se você ainda não está dentro da pasta do projeto (que tem o `package.json` com `"name": "prospectar"`), clone na pasta de usuário:

```bash
cd ~
git clone <url-do-repositório> prospectar
```

Daqui em diante, rode tudo dentro da pasta `prospectar`. Se a sessão do Claude Code permitir, mude o diretório de trabalho para essa pasta.

## Passo 4. Instale as dependências

```bash
npm install
```

Leva de 1 a 3 minutos. Se der erro de `better-sqlite3` ou de compilação, quase sempre é Node antigo: confira `node --version` (precisa ser 22+), apague `node_modules` e rode de novo.

## Passo 5. Prepare o projeto

```bash
npm run setup
```

Ele cria o `.env` (se não existir), cria o banco de dados em `data/prospectar.db` e sobe o motor de busca no Docker. **Na primeira vez baixa cerca de 1 GB**; avise a pessoa e rode em segundo plano.

Ao final, confira:

```bash
npm run cli -- resumo
```

Deve mostrar "Motor gosom: no ar". Se mostrar "fora do ar", espere uns 20 segundos e confira de novo; se continuar, veja `docker compose logs motor`.

- Porta 8080 ocupada: siga [Trocar a porta do motor](docs/avancado.md#trocar-a-porta-do-motor).
- Mac com Apple Silicon e o motor não sobe: no `docker-compose.yml`, descomente `platform: linux/amd64` e rode `npm run setup` de novo.

## Passo 6. Abra o painel

Rode em segundo plano:

```bash
npm run iniciar
```

O navegador abre sozinho em http://localhost:3000. Se não abrir, passe o endereço para a pessoa.

## Passo 7. Primeira busca (opcional)

Pergunte em que cidade a pessoa quer prospectar e que tipo de negócio. Sugira uma busca pequena para testar, com cobertura normal:

```bash
npm run cli -- buscar "<nicho>" --cidade "<Cidade, UF>"
```

Rode em segundo plano. Ao terminar, mostre quantos negócios foram encontrados e quantos estão sem site, só com rede social e com site fora do ar. Mostre que os resultados já estão no painel, na aba **Leads**.

## Passo 8. Explique como usar daqui pra frente

Termine com um resumo curto, nas palavras da pessoa:

- **Para abrir no dia a dia:** abrir o Docker Desktop, abrir o terminal, rodar `cd ~/prospectar` e depois `npm run iniciar`. Ou abrir o Claude Code na pasta `prospectar` e pedir "abre o prospectar".
- **Para desligar:** Ctrl + C no terminal.
- **No Claude Code, dentro da pasta do projeto:** `/prospectar <nicho> em <cidade>` para buscar e `/prospectar-mensagens` para escrever as mensagens de abordagem.
- **Cuidados:** poucas buscas seguidas (o Google pode bloquear o IP por algumas horas), nada de disparo em massa no WhatsApp, e respeitar quem pedir para não ser contatado.
