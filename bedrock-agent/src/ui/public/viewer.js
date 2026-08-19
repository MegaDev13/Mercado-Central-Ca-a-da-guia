/** Local 2.5D viewer — no CDN, no Three.js. Always paints something. */

const COLORS = {
  "minecraft:grass_block": "#5a8f3a",
  "minecraft:dirt": "#7a5533",
  "minecraft:stone": "#7b7b7b",
  "minecraft:stone_bricks": "#8a8a8a",
  "minecraft:cobblestone": "#6d6d6d",
  "minecraft:oak_planks": "#b8945f",
  "minecraft:spruce_planks": "#70543a",
  "minecraft:glass": "rgba(154,215,224,0.55)",
  "minecraft:oak_door": "#8a6239",
  "minecraft:torch": "#ffd27a",
  default: "#9aa3b2",
};

export const viewer = {
  cameraMode: "tp",
  debug: false,
  showBlueprint: true,
  ready: false,
};

let canvas;
let ctx;
let lastWorld = null;

export function initViewer(el) {
  canvas = document.createElement("canvas");
  canvas.id = "world-canvas";
  el.innerHTML = "";
  el.appendChild(canvas);
  ctx = canvas.getContext("2d");
  const resize = () => {
    const w = Math.max(el.clientWidth || 640, 320);
    const h = Math.max(el.clientHeight || 400, 240);
    canvas.width = w;
    canvas.height = h;
    if (lastWorld) paint(lastWorld);
  };
  resize();
  new ResizeObserver(resize).observe(el);
  viewer.ready = true;
  loop();
}

export function applyWorld(world) {
  lastWorld = world;
}

function colorOf(id) {
  return COLORS[id] ?? COLORS.default;
}

function loop() {
  requestAnimationFrame(loop);
  if (lastWorld) paint(lastWorld);
}

function paint(world) {
  if (!ctx || !canvas) return;
  const w = canvas.width;
  const h = canvas.height;
  const p = world.position ?? { x: 0, y: 64, z: 0 };
  const t = world.time?.timeOfDay ?? 1000;
  const night = t >= 12000 && t < 23000;

  ctx.fillStyle = night ? "#0b1020" : "#7eb6e8";
  ctx.fillRect(0, 0, w, h);
  if (!night) {
    ctx.fillStyle = "#f7e7a5";
    ctx.beginPath();
    ctx.arc(w - 70, 50, 28, 0, Math.PI * 2);
    ctx.fill();
  }

  const horizon = Math.floor(h * 0.42);
  ctx.fillStyle = night ? "#1a2230" : "#6b9a45";
  ctx.fillRect(0, horizon, w, h - horizon);

  if (viewer.cameraMode === "fp") paintFirstPerson(world, p, w, h, horizon);
  else paintIso(world, p, w, h);

  drawHud(world, p, w, h);
}

function projectIso(x, y, z, origin, cx, cy, scale) {
  const dx = x - origin.x;
  const dy = y - origin.y;
  const dz = z - origin.z;
  return {
    sx: cx + (dx - dz) * scale,
    sy: cy + (dx + dz) * scale * 0.5 - dy * scale,
  };
}

