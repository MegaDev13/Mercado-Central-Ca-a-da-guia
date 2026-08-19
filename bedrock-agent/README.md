# Agente Autônomo — Minecraft Bedrock

Jogador controlado por uma IA **estratégica** na nuvem e por um **executor reflexivo** neste computador.

A nuvem planeja. Este PC executa. A latência da IA **não** entra no loop de movimento nem de colocação de bloco.

```
usuário → IA (blueprint) → gateway local → protocolos → jogador Bedrock → servidor
```

## O que este diretório contém

| Pasta | Papel |
|-------|--------|
| `src/cloud` | Planner de alto nível (cérebro) |
| `src/gateway` | WebSocket de saída, auth, heartbeat, ACK, reconexão |
| `src/executor` | 20 protocolos + Build Engine + pathfinding + inventário |
| `src/client` | `bedrock-protocol` (principal) + simulador + fallback de input (off) |
| `src/blueprint` | `.mcstructure` + export HoloPrint (a mesma fonte) |
| `src/ui` | Painel local (status, recursos, CONTINUAR) |
| `docs/RESEARCH.md` | Pesquisa das libs oficiais / primárias |

## Princípios que o código impõe

1. Segurança do jogador > construção > recursos > blueprint > missão > velocidade  
2. Default **bloqueado**. Só Vanilla na whitelist é manipulável. Mods são invisíveis para interação.  
3. Mob hostil ou Creeper → salvar e **sair do servidor**, sem combate e sem perguntar à IA.  
4. Noite → sair. Dia → construir.  
5. Déficit de material → não começa a etapa; pede só o que falta.  
6. A IA não recebe shell, filesystem nem PowerShell.

## Quick start

```bash
cd bedrock-agent
npm install
npm test
npm run dev
```

Supervisor (visão 3D + auth + servidor/Realm): `http://127.0.0.1:8788`  
Planner WS: `ws://127.0.0.1:8787`

A posição do jogador vem **somente** do protocolo do cliente. O agente não usa `/tp`, `/gamerule` nem `showcoordinates`.

Cliente real + Xbox:

```bash
npm i bedrock-protocol prismarine-auth prismarine-realms
MC_CLIENT=protocol MC_OFFLINE=false npm run agent
```

Detalhes: `docs/TESTING.md`, `docs/ARCHITECTURE.md`, `docs/SUPERVISOR.md`.
