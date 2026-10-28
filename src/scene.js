import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { angleDiff } from "./kuramoto.js";
import { CRTShader } from "./crt.js";

const PHOSPHOR = 0xc8ffd9;
const DIM = 0x163528;
const IDLE = 0x10281c;

const COLUMNS = {
  pulso: -2.15,
  arpegio: -0.72,
  aire: 0.72,
  falla: 2.15,
};

function basic(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity === 1,
  });
}

function label(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, 256, 64);
  context.fillStyle = "#8eeeb0";
  context.font = "500 28px monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 128, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  sprite.scale.set(1.15, 0.29, 1);
  return sprite;
}

function makePulso() {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 8, 40), basic(DIM));
  const horizontal = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 0.012), basic(DIM));
  const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.5, 0.012), basic(DIM));
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), basic(PHOSPHOR));
  group.add(ring, horizontal, vertical, dot);
  return { group, parts: [ring, horizontal, vertical], dot };
}

function makeArpegio() {
  const group = new THREE.Group();
  const steps = [];
  for (let i = 0; i < 8; i += 1) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.055, 0.055), basic(IDLE));
    box.position.y = (i - 3.5) * 0.085;
    group.add(box);
    steps.push(box);
  }
  return { group, steps };
}

function makeAire() {
  const group = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.008, 6, 48), basic(DIM, 0.9));
  const inner = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.008, 6, 32), basic(DIM, 0.9));
  group.add(outer, inner);
  return { group, rings: [outer, inner] };
}

function makeFalla() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), basic(DIM));
  body.material.wireframe = true;
  group.add(body);
  return { group, body };
}

function hitSphere() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 10, 10),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  );
  return mesh;
}

