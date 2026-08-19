import { initViewer, applyWorld, viewer } from "./viewer.js";

const $ = (id) => document.getElementById(id);
initViewer($("viewport"));

let dest = "simulated";

function setLink(el, value) {
  el.textContent = value;
  el.className = value;
}

function render(s) {
  setLink($("server"), s.server);
  setLink($("player"), s.player);
  setLink($("cloud"), s.cloud);
  $("xbox-status").textContent =
    s.xbox.status === "authenticated" ? "AUTENTICADO" : s.xbox.status === "pending" ? "AGUARDANDO CÓDIGO" : "NÃO AUTENTICADO";
  $("xbox-status").className = "value " + (s.xbox.status === "authenticated" ? "AUTENTICADO" : s.xbox.status === "pending" ? "PENDING" : "OFFLINE");
  $("xbox-profile").textContent = s.xbox.gamertag
    ? `Gamertag: ${s.xbox.gamertag}${s.xbox.xuid ? " · Xbox ID: " + s.xbox.xuid : ""}`
    : "Gamertag —";
  $("xbox-code").textContent = s.xbox.userCode ? `${s.xbox.verificationUri}  código ${s.xbox.userCode}` : "";
  $("mission").textContent = s.mission ?? "—";
  $("stage").textContent = s.stage ?? "—";
  $("progress").textContent = s.progress ?? 0;
  $("bar").style.width = `${s.progress ?? 0}%`;
  $("status").textContent = s.status;
  $("resources").textContent = s.resources;
  $("threat").textContent = s.threat;
  if (s.position) {
    $("position").textContent = `X ${s.position.x.toFixed(2)}   Y ${s.position.y.toFixed(2)}   Z ${s.position.z.toFixed(2)}`;
  }
  $("pos-src").textContent = s.positionState
    ? `fonte: ${s.positionState.source} · desync ${s.positionState.desync.toFixed(2)}`
    : "fonte: —";
  $("time").textContent = s.timeLabel ?? "TEMPO —";
  $("lat-mc").textContent = s.latency?.minecraft ?? "—";
  $("lat-cloud").textContent = s.latency?.cloud ?? "—";
  $("session-warn").classList.toggle("hidden", !s.sessionConflict);
  $("stages").innerHTML = (s.stages ?? [])
    .map((st) => `<li>${st.status === "completed" ? "✓" : st.status === "running" ? "▶" : "·"} ${st.name} ${st.progress}%</li>`)
    .join("");
  $("inv").innerHTML = (s.inventory?.items ?? [])
    .slice(0, 12)
    .map((i) => `<div>${i.identifier} × ${i.count}</div>`)
    .join("");
  $("mats").innerHTML = (s.materials ?? [])
    .map((m) => {
      const short = m.identifier.replace("minecraft:", "");
      return `<div>${short}: disp ${m.available} / nec ${m.required}${m.deficit ? " · déficit " + m.deficit : ""}</div>`;
    })
    .join("");
  $("act-now").textContent = s.actions?.[0]?.name ?? "—";
  $("queue").innerHTML = (s.actions ?? []).slice(0, 8).map((a) => `<li>${a.name}${a.detail ? " — " + a.detail : ""}</li>`).join("");
  $("log").innerHTML = (s.logs ?? [])
    .slice()
    .reverse()
    .slice(0, 40)
    .map((l) => `<div>[${l.ts.slice(11, 19)}] ${l.message}</div>`)
    .join("");
  const alert = s.alerts?.[0];
  const banner = $("alert-banner");
  if (alert) {
    banner.classList.remove("hidden");
    banner.textContent = `${alert.title}\n\n${alert.body}`;
  } else banner.classList.add("hidden");
}

async function poll() {
  try {
    const [st, world] = await Promise.all([fetch("/api/state").then((r) => r.json()), fetch("/api/world").then((r) => r.json())]);
    render(st);
    applyWorld(world);
  } catch {
    setLink($("server"), "OFFLINE");
  }
}

