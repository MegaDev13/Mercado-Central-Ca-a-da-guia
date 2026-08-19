# Supervisor + jogador real

## Arquitetura atual (antes)

Planner nuvem → Gateway WS → LocalExecutor → IMinecraftClient (simulated | protocol) → painel HTTP simples.

Já existiam: 20 protocolos, whitelist, pathfinding, blueprint, pause/resume, disconnect.

Faltavam: auth Xbox na UI, picker servidor/Realm, visão 3D do estado real, override, emergência, posição validada.

## Arquitetura proposta (implementada, sem segundo agente)

```
Xbox device-code (prismarine-auth, cache em data/profiles)
        ↓
MinecraftConnection  →  mesmo IMinecraftClient
   server | realm | simulated
        ↓
LocalExecutor + PositionTracker
        ↓
Supervisor UI  ← /api/world  (nuvem FORA deste caminho)
```

## Renderizador

| Opção | Veredito |
|---|---|
| Captura do Minecraft oficial | Recusada: conflito de sessão Xbox, OS-specific, não é a visão do agente |
| prismarine-viewer | Java, não renderiza o estado Bedrock deste cliente |
| Babylon.js | Mais pesado do que o necessário |
| **Three.js (CDN)** | Escolhido: voxels instanciados, câmera FP/TP, sem texturas oficiais |

A cena mostra **apenas** blocos/entidades que o cliente conhece. No simulador isso é o mundo local. No protocolo, só o que chegou em pacotes (`start_game`, `move_player`, `update_block`, place/break). Sem terreno inventado.

## Posição

`PositionTracker` lê só pacotes (`start_game`, `move_player`, `correct_player_move_prediction`).  
`ProtocolClient.queueSafe` recusa `command_request` e `/tp /gamerule /showcoordinates /gamemode`.  
A UI imprime `player.position` interno. `showcoordinates` é irrelevante.

`POSITION_DESYNC` (≥ 4 blocos): interrompe construção, adota a última posição do servidor, zera o path, retoma.

## Auth / Realm

Device code Microsoft. Tokens só no `profilesFolder`. UI: status, gamertag, xuid — nunca o token.  
Realm: `createClient({ realms: { realmId | realmInvite } })` sem host/port, como a API oficial do bedrock-protocol.

Conflito de sessão: aviso se o kick mencionar outra sessão. Não inspecionamos o SO.

## Arquivos novos

`src/auth/XboxAuth.ts`, `src/client/MinecraftConnection.ts`, `src/client/PositionTracker.ts`, `src/client/WorldView.ts`, `src/executor/protocols/position.ts`, `src/ui/buildSnapshot.ts`, `src/app/createLocalStack.ts`, `src/ui/public/viewer.js`

## Limitações honestas

- Chunks Bedrock 1.18+ (`level_chunk` / `subchunk`) não são decodificados por completo: o visualizador de servidor real começa esparso e enche com o que o agente observa.
- Sem texturas Mojang (licença). Cores procedurais.
- Auth/Realm reais exigem `npm i bedrock-protocol prismarine-auth prismarine-realms`.
