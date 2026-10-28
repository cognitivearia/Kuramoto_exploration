import "./style.css";
import {
  applySpread,
  clamp,
  createAgents,
  LIMITS,
  orderParameter,
  shock,
  stateName,
  step,
} from "./kuramoto.js";
import { createWorld } from "./scene.js";
import { createAudio } from "./audio.js";

const canvas = document.querySelector("#view");
const world = createWorld(canvas);
const agents = createAgents();

const ui = {
  state: document.querySelector("#state"),
  meter: document.querySelector("#meter"),
  k: document.querySelector("#k"),
  spread: document.querySelector("#spread"),
  r: document.querySelector("#r"),
  help: document.querySelector("#help"),
  node: document.querySelector("#node"),
  voices: [...document.querySelectorAll(".voices b")],
  enterWrap: document.querySelector("#enter-wrap"),
  enter: document.querySelector("#enter"),
};

let k = 1.2;
let spread = 1;
let selected = null;
let shockAmount = 0;
let shockEdge = false;
let audio = null;
let muted = false;
let dragging = null;
let moved = 0;

const NAMES = {
  pulso: "PULSO",
  arpegio: "ARPEGIO",
  aire: "AIRE",
  falla: "FALLA",
};

function setK(next) {
  k = clamp(next, LIMITS.k[0], LIMITS.k[1]);
}

function setSpread(next) {
  spread = clamp(next, LIMITS.spread[0], LIMITS.spread[1]);
}

function nudgeSolo(agent, delta) {
  agent.solo = clamp(agent.solo + delta, LIMITS.solo[0], LIMITS.solo[1]);
}

function perturb(all) {
  const ids = !all && selected !== null ? [selected] : null;
  shock(agents, ids);
  shockAmount = 1;
  shockEdge = true;
}

async function enterSystem() {
  if (audio || ui.enter.disabled) return;
  ui.enter.disabled = true;
  ui.enter.textContent = "ABRIENDO";
  try {
    audio = await createAudio(agents);
    ui.enterWrap.hidden = true;
  } catch (error) {
    ui.enter.disabled = false;
    ui.enter.textContent = "ENTRAR";
    ui.help.textContent = "El audio no arrancó. Vuelve a entrar.";
    console.error(error);
  }
}

ui.enter.addEventListener("click", enterSystem);

window.addEventListener("resize", () => world.resize());

window.addEventListener("keydown", (event) => {
  if (!audio && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    enterSystem();
    return;
  }
  if (event.key === "ArrowUp") setK(k + 0.45);
  if (event.key === "ArrowDown") setK(k - 0.45);
  if (event.key === "ArrowRight") setSpread(spread + 0.04);
  if (event.key === "ArrowLeft") setSpread(spread - 0.04);
  if (event.key === " " && audio) {
    event.preventDefault();
    perturb(event.shiftKey);
  }
  if (event.key === "r" || event.key === "R") {
    for (const agent of agents) agent.theta = Math.random() * Math.PI * 2;
  }
  if ((event.key === "m" || event.key === "M") && audio) {
    muted = !muted;
    audio.setMuted(muted);
  }
  if (event.key >= "1" && event.key <= "8") selected = Number(event.key) - 1;
  if (event.key === "Escape") selected = null;
});

canvas.addEventListener("pointerdown", (event) => {
  if (!audio) return;
  canvas.setPointerCapture(event.pointerId);
  const id = world.pick(event.clientX, event.clientY);
  dragging = id === null ? "protocol" : id;
  selected = id === null ? selected : id;
  moved = 0;
  document.body.classList.add("grabbing");
});

canvas.addEventListener("pointermove", (event) => {
  if (!audio) return;
  const hover = world.pick(event.clientX, event.clientY);
  canvas.style.cursor = dragging !== null ? "grabbing" : hover === null ? "crosshair" : "grab";
  if (dragging === null) return;
  moved += Math.abs(event.movementX) + Math.abs(event.movementY);
  if (dragging === "protocol") {
    setK(k - event.movementY * 0.028);
    return;
  }
  const agent = agents[dragging];
  agent.theta += event.movementX * 0.01;
  nudgeSolo(agent, -event.movementY * 0.012);
});

canvas.addEventListener("pointerup", () => {
  if (dragging === "protocol" && moved < 4) selected = null;
  dragging = null;
  document.body.classList.remove("grabbing");
});

window.protocolo = {
  agents,
  get k() { return k; },
  get spread() { return spread; },
  get selected() { return selected; },
};

let last = performance.now();
let clock = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;

  applySpread(agents, spread);
  step(agents, k, dt);
  const { r, psi } = orderParameter(agents);
  shockAmount *= Math.exp(-(0.55 + k * 0.18) * dt);

  const view = world.update({
    agents,
    psi,
    r,
    shock: shockAmount,
    selected,
    time: clock,
    dt,
  });

  if (audio) {
    audio.update(agents, psi, r, shockEdge);
    shockEdge = false;
  }

  ui.state.textContent = stateName(r);
  ui.meter.style.width = `${Math.round(r * 100)}%`;
  ui.k.textContent = k.toFixed(1);
  ui.spread.textContent = spread.toFixed(2);
  ui.r.textContent = r.toFixed(2);
  ui.node.textContent = selected === null
    ? "NINGÚN NODO"
    : `NODO ${selected + 1} · ${NAMES[agents[selected].personality]}`;

  ui.voices.forEach((item) => {
    const level = view.levels[item.dataset.voice];
    item.style.opacity = String(0.28 + level * 0.72);
  });

  window.protocolo.r = r;
  window.protocolo.psi = psi;
  window.protocolo.state = stateName(r);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
