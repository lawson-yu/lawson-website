import { DoubleSide, ShaderMaterial, Vector2, Vector3 } from "three";
import { createZeroTexture } from "./cloud-model.ts";
import { APPEARANCE, type Appearance } from "./appearance.ts";

// 在 OKLab 中缩小色度，保持原版渐变的亮度与色相。
export function soften(hex: string, chroma = 0.6) {
  const rgb = hex.match(/[a-f\d]{2}/gi)!.map((v) => parseInt(v, 16) / 255);
  const [r, g, b] = rgb.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = (1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s) * chroma;
  const bb = (0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s) * chroma;
  const ll = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3;
  const ss = (L - 0.0894841775 * a - 1.291485548 * bb) ** 3;
  return [4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss,
    -1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss,
    -0.0041960863 * ll - 0.7034186147 * mm + 1.707614701 * ss]
    .map((v) => Math.max(0, Math.min(1, v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)));
}

function ramp(name: string, uniform: string) {
  return `vec3 ${name}(float t) {
    vec3 c = mix(${uniform}[0], ${uniform}[1], clamp(t / .32, 0., 1.));
    return mix(c, ${uniform}[2], clamp((t - .32) / .68, 0., 1.));
  }`;
}

export function updateGrainAppearance(material: ShaderMaterial, appearance: Appearance) {
  const u = material.uniforms;
  for (const [i, key] of (["base", "middle", "accent"] as const).entries()) {
    const soft = soften(appearance[key]);
    const full = soften(appearance[key], 1);
    if (!u.uRamp.value[i].equals(new Vector3(...soft))) u.uRamp.value[i].set(...soft);
    if (!u.uTouched.value[i].equals(new Vector3(...full))) u.uTouched.value[i].set(...full);
  }
  if (u.uGrain.value !== appearance.filmGrain) u.uGrain.value = appearance.filmGrain;
}

export const vertexShader = /* glsl */`
  attribute vec3 aHome;
  attribute vec2 aRef;
  uniform sampler2D uState, uFlow;
  uniform vec2 uOrigin, uCenter, uViewport, uPointer;
  uniform float uSpan, uUnits, uSize, uStreak, uRadius, uScatter, uModelScale, uDisturb;
  varying vec3 vGrad, vTouched;
  varying vec2 vNdc;
  varying float vInk, vDrop, vTail, vFade;
  uniform vec3 uRamp[3], uTouched[3];
  ${ramp("ramp", "uRamp")}
  ${ramp("touched", "uTouched")}
  void main() {
    vec4 st = texture2D(uState, aRef);
    vec3 r = fract(sin(vec3(dot(aRef,vec2(12.9898,78.233)), dot(aRef,vec2(39.3468,11.135)), dot(aRef,vec2(73.156,52.235)))) * vec3(43758.5453,24634.6345,9631.7453));
    float k = uScatter * uScatter;
    vec3 fling = normalize(r - .5 + 1e-3) * (.35 + .65 * r.x) * 2.5;
    vec3 drift = vec3(sin(r.y * 6.28318530718), cos(r.z * 6.28318530718), 0.) * .01;
    vDrop = 0.;
    vec3 p = aHome + vec3(st.xy * uUnits, 0.) + (fling + drift) * k * uModelScale;
    vec4 c = projectionMatrix * modelViewMatrix * vec4(p, 1.);
    vec4 cv = projectionMatrix * modelViewMatrix * vec4(p + vec3(st.zw * uUnits, 0.), 1.);
    vec2 v = (cv.xy / cv.w - c.xy / c.w) * .5 * uViewport;
    float speed = length(v);
    vec2 dir = speed > 1e-6 ? v / speed : vec2(1., 0.);
    float len = min(speed * 1.25, 18.) * uStreak;
    float h = min(mix(1.6, .85, uScatter), uSize * (1. - .45 * uScatter) / (2. * c.w) * .5 * uViewport.y);
    vFade = smoothstep(0., 1.5, len);
    vec2 axis = normalize(mix(vec2(1.,0.), dir * (dir.x < 0. ? -1. : 1.), vFade));
    vec2 lc = position.xy * vec2(h + len / 2., h);
    vec2 off = axis * lc.x + vec2(-axis.y, axis.x) * lc.y - dir * len / 2.;
    vTail = (dot(off, -dir) - h) / max(len, 1e-3);
    vec2 delta = (c.xy / c.w - uPointer) * vec2(uViewport.x / uViewport.y, 1.);
    vec2 push = delta * exp(-dot(delta, delta) / .035) * .65 * k * uDisturb;
    c.xy += push / vec2(uViewport.x / uViewport.y, 1.) * c.w;
    vNdc = c.xy / c.w;
    c.xy += off / uViewport * 2. * c.w;
    gl_Position = c;
    float t = distance(aHome.xy, uCenter) / uRadius;
    vGrad = ramp(t);
    vTouched = touched(t);
    vInk = clamp(texture2D(uFlow, clamp((p.xy - uOrigin) / uSpan, 0., 1.)).w, 0., 1.);
  }
`;

