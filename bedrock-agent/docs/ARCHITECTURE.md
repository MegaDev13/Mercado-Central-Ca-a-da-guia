# Arquitetura

```
USUÁRIO
   │
   ▼
IA / PLANNER (nuvem)          ← decisões estratégicas, blueprint, etapas
   │  WebSocket persistente
   │  (PC conecta para FORA)
   ▼
AGENT GATEWAY (neste PC)      ← auth, heartbeat, fila, ACK, idempotência
   │
   ▼
EXECUTOR LOCAL                ← protocolos autônomos, prioridade rígida
   │
   ├── Build Engine
   ├── Pathfinder A*
   ├── Inventory / Resources
   ├── Vanilla whitelist (default deny)
   ├── Entity / Hostile / Night
   └── Persistent mission state
   │
   ▼
IMinecraftClient
   ├── ProtocolClient  (bedrock-protocol)   ← principal
   ├── SimulatedClient (dev / testes)
   └── InputFallback   (desligado)
   │
   ▼
SERVIDOR BEDROCK
```

A IA **não** conduz andar → IA → colocar bloco → IA. Ela entrega um plano. O executor realiza centenas/milhares de ações sozinho e só volta à IA quando:

- nova construção / mudança de projeto
- falta de recurso (já calculada localmente)
- erro irrecuperável / blueprint inconsistente
- destruição estrutural ambígua
- pedido do usuário

## Segurança do host

A nuvem só pode chamar a lista em `AUTHORIZED_TOOLS`. Não há shell, filesystem arbitrário, nem PowerShell.

## Perda da IA

O executor continua o protocolo local em curso se for seguro. Não inicia decisão estratégica nova. Ao esgotar a missão, entra em `SAFE_WAIT`.

## Persistência

`data/missions/<id>.json` + `data/blueprints/<id>.json`. Toda desconexão grava motivo, posição, etapa e progresso. Reconexão **nunca** recomeça a obra.
