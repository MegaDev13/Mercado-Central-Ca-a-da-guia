# Superfície autorizada (nuvem → PC)

A IA na nuvem só pode invocar:

| Ferramenta | Efeito |
|------------|--------|
| `minecraft.connect` | pede conexão ao servidor |
| `minecraft.disconnect` | saída segura com motivo |
| `minecraft.get_position` | XYZ atual |
| `minecraft.get_block` | identifica + classifica whitelist |
| `minecraft.get_inventory` | stacks e slot |
| `minecraft.move_to` | um passo (pathfinder local decide a rota) |
| `minecraft.place_block` | recusa se não for vanilla whitelist |
| `minecraft.break_block` | recusa se não for vanilla whitelist |
| `minecraft.get_entities` | snapshot local |
| `minecraft.get_time` | ticks + fase |
| `minecraft.get_world_state` | resumo |
| `minecraft.start_build` | inicia missão já planejada |
| `minecraft.pause_build` | pausa |
| `minecraft.resume_build` | retoma / reconecta |
| `minecraft.get_progress` | % e etapa |
| `minecraft.screenshot` | no protocolo headless devolve nota |
| `minecraft.get_mission` | estado persistente |
| `minecraft.confirm_resources` | usuário clicou CONTINUAR |

Qualquer outro nome (`child_process.exec`, `fs.rm`, `eval`…) é rejeitado e logado em `security`.

## Envelope WebSocket

```json
{
  "v": 1,
  "id": "uuid",
  "type": "plan|command|event|heartbeat|ack|…",
  "ts": 1710000000000,
  "session": "uuid",
  "from": "cloud|agent",
  "idempotencyKey": "uuid",
  "payload": {}
}
```

Duplicatas com a mesma `idempotencyKey` são ACK e descartadas.
