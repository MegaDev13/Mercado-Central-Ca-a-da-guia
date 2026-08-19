const $ = (id) => document.getElementById(id);

function setLink(id, value) {
  const el = $(id);
  el.textContent = value;
  el.className = "value " + value;
}

function render(state) {
  setLink("agent", state.agent);
  setLink("cloud", state.cloud);
  setLink("server", state.server);
  setLink("player", state.player);
  $("mission").textContent = state.mission ?? "—";
  $("stage").textContent = state.stage ?? "—";
  $("progress").textContent = state.progress ?? 0;
  $("bar").style.width = `${state.progress ?? 0}%`;
  $("status").textContent = state.status;
  $("resources").textContent = state.resources;
  $("threat").textContent = state.threat;
  if (state.position) {
    $("position").textContent = `${state.position.x.toFixed(1)}  ${state.position.y.toFixed(1)}  ${state.position.z.toFixed(1)}`;
  }
  $("disconnect").textContent = `Última saída: ${state.lastDisconnect ?? "—"}`;
  const box = $("messages");
  box.innerHTML = (state.messages ?? [])
    .map(
      (m) =>
        `<article class="msg ${m.level}"><h3>${escapeHtml(m.title)}</h3><div>${escapeHtml(m.body)}</div></article>`,
    )
    .join("");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function poll() {
  try {
    const res = await fetch("/api/state");
    render(await res.json());
  } catch {
    setLink("agent", "OFFLINE");
  }
}

async function post(path, body) {
  await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  poll();
}

$("btn-plan").onclick = () => post("/api/plan", { intent: $("intent").value });
$("btn-start").onclick = () => post("/api/start");
$("btn-pause").onclick = () => post("/api/pause");
$("btn-resume").onclick = () => post("/api/resume");
$("btn-continue").onclick = () => post("/api/continue");
$("btn-creeper").onclick = () => post("/api/inject", { kind: "creeper" });
$("btn-zombie").onclick = () => post("/api/inject", { kind: "zombie" });
$("btn-night").onclick = () => post("/api/inject", { kind: "night" });
$("btn-day").onclick = () => post("/api/inject", { kind: "day" });
$("btn-dc").onclick = () => post("/api/disconnect");

setInterval(poll, 800);
poll();