function backPanel() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uR: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uR;
      void main() {
        vec2 grid = vUv * vec2(42.0, 22.0);
        vec2 cell = abs(fract(grid) - 0.5);
        float line = smoothstep(0.08, 0.015, min(cell.x, cell.y));
        float scan = 0.7 + 0.3 * sin(vUv.y * 120.0 + uTime * 1.5);
        vec3 color = vec3(0.012, 0.028, 0.02);
        color += vec3(0.04, 0.16, 0.09) * line * (0.2 + uR * 0.8) * scan;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

function frame() {
  const material = new THREE.MeshStandardMaterial({
    color: 0x121614,
    roughness: 0.78,
    metalness: 0.16,
  });
  const group = new THREE.Group();
  const pieces = [
    [6.7, 0.16, 0.28, 0, 1.95, 0],
    [6.7, 0.16, 0.28, 0, -1.95, 0],
    [0.16, 4.06, 0.28, -3.35, 0, 0],
    [0.16, 4.06, 0.28, 3.35, 0, 0],
  ];
  for (const [w, h, d, x, y, z] of pieces) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
  }
  return group;
}

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ReinhardToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050806);
  scene.fog = new THREE.FogExp2(0x050806, 0.072);

  const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 30);
  const cameraBase = new THREE.Vector3(0.12, 0.22, 5.35);
  camera.position.copy(cameraBase);

  scene.add(new THREE.AmbientLight(0xc8ffd9, 0.18));
  const light = new THREE.PointLight(0xc8ffd9, 6, 14, 2);
  light.position.set(0, 0.4, 2.4);
  scene.add(light);

  const panelMaterial = backPanel();
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.5), panelMaterial);
  panel.position.z = -0.55;
  scene.add(panel);
  scene.add(frame());

  const nodes = [];
  const raycastTargets = [];

  const personalities = ["pulso", "pulso", "arpegio", "arpegio", "aire", "aire", "falla", "falla"];
  personalities.forEach((personality, id) => {
    const pair = id % 2;
    let visual;
    if (personality === "pulso") visual = makePulso();
    else if (personality === "arpegio") visual = makeArpegio();
    else if (personality === "aire") visual = makeAire();
    else visual = makeFalla();

    const root = new THREE.Group();
    root.position.set(COLUMNS[personality], pair === 0 ? 0.5 : -0.7, pair === 0 ? 0.08 : -0.16);
    root.add(visual.group);
    const hit = hitSphere();
    hit.userData.agentId = id;
    root.add(hit);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.006, 6, 40), basic(PHOSPHOR, 0));
    root.add(ring);
    scene.add(root);
    raycastTargets.push(hit);
    nodes.push({ id, personality, root, visual, ring, flash: 0 });
  });

  for (const name of ["PULSO", "ARPEGIO", "AIRE", "FALLA"]) {
    const key = name.toLowerCase();
    const sprite = label(name);
    sprite.position.set(COLUMNS[key], -1.5, 0.1);
    scene.add(sprite);
  }

  const dial = new THREE.Group();
  dial.position.set(0, 1.38, 0.12);
  dial.add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.006, 6, 32), basic(DIM)));
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.18, 0.012), basic(PHOSPHOR));
  hand.position.y = 0.08;
  const handPivot = new THREE.Group();
  handPivot.add(hand);
  dial.add(handPivot);
  scene.add(dial);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.52,
    0.32,
    0.42,
  );
  composer.addPass(bloom);
  const crt = new ShaderPass(CRTShader);
  composer.addPass(crt);
  composer.addPass(new OutputPass());

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const look = new THREE.Vector3(0, 0.02, 0);

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    composer.setSize(width, height);
  }

  function paint(node, color, intensity) {
    const materialColor = intensity > 0.55 ? PHOSPHOR : color;
    const list = node.visual.parts || node.visual.rings || [node.visual.body];
    for (const mesh of list) {
      mesh.material.color.setHex(materialColor);
      mesh.material.opacity = node.personality === "aire" ? 0.45 + intensity * 0.55 : 1;
    }
  }

  function update(state) {
    const { agents, psi, r, shock, selected, time, dt } = state;
    let tear = 0;
    let breath = 0;
    let fallaCount = 0;
    let aireCount = 0;
    const levels = { pulso: 0, arpegio: 0, aire: 0, falla: 0 };

    agents.forEach((agent, index) => {
      const node = nodes[index];
      if (agent.wrapped || agent.stepChanged) node.flash = 1;
      node.flash *= Math.exp(-dt * 10);
      const error = angleDiff(agent.theta, psi);
      const disagreement = (1 - Math.cos(error)) / 2;

      if (agent.personality === "pulso") {
        node.visual.group.rotation.z = -agent.theta;
        node.visual.dot.scale.setScalar(0.6 + node.flash * 2.4);
        paint(node, DIM, node.flash);
        levels.pulso = Math.max(levels.pulso, node.flash);
      }

      if (agent.personality === "arpegio") {
        node.visual.steps.forEach((box, step) => {
          const active = step === agent.step;
          box.material.color.setHex(active ? PHOSPHOR : IDLE);
          box.scale.z = active ? 1.8 : 1;
        });
        levels.arpegio = Math.max(levels.arpegio, node.flash);
      }

      if (agent.personality === "aire") {
        const swell = Math.sin(agent.theta) * 0.5 + 0.5;
        node.visual.group.scale.setScalar(0.78 + swell * 0.42);
        node.visual.group.rotation.z = agent.theta * 0.25;
        paint(node, DIM, 0.35 + swell * 0.65);
        breath += Math.sin(agent.theta);
        aireCount += 1;
        levels.aire = Math.max(levels.aire, swell);
      }

      if (agent.personality === "falla") {
        node.visual.group.position.set(Math.sin(error) * 0.18, disagreement * 0.08, 0);
        node.visual.group.rotation.set(time * 0.35, agent.theta, error * 0.4);
        const hot = Math.min(1, disagreement + shock);
        node.visual.body.material.color.setHex(hot > 0.45 ? PHOSPHOR : DIM);
        tear += disagreement;
        fallaCount += 1;
        levels.falla = Math.max(levels.falla, disagreement);
      }

      const chosen = selected === agent.id;
      node.ring.material.opacity = chosen ? 0.9 : 0;
      node.root.position.z = (agent.pair === 0 ? 0.08 : -0.16) + (chosen ? 0.12 : 0);
    });

    tear = fallaCount ? tear / fallaCount : 0;
    breath = aireCount ? breath / aireCount : 0;

    handPivot.rotation.z = -psi;
    hand.scale.y = 0.45 + r * 1.1;
    dial.children[0].material.color.setHex(r > 0.72 ? PHOSPHOR : DIM);

    light.intensity = 4.2 + breath * 1.8 + r * 1.4;
    const hue = 0.39 - shock * 0.42;
    light.color.setHSL(hue, 0.75, 0.62);
    panelMaterial.uniforms.uTime.value = time;
    panelMaterial.uniforms.uR.value = r;

    const drift = 1 - r;
    const shake = shock;
    camera.position.set(
      cameraBase.x + Math.sin(time * 0.65) * drift * 0.09 + shake * 0.22,
      cameraBase.y + Math.cos(time * 0.5) * drift * 0.06 + shake * 0.08,
      cameraBase.z,
    );
    camera.up.set(Math.sin(shake) * 0.18, 1, 0);
    camera.lookAt(look);
    const nextFov = 36 + shake * 7 + drift * 1.2;
    if (Math.abs(camera.fov - nextFov) > 0.02) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }

    crt.uniforms.uTime.value = time;
    crt.uniforms.uAberration.value = drift;
    crt.uniforms.uGrain.value = 0.22 + drift * 0.78;
    crt.uniforms.uTear.value = tear;
    crt.uniforms.uWobble.value = drift;
    crt.uniforms.uShock.value = shock;

    composer.render();
    return { levels, tear };
  }

  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(raycastTargets, false);
    return hits.length ? hits[0].object.userData.agentId : null;
  }

  return { resize, update, pick };
}