export const fragmentShader = /* glsl */`
  uniform vec2 uViewport, uHead;
  uniform float uGrain, uDim, uHeadR;
  varying vec3 vGrad, vTouched;
  varying vec2 vNdc;
  varying float vInk, vDrop, vTail, vFade;
  float hash(vec2 p, vec2 q, float k) { return fract(sin(dot(p,q)) * k); }
  vec3 overlay(vec3 a, vec3 b) { return mix(2. * a * b, 1. - 2. * (1. - a) * (1. - b), step(.5, a)); }
  vec3 srgbToLinear(vec3 c) { return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(vec3(.04045), c)); }
  void main() {
    if (vDrop > .5 || clamp(vTail,0.,1.) * .55 * vFade > hash(gl_FragCoord.xy,vec2(12.9898,78.233),43758.5453)) discard;
    vec3 col = mix(vGrad, vTouched, vInk * .6);
    col = mix(col, overlay(col, vec3(hash(gl_FragCoord.xy,vec2(39.3468,11.135),24634.6345))), uGrain);
    float r = length((vNdc - uHead) * vec2(uViewport.x / uViewport.y, 1.)) / uHeadR;
    float edge = smoothstep(.3, 1.3, r);
    float dir = -clamp(uHead.x / .3, -1., 1.);
    float side = smoothstep(-.2, 1., dir * (vNdc.x - uHead.x));
    col *= (1. - uDim * .1) * (1. - uDim * .6 * edge) * (1. - uDim * .45 * side);
    gl_FragColor = vec4(srgbToLinear(col), 1.);
    #include <colorspace_fragment>
  }
`;

export function createGrainMaterial(appearance = APPEARANCE, floatTextures = true) {
  const zero = createZeroTexture(floatTextures);
  const material = new ShaderMaterial({
    name: "grains",
    side: DoubleSide,
    vertexShader,
    fragmentShader,
    uniforms: {
      uState: { value: zero }, uFlow: { value: zero },
      uRamp: { value: [new Vector3(), new Vector3(), new Vector3()] },
      uTouched: { value: [new Vector3(), new Vector3(), new Vector3()] },
      uOrigin: { value: new Vector2() }, uSpan: { value: 1 },
      uUnits: { value: 1 }, uSize: { value: appearance.particleSize }, uStreak: { value: 0.8 },
      uViewport: { value: new Vector2(1, 1) }, uCenter: { value: new Vector2(0, 0.10) },
      uRadius: { value: 0.40 }, uGrain: { value: appearance.filmGrain }, uModelScale: { value: 1 },
      uScatter: { value: 0 }, uDim: { value: 0 },
      uPointer: { value: new Vector2() }, uDisturb: { value: 0 },
      uHead: { value: new Vector2() }, uHeadR: { value: 1 },
    },
  });
  updateGrainAppearance(material, appearance);
  return { material, zero };
}