function paintIso(world, p, w, h) {
  const scale = viewer.cameraMode === "orbit" ? 10 : 16;
  const cx = w / 2;
  const cy = h * 0.62;
  const blocks = [...(world.blocks ?? [])].sort((a, b) => a.x + a.z + a.y - (b.x + b.z + b.y));
  for (const b of blocks) {
    const { sx, sy } = projectIso(b.x, b.y, b.z, p, cx, cy, scale);
    drawCube(sx, sy, scale, colorOf(b.id));
  }
  if (viewer.showBlueprint) {
    for (const g of world.blueprint ?? []) {
      const { sx, sy } = projectIso(g.x, g.y, g.z, p, cx, cy, scale);
      ctx.strokeStyle = g.placed ? "rgba(61,214,140,0.9)" : "rgba(106,166,255,0.9)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx - scale / 2, sy - scale, scale, scale);
    }
  }
  for (const e of world.entities ?? []) {
    const { sx, sy } = projectIso(e.position.x, e.position.y, e.position.z, p, cx, cy, scale);
    ctx.fillStyle = e.hostile ? "#ff4d4d" : "#88c0ff";
    ctx.beginPath();
    ctx.ellipse(sx, sy - scale, scale * 0.35, scale * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "11px sans-serif";
    ctx.fillText(e.identifier, sx + 8, sy - scale);
  }
  ctx.fillStyle = "#ffcc66";
  ctx.fillRect(cx - 6, cy - 28, 12, 28);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("AGENTE", cx + 10, cy - 16);
}

function drawCube(sx, sy, scale, color) {
  ctx.fillStyle = color;
  ctx.fillRect(sx - scale / 2, sy - scale, scale, scale);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(sx - scale / 2, sy - 2, scale, 2);
}

function paintFirstPerson(world, p, w, h, horizon) {
  const yaw = world.look?.yaw ?? 0;
  const blocks = world.blocks ?? [];
  const ahead = blocks
    .map((b) => {
      const dx = b.x + 0.5 - p.x;
      const dz = b.z + 0.5 - p.z;
      const rotX = dx * Math.cos(-yaw) - dz * Math.sin(-yaw);
      const rotZ = dx * Math.sin(-yaw) + dz * Math.cos(-yaw);
      return { b, rotX, rotZ, dist: Math.hypot(dx, dz) };
    })
    .filter((x) => x.rotZ > 0.4 && x.dist < 24)
    .sort((a, b) => b.dist - a.dist);

  for (const item of ahead) {
    const size = Math.max(8, (220 / item.rotZ) * 0.8);
    const sx = w / 2 + (item.rotX / item.rotZ) * (w * 0.55);
    const sy = horizon + ((p.y - item.b.y) / item.rotZ) * 80;
    ctx.fillStyle = colorOf(item.b.id);
    ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
  }

  for (const e of world.entities ?? []) {
    const dx = e.position.x - p.x;
    const dz = e.position.z - p.z;
    const rotX = dx * Math.cos(-yaw) - dz * Math.sin(-yaw);
    const rotZ = dx * Math.sin(-yaw) + dz * Math.cos(-yaw);
    if (rotZ < 0.5) continue;
    const sx = w / 2 + (rotX / rotZ) * (w * 0.55);
    const sy = horizon;
    const size = 180 / rotZ;
    ctx.fillStyle = e.hostile ? "#ff4d4d" : "#88c0ff";
    ctx.fillRect(sx - size * 0.2, sy - size, size * 0.4, size);
  }

  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillRect(w / 2 - 6, horizon - 1, 12, 2);
  ctx.fillRect(w / 2 - 1, horizon - 6, 2, 12);
}

function drawHud(world, p, w, _h) {
  const connected = !!world.connected;
  const blocks = world.blocks?.length ?? 0;
  const ents = world.entities?.length ?? 0;
  ctx.fillStyle = "rgba(9,12,17,0.62)";
  ctx.fillRect(12, 52, Math.min(w - 24, 460), blocks === 0 ? 92 : 64);
  ctx.fillStyle = connected ? "#3dd68c" : "#ff6b6b";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText(connected ? "JOGADOR ONLINE" : "JOGADOR OFFLINE", 24, 74);
  ctx.fillStyle = "#e8edf5";
  ctx.font = "13px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillText(`X ${p.x.toFixed(2)}   Y ${p.y.toFixed(2)}   Z ${p.z.toFixed(2)}`, 24, 94);
  ctx.fillStyle = "#8b97ab";
  ctx.font = "12px sans-serif";
  ctx.fillText(
    `${world.source ?? "?"} · ${blocks} blocos visíveis · ${ents} entidades · ${world.time?.phase ?? "?"}`,
    24,
    112,
  );
  if (blocks === 0) {
    ctx.fillStyle = "#f5c14a";
    ctx.fillText("Sem chunks visuais ainda. Posição e entidades vêm do protocolo.", 24, 130);
  }
}