async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  poll();
  return res.json().catch(() => ({}));
}

$("btn-xbox").onclick = () => post("/api/xbox/start");
$("btn-plan").onclick = () => post("/api/plan", { intent: $("intent").value });
$("btn-start").onclick = () => post("/api/start");
$("btn-pause").onclick = () => post("/api/pause");
$("btn-resume").onclick = () => post("/api/resume");
$("btn-continue").onclick = () => post("/api/continue");
$("btn-dc").onclick = () => post("/api/disconnect");
$("btn-emg").onclick = () => post("/api/emergency");
$("btn-creeper").onclick = () => post("/api/inject", { kind: "creeper" });
$("btn-zombie").onclick = () => post("/api/inject", { kind: "zombie" });
$("btn-night").onclick = () => post("/api/inject", { kind: "night" });
$("btn-day").onclick = () => post("/api/inject", { kind: "day" });
$("btn-desync").onclick = () => post("/api/inject", { kind: "desync" });
$("btn-obs").onclick = () => post("/api/control", { mode: "observe" });
$("btn-manual").onclick = () => post("/api/control", { mode: "manual" });
$("btn-agent").onclick = () => post("/api/control", { mode: "agent" });

function setDest(mode) {
  dest = mode;
  $("tab-sim").classList.toggle("on", mode === "simulated");
  $("tab-srv").classList.toggle("on", mode === "server");
  $("tab-realm").classList.toggle("on", mode === "realm");
  $("form-srv").classList.toggle("hidden", mode !== "server");
  $("form-realm").classList.toggle("hidden", mode !== "realm");
}
$("tab-sim").onclick = () => setDest("simulated");
$("tab-srv").onclick = () => setDest("server");
$("tab-realm").onclick = () => setDest("realm");

$("btn-join").onclick = () =>
  post("/api/connect", {
    mode: dest,
    host: $("host").value,
    port: Number($("port").value) || 19132,
    realmId: $("realm-id").value,
    realmInvite: $("realm-invite").value,
    offline: dest === "simulated",
  });

$("btn-realms").onclick = async () => {
  const list = await fetch("/api/realms").then((r) => r.json());
  $("realm-list").innerHTML = (list ?? [])
    .map((r) => `<button data-id="${r.id}">${r.name}</button>`)
    .join("") || "<p class='muted'>Nenhum Realm (auth + prismarine-realms).</p>";
  $("realm-list").onclick = (ev) => {
    const id = ev.target?.dataset?.id;
    if (id) $("realm-id").value = id;
  };
};

$("cam-fp").onclick = () => {
  viewer.cameraMode = "fp";
  $("cam-fp").classList.add("on");
  $("cam-tp").classList.remove("on");
  $("cam-orbit").classList.remove("on");
};
$("cam-tp").onclick = () => {
  viewer.cameraMode = "tp";
  $("cam-tp").classList.add("on");
  $("cam-fp").classList.remove("on");
  $("cam-orbit").classList.remove("on");
};
$("cam-orbit").onclick = () => {
  viewer.cameraMode = "orbit";
  $("cam-orbit").classList.add("on");
  $("cam-fp").classList.remove("on");
  $("cam-tp").classList.remove("on");
};
$("tog-debug").onclick = () => {
  viewer.debug = !viewer.debug;
  $("tog-debug").classList.toggle("on", viewer.debug);
};
$("tog-bp").onclick = () => {
  viewer.showBlueprint = !viewer.showBlueprint;
  $("tog-bp").classList.toggle("on", viewer.showBlueprint);
};

window.addEventListener("keydown", (e) => {
  const step = { w: { z: 1 }, s: { z: -1 }, a: { x: 1 }, d: { x: -1 }, q: { y: 1 }, e: { y: -1 } }[e.key];
  if (step) post("/api/manual/move", step);
});

setInterval(poll, 250);
poll();
