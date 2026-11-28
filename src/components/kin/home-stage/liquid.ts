import { HalfFloatType, LinearFilter, Vector2, type WebGLRenderer } from "three";
import { GPUComputationRenderer } from "three/addons/misc/GPUComputationRenderer.js";
import { flowField, type CloudModel } from "../cloud-model.ts";
import { APPEARANCE } from "../appearance.ts";

const uniforms = /* glsl */`
  uniform vec2 uMouse, uVel, uOrigin;
  uniform float uSpan, uUnits, uPresence, uDecay, uInkDecay, uDt, uTime;
  uniform float uRadius, uInkRadius, uStrength, uSpread, uTurb, uReturn;
`;

export const flowShader = /* glsl */`
  ${uniforms}
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec2 texel = 1. / resolution.xy;
    vec2 suv = uv - texture2D(flow, uv).xy * texel * 2.5;
    vec4 c = texture2D(flow, suv) * .52 + .12 * (
      texture2D(flow, suv + vec2(texel.x, 0.)) + texture2D(flow, suv - vec2(texel.x, 0.)) +
      texture2D(flow, suv + vec2(0., texel.y)) + texture2D(flow, suv - vec2(0., texel.y)));
    vec2 d = (uOrigin + uv * uSpan - uMouse) / uUnits;
    float f = exp(-dot(d,d) / (uRadius * uRadius)) * uPresence;
    vec2 v = c.xy + uVel * f * .22;
    float p = max(c.z, f * clamp(length(uVel) * 2.5, 0., 1.));
    v *= uDecay;
    p *= uDecay;
    v = sign(v) * max(abs(v) - 1.2 / 127., 0.);
    p = max(p - 1.2 / 255., 0.);
    float ink = max(max(c.w * uInkDecay - .002, 0.), exp(-dot(d,d) / (uInkRadius * uInkRadius)) * uPresence);
    gl_FragColor = vec4(clamp(v, -1., 1.), p, ink);
  }
`;

export const stateShader = /* glsl */`
  ${uniforms}
  uniform sampler2D uHome;
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * f * (f * (f * 6. - 15.) + 10.);
    return mix(mix(hash(i), hash(i + vec2(1.,0.)), u.x),
      mix(hash(i + vec2(0.,1.)), hash(i + vec2(1.,1.)), u.x), u.y);
  }
  vec2 curl(vec2 p) {
    float e = .35;
    return vec2(noise(p + vec2(0.,e)) - noise(p - vec2(0.,e)),
      noise(p - vec2(e,0.)) - noise(p + vec2(e,0.))) / (2. * e);
  }
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 hm = texture2D(uHome, uv);
    if (hm.w <= 0.) { gl_FragColor = vec4(0.); return; }
    vec4 st = texture2D(state, uv);
    vec2 off = st.xy, vel = st.zw;
    float sd = hm.z, light = .45 + sd * 1.1;
    vec2 p = hm.xy / uUnits + off;
    vec4 fl = texture2D(flow, clamp((hm.xy + off * uUnits - uOrigin) / uSpan, 0., 1.));
    vec2 toM = p - uMouse / uUnits;
    float r2 = dot(toM, toM);
    float f = exp(-r2 / (uRadius * uRadius)) * uPresence;
    vec2 n = toM * inversesqrt(r2 + 1.);
    float e = clamp(fl.z * 2. + f, 0., 1.);
    vec2 acc = n * f * 1.25 * uStrength * uSpread * light;
    acc += vec2(-n.y, n.x) * f * 1.45 * uStrength * uSpread * (.4 + sd);
    acc += (fl.xy * 42. * uSpread * light - vel) * e * .08;
    vec2 q = p * .0095 + vec2(uTime * .35, -uTime * .2);
    acc += (curl(q) + .5 * curl(q * 2.3 + 7.1)) * e * 1.2 * uSpread * uTurb * light;
    acc -= off * (.006 + .02 * uReturn) * (.65 + sd * .7);
    vel += acc * uDt;
    vel *= pow(mix(.93, .955, e), uDt);
    off += vel * uDt;
    if (dot(off,off) < .0004 && dot(vel,vel) < .0004) { off = vec2(0.); vel = vec2(0.); }
    gl_FragColor = vec4(off, vel);
  }
`;

const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));

