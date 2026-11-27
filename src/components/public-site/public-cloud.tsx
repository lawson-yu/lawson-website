"use client";

import { useEffect, useRef } from "react";
type HeadingVariant = "A" | "B" | "C" | "D";

const vertexShader = `
  attribute vec3 a_position;
  attribute vec2 a_style;
  uniform float u_time, u_aspect, u_dpr, u_person, u_hover, u_form, u_person_scale;
  uniform vec2 u_pointer;
  varying vec3 v_color;
  varying float v_alpha;

  void main() {
    float arrival = 1.0 - exp(-u_time * 1.8);
    if (u_person > 0.5) {
      vec3 p = (a_position - vec3(0.0, 0.225, 0.0)) / 0.45;
      float noise = fract(sin(dot(a_position, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      p += vec3(noise - 0.5, fract(noise * 17.13) - 0.5, fract(noise * 47.7) - 0.5) * (1.0 - arrival) * 0.35;
      float yaw = -0.18 + sin(u_time * 0.5) * 0.3 + (1.0 - arrival) * 0.6 + u_pointer.x * 0.07;
      float x = p.x * cos(yaw) + p.z * sin(yaw);
      float z = -p.x * sin(yaw) + p.z * cos(yaw);
      float pitch = u_pointer.y * 0.04;
      float y = p.y * cos(pitch) - z * sin(pitch);
      z = p.y * sin(pitch) + z * cos(pitch);
      float perspective = 1.0 / (1.0 - z * 0.28);
      float mobile = 1.0 - step(1.35, u_aspect);
      float scale = mix(1.78, 1.38, mobile) * u_person_scale;
      vec2 position = vec2(x * scale / u_aspect, y * scale) * perspective;
      position += vec2(mix(0.43, 0.48, mobile), mix(-0.06, 0.12, mobile) - (u_person_scale - 1.0) * 0.8);
      gl_Position = vec4(position, 0.0, 1.0);
      gl_PointSize = mix(1.4, 2.05, noise) * u_dpr;
      v_color = mix(vec3(0.48, 0.70, 0.80), vec3(0.92, 0.97, 1.0), clamp(0.6 + p.y * 0.5 + z * 0.3, 0.0, 1.0));
      v_alpha = (0.42 + noise * 0.34) * (0.35 + arrival * 0.65);
    } else {
      vec2 p = a_position.xy;
      float family = a_position.z;
      float phase = a_style.x * 6.2831853;
      if (family < 0.5) {
        p.y += sin(p.x * 3.8 + phase + u_time * 0.65) * 0.025;
      } else if (family < 1.5) {
        p += vec2(sin(phase + u_time * 0.45), cos(phase * 1.7 + u_time * 0.35)) * 0.025;
      } else {
        vec2 orbit = p - vec2(0.38, 0.04);
        float turn = sin(phase + u_time * 0.4) * 0.025;
        p += vec2(-orbit.y, orbit.x) * turn;
      }
      vec2 delta = vec2((p.x - u_pointer.x) * u_aspect, p.y - u_pointer.y);
      float influence = (1.0 - smoothstep(0.0, 0.65, length(delta))) * u_hover;
      vec2 direction = normalize(delta + vec2(0.0001));
      float push = family > 0.5 && family < 1.5 ? 0.045 : 0.03;
      p += vec2(direction.x / u_aspect, direction.y) * influence * push;
      p.y += sin(u_time * 2.4 + phase + delta.x * 5.0) * influence * (u_form < 0.5 ? 0.012 : 0.018);
      gl_Position = vec4(p, 0.0, 1.0);
      gl_PointSize = mix(0.9, 2.2, fract(a_style.x * 19.17)) * u_dpr * (1.0 + influence * 0.35);
      vec3 color = family < 0.5 ? vec3(0.38, 0.67, 0.78) :
        (family < 1.5 ? vec3(0.53, 0.68, 0.81) : vec3(0.40, 0.71, 0.77));
      v_color = mix(mix(color, vec3(0.82, 0.94, 0.98), fract(a_style.x * 7.17) * 0.55), vec3(0.92, 0.98, 1.0), influence * 0.3);
      v_alpha = min(0.95, a_style.y * (0.3 + arrival * 0.7) + influence * (u_form < 0.5 ? 0.06 : 0.1));
      if (family > 0.5 && family < 1.5 && u_form < 1.5) v_alpha *= 0.55;
    }
  }
`;

