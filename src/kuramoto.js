// Kuramoto con un desfase pedido por el gesto.
// dθᵢ/dt = ωᵢ + (K / N) * Σ sin(θⱼ − θᵢ + φᵢ)
// φ es cuánto adelante o atrás dejaste ese nodo.
// Con φ = 0 la fórmula es el modelo clásico.
// φ vuelve a 0 en PHASE_HOLD segundos: el protocolo recoge el desfase.

export const TAU = Math.PI * 2;

// Segundos que un desfase arrastrado se mantiene antes de volver al grupo.
// Un pulso dura cerca de medio segundo. 4 s son varios pulsos, no uno.
export const PHASE_HOLD = 4;

const SPEC = [
  { personality: "pulso", base: 12.8 },
  { personality: "pulso", base: 12.2 },
  { personality: "arpegio", base: 6.6 },
  { personality: "arpegio", base: 6.1 },
  { personality: "aire", base: 2.4 },
  { personality: "aire", base: 2.15 },
  { personality: "falla", base: 8.8 },
  { personality: "falla", base: 5.2 },
];

const MEAN = SPEC.reduce((sum, item) => sum + item.base, 0) / SPEC.length;

export const LIMITS = {
  k: [0, 24],
  spread: [0, 1.8],
  solo: [-6, 8],
};

export function wrap(angle) {
  const turned = angle % TAU;
  return turned < 0 ? turned + TAU : turned;
}

export function angleDiff(a, b) {
  return wrap(a - b + Math.PI) - Math.PI;
}

function wrapSigned(angle) {
  return wrap(angle + Math.PI) - Math.PI;
}

export function createAgents(random = Math.random) {
  return SPEC.map((item, id) => {
    const theta = random() * TAU;
    return {
      id,
      personality: item.personality,
      pair: id % 2,
      center: MEAN,
      offset: item.base - MEAN,
      solo: 0,
      omega: item.base,
      phi: 0,
      theta,
      step: Math.floor((theta / TAU) * 8) % 8,
      wrapped: false,
      stepChanged: false,
    };
  });
}

export function applySpread(agents, spread) {
  for (const agent of agents) {
    const omega = agent.center + agent.offset * spread + agent.solo;
    agent.omega = Math.max(0.35, omega);
  }
}

function integrate(agents, k, dt) {
  const count = agents.length;
  const velocity = new Array(count);

  for (let i = 0; i < count; i += 1) {
    let pull = 0;
    const phase = agents[i].theta;
    const bias = agents[i].phi;
    for (let j = 0; j < count; j += 1) {
      if (j === i) continue;
      pull += Math.sin(agents[j].theta - phase + bias);
    }
    velocity[i] = agents[i].omega + (k / count) * pull;
  }

  for (let i = 0; i < count; i += 1) {
    const agent = agents[i];
    const previous = agent.theta;
    const previousStep = agent.step;
    const next = wrap(previous + velocity[i] * dt);
    agent.theta = next;
    if (velocity[i] > 0 && next < previous) agent.wrapped = true;
    const step = Math.floor((next / TAU) * 8) % 8;
    agent.step = step;
    if (step !== previousStep) agent.stepChanged = true;
  }
}

export function step(agents, k, dt) {
  for (const agent of agents) {
    agent.wrapped = false;
    agent.stepChanged = false;
  }

  let left = Math.min(Math.max(dt, 0), 0.1);
  while (left > 1e-6) {
    const slice = Math.min(0.01, left);
    integrate(agents, k, slice);
    left -= slice;
  }
}

export function orderParameter(agents) {
  let real = 0;
  let imag = 0;
  for (const agent of agents) {
    real += Math.cos(agent.theta);
    imag += Math.sin(agent.theta);
  }
  const count = agents.length;
  return {
    r: Math.hypot(real, imag) / count,
    psi: Math.atan2(imag, real),
  };
}

export function stateName(r) {
  if (r < 0.35) return "DESVÍO";
  if (r < 0.72) return "ACOPLADO";
  return "CERRADO";
}

export function nudgePhase(agent, delta) {
  agent.theta = wrap(agent.theta + delta);
  agent.phi = wrapSigned(agent.phi + delta);
}

export function relaxPhase(agents, dt, heldId = null) {
  const keep = Math.exp(-dt / PHASE_HOLD);
  for (const agent of agents) {
    if (agent.id === heldId) continue;
    agent.phi *= keep;
  }
}

export function shock(agents, ids = null) {
  const targets = ids ?? agents.map((agent) => agent.id);
  for (const id of targets) {
    const kick = (Math.random() - 0.5) * Math.PI * 1.7;
    agents[id].theta = wrap(agents[id].theta + kick);
    agents[id].phi = wrapSigned(agents[id].phi + kick);
  }
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