// 用原版帧单位衰减输入；退场尾帧结束后可停止整个 R3F 帧循环。
export class LiquidInput {
  mouse = new Vector2();
  target = new Vector2();
  wake = new Vector2();
  velocity = new Vector2();
  presence = 0;
  time = 0;
  remaining = 0;
  lastMove = -Infinity;
  on = false;
  initialized = false;

  move(point: Vector2, now: number) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    this.target.copy(point);
    if (!this.initialized) { this.mouse.copy(point); this.initialized = true; }
    this.on = true;
    this.lastMove = now;
    this.remaining = 270;
  }

  leave() { this.on = false; }

  reset() {
    this.on = false;
    this.initialized = false;
    this.presence = this.remaining = 0;
    this.wake.set(0, 0);
    this.velocity.set(0, 0);
  }

  step(dt: number, now: number, units: number) {
    const f = Math.max(.25, Math.min(3, Math.max(0, Math.min(.25, dt)) * 60));
    const live = this.on && now - this.lastMove < 1500;
    const presence = live ? 1 : 0;
    this.presence += (presence - this.presence) * (1 - (1 - (live ? .1 : .035)) ** f);
    if (!live && this.presence < .001) this.presence = 0;
    const x = this.mouse.x, y = this.mouse.y;
    this.mouse.lerp(this.target, 1 - .78 ** f);
    this.wake.x += (clamp((this.mouse.x - x) / units / f, 60) - this.wake.x) * .5;
    this.wake.y += (clamp((this.mouse.y - y) / units / f, 60) - this.wake.y) * .5;
    this.velocity.set(clamp(this.wake.x / 40, 1), clamp(this.wake.y / 40, 1));
    this.time += f / 60 * (1 + this.presence * 1.6);
    if (this.presence > 0) this.remaining = 270;
    else this.remaining = Math.max(0, this.remaining - f);
    return f;
  }

  get running() { return this.presence > 0 || this.remaining > 0; }
}

export function createLiquid(renderer: WebGLRenderer, model: CloudModel) {
  const side = 2 ** Math.ceil(Math.log2(Math.sqrt(model.positions.length / 3)));
  const gpu = new GPUComputationRenderer(side, side, renderer);
  gpu.setDataType(HalfFloatType);
  const home = gpu.createTexture();
  const data = home.image.data!;
  for (let i = 0; i < model.positions.length / 3; i++) {
    data[i * 4] = model.positions[i * 3];
    data[i * 4 + 1] = model.positions[i * 3 + 1];
    data[i * 4 + 2] = Math.random();
    data[i * 4 + 3] = 1;
  }
  const flow = gpu.addVariable("flow", flowShader, gpu.createTexture());
  const state = gpu.addVariable("state", stateShader, gpu.createTexture());
  flow.minFilter = flow.magFilter = LinearFilter;
  gpu.setVariableDependencies(flow, [flow]);
  gpu.setVariableDependencies(state, [state, flow]);
  const { span, origin } = flowField(model);
  const input = new LiquidInput();
  const shared = {
    uHome: { value: home }, uMouse: { value: input.mouse }, uVel: { value: input.velocity },
    uOrigin: { value: origin }, uSpan: { value: span },
    uUnits: { value: 1 }, uPresence: { value: 0 }, uDecay: { value: .968 }, uInkDecay: { value: .97 },
    uDt: { value: 1 }, uTime: { value: 0 }, uRadius: { value: 150 }, uInkRadius: { value: 110 },
    uStrength: { value: APPEARANCE.liquidStrength }, uSpread: { value: 1 }, uTurb: { value: .6 }, uReturn: { value: 1.2 },
  };
  Object.assign(flow.material.uniforms, shared);
  Object.assign(state.material.uniforms, shared);
  try {
    const error = gpu.init();
    if (error) throw new Error(error);
  } catch (error) {
    gpu.dispose(); home.dispose();
    throw error;
  }
  return {
    gpu, flow, state, input,
    step(dt: number, now: number, units: number) {
      if (!input.running) return false;
      const f = input.step(dt, now, units);
      shared.uUnits.value = units;
      shared.uPresence.value = input.presence;
      shared.uDecay.value = .968 ** f;
      shared.uInkDecay.value = .97 ** f;
      shared.uDt.value = f;
      shared.uTime.value = input.time;
      gpu.compute();
      return input.running;
    },
    reset() {
      input.reset();
      for (const variable of [flow, state]) {
        for (const target of variable.renderTargets) gpu.renderTexture(variable.initialValueTexture, target);
      }
    },
    dispose() { gpu.dispose(); home.dispose(); },
  };
}