const fragmentShader = `
  precision mediump float;
  uniform float u_points;
  varying vec3 v_color;
  varying float v_alpha;
  void main() {
    if (u_points > 0.5 && length(gl_PointCoord - vec2(0.5)) > 0.5) discard;
    gl_FragColor = vec4(v_color, v_alpha);
  }
`;

function createProgram(gl: WebGLRenderingContext) {
  const program = gl.createProgram();
  if (!program) throw new Error("无法创建 WebGL 程序");
  const shaders: WebGLShader[] = [];
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexShader], [gl.FRAGMENT_SHADER, fragmentShader]] as const) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("无法创建着色器");
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error("着色器编译失败");
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("着色器链接失败");
    return program;
  } catch (error) {
    gl.deleteProgram(program);
    throw error;
  } finally {
    shaders.forEach((shader) => gl.deleteShader(shader));
  }
}

function makeScenery(variant: HeadingVariant) {
  const points: number[] = [];
  const lines: number[] = [];
  const triangles: number[] = [];
  let seed = 8103;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const add = (target: number[], x: number, y: number, phase: number, opacity: number, family = 0) => {
    target.push(x, y, family, phase, opacity);
  };

  if (variant === "A" || variant === "D") {
    const flow = (x: number, lane: number) => -0.1 + (lane - 1) * 0.27 + Math.sin(x * 2.1 + lane * 0.9) * 0.28 + x * 0.16;
    for (let i = 0; i < 11000; i++) {
      const lane = Math.floor(random() * 3);
      const x = random() * 2.5 - 1.25;
      const spread = (random() + random() + random() - 1.5) * (0.08 + 0.15 * Math.abs(Math.sin(x * 2.5 + lane)));
      add(points, x, flow(x, lane) + spread, random(), 0.13 + random() * 0.42);
    }
    for (let strand = 0; strand < 24; strand++) {
      const lane = strand % 3;
      const offset = (strand / 24 - 0.5) * 0.17;
      const phase = strand / 24;
      for (let i = 0; i < 100; i++) {
        const x1 = -1.25 + i * 0.025;
        const x2 = x1 + 0.025;
        add(lines, x1, flow(x1, lane) + offset, phase, 0.17);
        add(lines, x2, flow(x2, lane) + offset, phase, 0.17);
      }
    }
  }
  if (variant === "B" || variant === "D") {
    for (let shard = 0; shard < (variant === "D" ? 65 : 110); shard++) {
      const x = random() * 2.5 - 1.25;
      const y = Math.sin(x * 2.4) * 0.28 + (random() - 0.5) * 1.25;
      const width = 0.018 + random() * 0.12;
      const height = 0.025 + random() * 0.19;
      const phase = random();
      const opacity = 0.08 + random() * 0.28;
      const corners = [[x - width, y - height * 0.4], [x + width * 0.8, y - height], [x + width * 0.3, y + height]];
      corners.forEach(([px, py]) => add(triangles, px, py, phase, opacity, 1));
      for (let i = 0; i < 3; i++) {
        const [x1, y1] = corners[i];
        const [x2, y2] = corners[(i + 1) % 3];
        add(lines, x1, y1, phase, opacity + 0.12, 1);
        add(lines, x2, y2, phase, opacity + 0.12, 1);
      }
      for (let i = 0; i < 30; i++) {
        add(points, x + (random() - 0.5) * width * 5, y + (random() - 0.5) * height * 3, random(), 0.12 + random() * 0.5, 1);
      }
    }
  } else if (variant === "C") {
    for (let ring = 0; ring < 13; ring++) {
      const rx = 0.35 + ring * 0.12;
      const ry = 0.22 + ring * 0.07;
      const phase = ring / 13;
      const orbit = (angle: number) => {
        const x = 0.38 + rx * Math.cos(angle) + 0.035 * Math.sin(angle * 5 + ring);
        const y = 0.04 + ry * Math.sin(angle) - (x - 0.38) * 0.14 + 0.025 * Math.sin(angle * 3 + ring);
        return [x, y];
      };
      for (let i = 0; i < 240; i++) {
        const angle = i / 240 * Math.PI * 2;
        if (Math.sin(angle * 3 + ring * 1.3) < -0.78) continue;
        const [x1, y1] = orbit(angle);
        const [x2, y2] = orbit(angle + Math.PI * 2 / 240);
        add(lines, x1, y1, phase, 0.42 + ring % 3 * 0.08, 2);
        add(lines, x2, y2, phase, 0.42 + ring % 3 * 0.08, 2);
        if (random() > 0.35) add(points, x1 + (random() - 0.5) * 0.035, y1 + (random() - 0.5) * 0.035, random(), 0.3 + random() * 0.6, 2);
      }
    }
  }
  return [new Float32Array(triangles), new Float32Array(lines), new Float32Array(points)];
}

