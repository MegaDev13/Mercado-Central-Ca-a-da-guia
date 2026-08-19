import * as THREE from "three";

const COLORS = {
  "minecraft:grass_block": 0x5a8f3a,
  "minecraft:dirt": 0x7a5533,
  "minecraft:stone": 0x7b7b7b,
  "minecraft:stone_bricks": 0x7d7d7d,
  "minecraft:cobblestone": 0x6d6d6d,
  "minecraft:oak_planks": 0xb8945f,
  "minecraft:spruce_planks": 0x70543a,
  "minecraft:glass": 0x9ad7e0,
  "minecraft:oak_door": 0x8a6239,
  "minecraft:torch": 0xffd27a,
  "minecraft:oak_stairs": 0xb8945f,
  "minecraft:ladder": 0x8a6239,
  default: 0x9aa3b2,
};

export const viewer = {
  cameraMode: "fp",
  debug: false,
  showBlueprint: true,
  ready: false,
};

let scene, camera, renderer, player, sun;
const meshes = new Map();
let ghostGroup = new THREE.Group();
let entityGroup = new THREE.Group();
let pathLine = null;

export function initViewer(el) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b6e0);
  scene.fog = new THREE.Fog(0x87b6e0, 40, 90);
  camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  el.appendChild(renderer.domElement);
  sun = new THREE.DirectionalLight(0xfff4d2, 1.1);
  sun.position.set(40, 80, 20);
  scene.add(sun, new THREE.AmbientLight(0x6f88aa, 0.55));
  player = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 1.8, 0.6),
    new THREE.MeshLambertMaterial({ color: 0xffcc66 }),
  );
  scene.add(player, ghostGroup, entityGroup);
  const resize = () => {
    const w = el.clientWidth || 640;
    const h = el.clientHeight || 400;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  resize();
  new ResizeObserver(resize).observe(el);
  viewer.ready = true;
  loop();
}

function colorOf(id) {
  return COLORS[id] ?? COLORS.default;
}

function keyOf(b) {
  return `${b.x},${b.y},${b.z}`;
}

function ensureMesh(id) {
  let m = meshes.get(id);
  if (m) return m;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshLambertMaterial({
    color: colorOf(id),
    transparent: id.includes("glass"),
    opacity: id.includes("glass") ? 0.45 : 1,
  });
  m = { geo, mat, mesh: null, count: 0, dummy: new THREE.Object3D() };
  meshes.set(id, m);
  return m;
}

export function applyWorld(world) {
  if (!viewer.ready || !world) return;
  const byId = new Map();
  for (const b of world.blocks ?? []) {
    const list = byId.get(b.id) ?? [];
    list.push(b);
    byId.set(b.id, list);
  }
  for (const [id, rec] of meshes) {
    if (rec.mesh) {
      scene.remove(rec.mesh);
      rec.mesh.geometry.dispose();
    }
    rec.mesh = null;
  }
  for (const [id, list] of byId) {
    const rec = ensureMesh(id);
    const mesh = new THREE.InstancedMesh(rec.geo, rec.mat, list.length);
    list.forEach((b, i) => {
      rec.dummy.position.set(b.x + 0.5, b.y + 0.5, b.z + 0.5);
      rec.dummy.updateMatrix();
      mesh.setMatrixAt(i, rec.dummy.matrix);
    });
    rec.mesh = mesh;
    scene.add(mesh);
  }

  while (ghostGroup.children.length) ghostGroup.remove(ghostGroup.children[0]);
  if (viewer.showBlueprint) {
    for (const g of world.blueprint ?? []) {
      const mat = new THREE.MeshLambertMaterial({
        color: g.placed ? 0x3dd68c : 0x6aa6ff,
        transparent: true,
        opacity: g.placed ? 0.15 : 0.35,
        wireframe: !g.placed,
      });
      const cube = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 1.02), mat);
      cube.position.set(g.x + 0.5, g.y + 0.5, g.z + 0.5);
      ghostGroup.add(cube);
    }
  }

  while (entityGroup.children.length) entityGroup.remove(entityGroup.children[0]);
  for (const e of world.entities ?? []) {
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, 1.2, 4, 8),
      new THREE.MeshLambertMaterial({ color: e.hostile ? 0xff4d4d : 0x88c0ff }),
    );
    mesh.position.set(e.position.x, e.position.y + 0.9, e.position.z);
    entityGroup.add(mesh);
    if (viewer.debug) {
      const box = new THREE.BoxHelper(mesh, e.hostile ? 0xff0000 : 0x00ffff);
      entityGroup.add(box);
    }
  }

  if (pathLine) {
    scene.remove(pathLine);
    pathLine.geometry.dispose();
    pathLine = null;
  }
  if (viewer.debug && world.path?.length > 1) {
    const pts = world.path.map((p) => new THREE.Vector3(p.x + 0.5, p.y + 0.2, p.z + 0.5));
    pathLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xffee55 }),
    );
    scene.add(pathLine);
  }

  const p = world.position;
  player.position.set(p.x + 0.5, p.y + 0.9, p.z + 0.5);
  const yaw = world.look?.yaw ?? 0;
  const pitch = world.look?.pitch ?? 0;
  player.rotation.y = yaw;

  const t = world.time?.timeOfDay ?? 1000;
  const dayFactor = t < 12000 ? 1 : Math.max(0.15, 1 - (t - 12000) / 8000);
  sun.intensity = 0.35 + dayFactor * 0.9;
  scene.background.set(dayFactor > 0.5 ? 0x87b6e0 : 0x0b1020);

  if (viewer.cameraMode === "fp") {
    camera.position.set(p.x + 0.5, p.y + 1.62, p.z + 0.5);
    camera.lookAt(
      camera.position.x - Math.sin(yaw),
      camera.position.y - Math.sin(pitch),
      camera.position.z + Math.cos(yaw),
    );
    player.visible = false;
  } else if (viewer.cameraMode === "tp") {
    player.visible = true;
    camera.position.set(p.x + 0.5 + Math.sin(yaw) * 5, p.y + 3.2, p.z + 0.5 - Math.cos(yaw) * 5);
    camera.lookAt(p.x + 0.5, p.y + 1.4, p.z + 0.5);
  } else {
    player.visible = true;
    camera.position.set(p.x + 10, p.y + 14, p.z + 10);
    camera.lookAt(p.x, p.y + 2, p.z);
  }
}

function loop() {
  requestAnimationFrame(loop);
  if (renderer && scene && camera) renderer.render(scene, camera);
}
