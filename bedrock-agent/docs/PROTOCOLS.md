# Protocolos locais

Cada protocolo é uma máquina determinística. O árbitro escolhe o de **menor número** (maior prioridade) que `wantsControl()`.

| Pri | Condição | Protocolos | Ação |
|-----|----------|------------|------|
| 0 | Falha crítica | CONNECTION / ERROR | abortar com segurança |
| 1 | Mob hostil / Creeper | HOSTILE_MOB_DETECTION + EXIT | salvar + **sair do servidor** |
| 2 | Noite | DAY_NIGHT + NIGHT_EXIT + SAFE_WAIT | salvar + sair + esperar dia |
| 3 | Risco ambiental | (pathfinder recusa lava/void/mod) | recálculo local |
| 4 | Falta de recurso | RESOURCE_MANAGEMENT | não inicia etapa, pede déficit exato |
| 5 | Erro de execução | ERROR_RECOVERY / RECONNECTION | tenta local, senão escala |
| 6 | Construção | BUILDING / BLUEPRINT / VALIDATION / INVENTORY / TOOL / PATH / MOVEMENT / PROGRESS / MISSION | executar |

## HOSTILE / CREEPER

Local, imediato, sem esperar a IA:

1. interrompe construção  
2. salva missão / posição / etapa / progresso  
3. registra o mob, coordenadas e horário  
4. desconecta  
5. `SAFE_WAIT`  

Não ataca, não foge dentro do mundo, não avalia distância. Creeper tem o mesmo gatilho na **simples detecção**.

## NOITE

Construir só com `safeToBuild` (ticks 0–11000 e 23000–24000). Ao anoitecer: salvar + sair + esperar dia + reconectar + revalidar mundo/mobs/recursos.

## RECURSOS

```
necessário − disponível = déficit
```

Se déficit > 0 a etapa **não começa**. O usuário vê a lista só do que falta e o botão `[CONTINUAR]`.
