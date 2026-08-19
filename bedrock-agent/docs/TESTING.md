# Testes

```bash
cd bedrock-agent
npm install
npm test
```

Os testes unitários e de integração usam `SimulatedClient` — não precisam de Minecraft instalado.

## Demo local (sem servidor Bedrock)

```bash
npm run dev
```

Abra o painel (porta 8788). Fluxo:

1. Planejar uma parede / casa / castelo  
2. Iniciar construção — o bot conecta no mundo simulado e constrói sozinho  
3. Injetar Creeper → sai na hora  
4. Anoitecer → sai  
5. Amanhecer → reconecta e continua a **mesma** missão  
6. Castelo com inventário curto → `RESOURCE_WAIT` e mensagem com o déficit

## Cliente real

```bash
npm i bedrock-protocol
export MC_CLIENT=protocol
export MC_HOST=127.0.0.1
export MC_PORT=19132
export MC_OFFLINE=true          # BDS com online-mode=false
# ou MC_OFFLINE=false para Xbox device-code
npm run agent
```

Em outro processo / máquina:

```bash
npm run cloud
```

O PC do jogador **sempre** inicia o WebSocket de saída (`CLOUD_WS_URL`).
