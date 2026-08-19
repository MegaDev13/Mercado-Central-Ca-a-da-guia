# Pesquisa técnica — Fase 3

Pesquisa feita em 2026-08-19 sobre as tecnologias pedidas. Nada abaixo é suposição: cada afirmação aponta fonte primária.

## Minecraft Bedrock atual

A linha de versão Bedrock em 2026 usa o esquema `26.x` (ex.: 26.40 em 4 ago 2026). O rastreador oficial do PrismarineJS confirma o changelog e o atraso típico das libs de protocolo em relação ao cliente da loja.

Fontes:

- https://github.com/PrismarineJS/bedrock-protocol/issues/758
- https://feedback.minecraft.net/hc/en-us/sections/360001186971-Release-Changelogs

## bedrock-protocol (PrismarineJS) — ADOTADO como cliente principal

Repositório: https://github.com/PrismarineJS/bedrock-protocol  
Documentação da API: https://github.com/PrismarineJS/bedrock-protocol/blob/master/docs/API.md  
Pacote: `bedrock-protocol` no npm.

Capacidades verificadas:

- Cliente e servidor Bedrock, RakNet (UDP), criptografia, ping.
- Autenticação Microsoft/Xbox via device code (`onMsaCode`).
- Realms (`realms.realmId`, `realmInvite`, `pickRealm`) — a conta precisa ser dona ou convidada.
- Eventos: `status`, `join`, `spawn`, `kick`, `close`, `error`, `heartbeat`, `packet`, `session`.
- Versões listadas no README (ago 2026): 1.16.201 … 1.21.130 e 1.26.0 / 1.26.10 / 1.26.20 / 1.26.30 / 1.26.40.
- Último commit observado: 17 ago 2026. Projeto ativo.

Limitações verificadas (a lib **não** oferece):

- Pathfinding
- Inventário de alto nível
- Física / AABB
- Registro completo de blocos do mundo (chunks) pronto para `getBlock`
- Colocar/quebrar como API estável multi-versão — isso é feito com `inventory_transaction` / `player_action` / `player_auth_input`, cujos campos mudam entre versões

Conclusão: usar como **camada de transporte e autenticação**. O executor deste repositório implementa o resto.

## BedrockFlayer / mineflayer-for-bedrock — NÃO é dependência

Repositório: https://github.com/torzodmc/mineflayer-for-bedrock

O README afirma API estilo Mineflayer, pathfinding A\*, 23 plugins, física e chunks. O próprio autor escreve que o projeto ainda está incompleto e que o `bedrock-protocol` está atrasado em relação ao jogo. Histórico: 6 commits, última atualização em mai 2026, 1 estrela.

Conclusão técnica: **inadequado como dependência dura**. Padrões (plugins, `GoalBlock`, physics tick) inspiraram a interface `IMinecraftClient`, mas o código não é importado.

## Minecraft Bedrock Script API — NÃO é o executor

Documentação:

- https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/structuremanager
- World / Entity / Dimension: https://jaylydev.github.io/scriptapi-docs/latest/classes/_minecraft_server.World.html

`@minecraft/server` roda **dentro do mundo/servidor** como behavior pack. Expõe `world.structureManager`, `getDimension`, `getEntities`, `getTimeOfDay`. **Não conecta um jogador remoto.** Não autentica Xbox. Não funciona se não pudermos instalar um pack no servidor alvo.

O servidor alvo tem mods e não é controlado por nós. Script API fica como gancho futuro opcional, nunca como caminho principal.

## HoloPrint — visualização, não execução

- https://github.com/SuperLlama88888/holoprint
- https://holoprint-mc.github.io

Converte `.mcstructure` em resource pack com holograma (armor stand). Controles in-game (tijolo, ferro, couro…). **Não coloca blocos.** O agente exporta o **mesmo** blueprint para HoloPrint e para o Build Engine.

## Formato .mcstructure — fonte da verdade

Fontes:

- https://wiki.bedrock.dev/nbt/mcstructure
- https://gist.github.com/tryashtar/87ad9654305e5df686acab05cc4b6205

NBT little-endian, sem compressão. `format_version`, `size[x,y,z]`, `structure.block_indices` (duas camadas, ordem ZYX, `-1` = void), `palette.default.block_palette[{name,states,version}]`.

## Autenticação Microsoft/Xbox e Realms

`bedrock-protocol` implementa o fluxo device-code. Tokens ficam em `profilesFolder`. Realms exigem conta online (`offline: false`). Servidores BDS com `online-mode=false` aceitam `offline: true`.

## Bedrock Dedicated Server / multiplayer / mods

O agente entra como jogador. Não precisa de porta administrativa no PC. Servidores com mods: qualquer bloco fora de `minecraft:` + whitelist é **intocável**. Não há blacklist de mods.

## WebSocket / túnel

O PC inicia conexão **de saída** para o planner na nuvem. Sem expor porta admin. Heartbeat 5s, timeout 20s, reconexão com backoff, fila + ACK + idempotência.

## Pathfinding / inventário / entidades

Implementados localmente. A nuvem não calcula passo, não escolhe ferramenta e não classifica mob. Detecção de hostil e de noite dispara desconexão **antes** de qualquer round-trip com a IA.

## Controle de teclado/mouse

Existe apenas como `InputFallbackClient`, desligado por padrão. O caminho principal é o protocolo.

## Mapa de testes da Fase 27

| # | Teste | Onde |
|---|--------|------|
| 1–4 | conectar / spawn / posição / ler bloco | `SimulatedClient` + `ProtocolClient` |
| 5–6 | vanilla vs mod | `tests/whitelist.test.ts` |
| 7–9 | entidades / hostil / creeper exit | `tests/entities.test.ts`, `tests/integration.test.ts` |
| 10–12 | noite / reconectar de dia | `tests/integration.test.ts` |
| 13–16 | movimento / path / inventário / ferramenta | `tests/pathfinder.test.ts`, `tests/inventory.test.ts` |
| 17–21 | construção / blueprint / holoprint / mcstructure / validação | `tests/blueprint.test.ts`, `tests/planner.test.ts` |
| 22–23 | déficit de recursos | `tests/integration.test.ts` |
| 24–26 | UI / gateway / retomada | `src/ui`, `tests/gateway.test.ts`, integração |
| 27 | construção completa | `npm run dev` + painel |
