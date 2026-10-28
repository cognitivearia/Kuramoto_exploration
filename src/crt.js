// Vidrio del monitor, al modo de los tubos de Fallout.
// El desorden abre el color, el grano y el temblor.
// El ghosting guarda el cuadro anterior: el fósforo no suelta la imagen al instante.
// El polvo vive fuera del tubo, en el borde, y entra como viñeta.

export const CRTShader = {
  uniforms: {
    tDiffuse: { value: null },
    tGhost: { value: null },
    uTime: { value: 0 },
    uAberration: { value: 0 },
    uGrain: { value: 0.3 },
    uTear: { value: 0 },
    uWobble: { value: 0 },
    uShock: { value: 0 },
    uHasGhost: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tGhost;
    uniform float uTime;
    uniform float uAberration;
    uniform float uGrain;
    uniform float uTear;
    uniform float uWobble;
    uniform float uShock;
    uniform float uHasGhost;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 uv) {
      vec2 i = floor(uv);
      vec2 f = fract(uv);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float mote(vec2 uv, float scale, float chance) {
      vec2 g = uv * scale;
      vec2 id = floor(g);
      vec2 f = fract(g);
      float n = hash(id);
      vec2 p = vec2(hash(id + 1.7), hash(id + 9.2));
      float rad = mix(0.012, 0.07, hash(id + 4.4));
      float d = length(f - p);
      return (1.0 - smoothstep(rad * 0.15, rad, d)) * step(chance, n);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float curve = dot(centered, centered);
      vec2 uv = vUv + centered * curve * 0.1;

      float wave = sin(uv.y * 90.0 + uTime * 7.0);
      uv.x += wave * uWobble * 0.006;

      float band = sin(uv.y * 16.0 + uTime * 2.4);
      float tear = smoothstep(0.72, 1.0, band) * uTear * 0.045;
      uv.x += tear;

      float cells = mix(780.0, 210.0, clamp(uWobble, 0.0, 1.0));
      vec2 snapped = (floor(uv * cells) + 0.5) / cells;
      uv = mix(uv, snapped, uWobble * 0.65);

      float shift = uAberration * 0.007 + uShock * 0.012;
      float red = texture2D(tDiffuse, uv + vec2(shift, 0.0)).r;
      float green = texture2D(tDiffuse, uv).g;
      float blue = texture2D(tDiffuse, uv - vec2(shift, 0.0)).b;
      vec3 color = vec3(red, green, blue);

      vec2 trail = vec2(0.009, 0.0006);
      vec3 echo = texture2D(tDiffuse, uv - trail).rgb;
      vec3 echoFar = texture2D(tDiffuse, uv - trail * 2.4).rgb;
      color += echo * vec3(0.14, 0.42, 0.12);
      color += echoFar * vec3(0.04, 0.16, 0.03);

      vec3 held = texture2D(tGhost, uv - trail * 1.3).rgb;
      color = mix(color, held, 0.58 * uHasGhost);

      float scan = 0.52 + 0.48 * sin(uv.y * 920.0);
      color *= scan;

      float seed = fract(sin(dot(uv + fract(uTime * 0.13), vec2(12.9898, 78.233))) * 43758.5453);
      color += (seed - 0.5) * uGrain * 0.16;

      vec2 tube = centered / vec2(0.58, 0.5);
      float tubeDist = length(tube);
      float inside = smoothstep(1.12, 0.9, tubeDist);
      float rim = smoothstep(0.62, 1.08, tubeDist);
      float outside = smoothstep(0.96, 1.14, tubeDist);

      float vig = smoothstep(1.08, 0.22, tubeDist);
      color *= mix(0.22, 1.0, vig);

      float lip = smoothstep(0.72, 0.9, tubeDist) * smoothstep(1.16, 0.94, tubeDist);
      color *= 1.0 - lip * 0.62;

      float motes = mote(vUv, 48.0, 0.78) + mote(vUv, 110.0, 0.9) * 0.7;
      float grease = smoothstep(0.58, 0.9, noise(vUv * vec2(4.5, 3.2) + 1.4));
      float scratch = abs(fract(vUv.y * 9.0 + vUv.x * 0.35) - 0.5);
      float scratchId = hash(vec2(floor(vUv.y * 9.0), 2.0));
      scratch = (1.0 - smoothstep(0.0, 0.012, scratch)) * step(0.93, scratchId);

      color *= mix(1.0, 0.55, grease * rim * 0.85);
      color += vec3(0.2, 0.21, 0.16) * motes * rim;
      color += vec3(0.12, 0.14, 0.1) * scratch * rim * 0.7;

      vec3 glass = vec3(0.008, 0.011, 0.009);
      glass += vec3(0.15, 0.16, 0.12) * motes;
      glass += vec3(0.04, 0.045, 0.035) * grease;
      glass += vec3(0.1, 0.11, 0.09) * scratch;
      color = mix(color, glass, outside);

      color = mix(color, color * vec3(1.15, 0.62, 0.55), uShock * 0.55);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