function startCloud(canvas: HTMLCanvasElement, variant: HeadingVariant, personScale: number) {
  const art = canvas.parentElement!;
  const abort = new AbortController();
  let disposed = false;
  let frame = 0;
  let removeListeners = () => {};
  let releaseGraphics = () => {};

  const stop = () => {
    if (disposed) return;
    disposed = true;
    abort.abort();
    cancelAnimationFrame(frame);
    removeListeners();
    releaseGraphics();
    delete art.dataset.live;
  };

  void (async () => {
    try {
      const response = await fetch("/images/character/person.bin", { signal: abort.signal });
      if (!response.ok) throw new Error("点云数据加载失败");
      const binary = await response.arrayBuffer();
      if (disposed) return;
      if (binary.byteLength !== 60000 * 3 * 4) throw new Error("点云数据长度不正确");
      const data = new DataView(binary);
      const person = new Float32Array(60000 * 3);
      for (let i = 0; i < person.length; i++) {
        person[i] = data.getFloat32(i * 4, true);
        if (!Number.isFinite(person[i])) throw new Error("点云数据无效");
      }

      const gl = canvas.getContext("webgl", { alpha: true, antialias: false, powerPreference: "low-power" });
      if (!gl) throw new Error("WebGL 不可用");
      const program = createProgram(gl);
      const buffers: WebGLBuffer[] = [];
      releaseGraphics = () => {
        buffers.forEach((buffer) => gl.deleteBuffer(buffer));
        gl.deleteProgram(program);
        queueMicrotask(() => {
          if (!canvas.isConnected) gl.getExtension("WEBGL_lose_context")?.loseContext();
        });
      };
      const upload = (data: Float32Array) => {
        const buffer = gl.createBuffer();
        if (!buffer) throw new Error("无法创建点云缓冲区");
        buffers.push(buffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        return buffer;
      };
      const scenery = makeScenery(variant).map((data) => ({ buffer: upload(data), count: data.length / 5 }));
      const personBuffer = upload(person);
      const position = gl.getAttribLocation(program, "a_position");
      const style = gl.getAttribLocation(program, "a_style");
      const uniform = (name: string) => gl.getUniformLocation(program, name);
      const time = uniform("u_time");
      const aspect = uniform("u_aspect");
      const dpr = uniform("u_dpr");
      const hoverUniform = uniform("u_hover");
      const formUniform = uniform("u_form");
      const personUniform = uniform("u_person");
      const pointsUniform = uniform("u_points");
      const pointerUniform = uniform("u_pointer");
      gl.useProgram(program);
      gl.uniform1f(uniform("u_person_scale"), personScale);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);
      gl.enableVertexAttribArray(position);

      let visible = false;
      let previous = 0;
      let elapsed = 0;
      let pointerX = 0;
      let pointerY = 0;
      let hover = 0;
      let targetX = 0;
      let targetY = 0;
      let targetHover = 0;
      let resized = true;
      const draw = (now: number) => {
        frame = 0;
        if (disposed || !visible || document.hidden) return;
        if (!previous) previous = now;
        if (now - previous < 33) {
          frame = requestAnimationFrame(draw);
          return;
        }
        const delta = Math.min((now - previous) / 1000, 0.1);
        elapsed += delta;
        pointerX += (targetX - pointerX) * Math.min(delta * 4, 1);
        pointerY += (targetY - pointerY) * Math.min(delta * 4, 1);
        hover += (targetHover - hover) * Math.min(delta * 5, 1);
        previous = now;
        if (resized) {
          const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
          canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
          canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
          gl.viewport(0, 0, canvas.width, canvas.height);
          gl.uniform1f(aspect, canvas.width / canvas.height);
          gl.uniform1f(dpr, ratio);
          resized = false;
        }
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(time, elapsed);
        gl.uniform2f(pointerUniform, pointerX, pointerY);
        gl.uniform1f(hoverUniform, hover);
        gl.uniform1f(personUniform, 0);
        gl.enableVertexAttribArray(style);
        scenery.forEach(({ buffer, count }, index) => {
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 20, 0);
          gl.vertexAttribPointer(style, 2, gl.FLOAT, false, 20, 12);
          gl.uniform1f(pointsUniform, index === 2 ? 1 : 0);
          gl.uniform1f(formUniform, index);
          gl.drawArrays(index === 0 ? gl.TRIANGLES : index === 1 ? gl.LINES : gl.POINTS, 0, count);
        });
        gl.bindBuffer(gl.ARRAY_BUFFER, personBuffer);
        gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);
        gl.disableVertexAttribArray(style);
        gl.vertexAttrib2f(style, 0, 0);
        gl.uniform1f(personUniform, 1);
        gl.uniform1f(pointsUniform, 1);
        gl.drawArrays(gl.POINTS, 0, person.length / 3);
        art.dataset.live = "true";
        frame = requestAnimationFrame(draw);
      };
      const sync = () => {
        if (document.hidden || !visible) { targetX = 0; targetY = 0; targetHover = 0; }
        if (visible && !document.hidden && !disposed) {
          if (!frame) frame = requestAnimationFrame(draw);
        } else {
          cancelAnimationFrame(frame);
          frame = 0;
          previous = 0;
        }
      };
      const intersection = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        sync();
      });
      const resize = new ResizeObserver(() => { resized = true; });
      const heading = art.closest("header") ?? art.parentElement!;
      const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
      const move = (event: PointerEvent) => {
        if (!finePointer.matches || event.pointerType !== "mouse") return;
        const bounds = canvas.getBoundingClientRect();
        if (bounds.width <= 0 || bounds.height <= 0 || event.clientY > bounds.bottom) {
          leave();
          return;
        }
        targetX = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
        targetY = Math.max(-1, Math.min(1, 1 - (event.clientY - bounds.top) / bounds.height * 2));
        targetHover = 1;
      };
      const leave = () => { targetX = 0; targetY = 0; targetHover = 0; };
      const lost = () => stop();
      removeListeners = () => {
        intersection.disconnect();
        resize.disconnect();
        document.removeEventListener("visibilitychange", sync);
        canvas.removeEventListener("webglcontextlost", lost);
        heading.removeEventListener("pointermove", move);
        heading.removeEventListener("pointerleave", leave);
      };
      intersection.observe(canvas);
      resize.observe(canvas);
      document.addEventListener("visibilitychange", sync);
      canvas.addEventListener("webglcontextlost", lost);
      heading.addEventListener("pointermove", move, { passive: true });
      heading.addEventListener("pointerleave", leave);
    } catch {
      stop();
    }
  })();

  return stop;
}

export function PublicCloud({
  variant,
  personScale = 1,
  desktopOnly = false,
}: {
  variant: HeadingVariant;
  personScale?: number;
  desktopOnly?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvas.current) return;
    const element = canvas.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = desktopOnly ? window.matchMedia("(max-width: 700px)") : undefined;
    let stop = () => {};
    const update = () => {
      stop();
      stop = motion.matches || mobile?.matches ? () => {} : startCloud(element, variant, personScale);
    };
    update();
    motion.addEventListener("change", update);
    mobile?.addEventListener("change", update);
    return () => {
      motion.removeEventListener("change", update);
      mobile?.removeEventListener("change", update);
      stop();
    };
  }, [variant, personScale, desktopOnly]);

  return <div className="public-cloud__art" aria-hidden="true"><div className="public-cloud__fallback" /><canvas className="public-cloud__canvas" ref={canvas} /></div>;
}
