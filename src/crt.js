// Vidrio del monitor. El desorden abre el color, el grano y el temblor.
// La falla desgarra el barrido. El golpe enrojece el cuadro un instante.

export const CRTShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAberration: { value: 0 },
    uGrain: { value: 0.3 },
    uTear: { value: 0 },
    uWobble: { value: 0 },
    uShock: { value: 0 },
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
    uniform float uTime;
    uniform float uAberration;
    uniform float uGrain;
    uniform float uTear;
    uniform float uWobble;
    uniform float uShock;
    varying vec2 vUv;

    void main() {
      vec2 centered = vUv - 0.5;
      float curve = dot(centered, centered);
      vec2 uv = vUv + centered * curve * 0.08;

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

      float scan = 0.78 + 0.22 * sin(uv.y * 820.0);
      color *= scan;

      float seed = fract(sin(dot(uv + fract(uTime * 0.13), vec2(12.9898, 78.233))) * 43758.5453);
      color += (seed - 0.5) * uGrain * 0.16;

      float vignette = smoothstep(0.95, 0.28, length(centered));
      color *= vignette;
      color = mix(color, color * vec3(1.15, 0.62, 0.55), uShock * 0.55);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
