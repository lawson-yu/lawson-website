import { HalfFloatType, Vector2, WebGLRenderTarget, type Camera, type Scene, type ShaderMaterial, type WebGLRenderer } from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { APPEARANCE } from "../appearance.ts";

// Three 升级若改变补丁位置，立即报错，防止静默退回默认 Bloom。
export function replaceShader(source: string, needle: string, replacement: string) {
  if (source.split(needle).length !== 2) throw new Error(`Kin shader patch mismatch: ${needle}`);
  return source.replace(needle, replacement);
}

export function createBloom(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
  let ratio = renderer.getPixelRatio();
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 0 });
  const composer = new EffectComposer(renderer, target);
  const render = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new Vector2(1, 1), APPEARANCE.bloom.strength, APPEARANCE.bloom.radius, APPEARANCE.bloom.threshold);
  const output = new OutputPass();
  const dispose = () => {
    render.dispose();
    bloom.materialHighPassFilter.dispose();
    bloom.dispose();
    output.dispose();
    composer.dispose();
  };
  try {
    bloom.compositeMaterial.fragmentShader = replaceShader(
      bloom.compositeMaterial.fragmentShader,
      "vec3 bloom = 3.0 * bloomStrength * (", "vec3 bloom = (",
    );
    bloom.compositeMaterial.fragmentShader = replaceShader(
      bloom.compositeMaterial.fragmentShader, "float bloomAlpha",
      "float lum = max(dot(bloom, vec3(.2126,.7152,.0722)), 1e-5); bloom = bloomStrength * bloom * (pow(lum, 0.60) / lum);\nfloat bloomAlpha",
    );
    const factory = bloom as UnrealBloomPass & { _getSeparableBlurMaterial(radius: number): ShaderMaterial };
    for (const [index, kernel] of [3, 5, 7, 9, 11].entries()) {
      bloom.separableBlurMaterials[index].dispose();
      bloom.separableBlurMaterials[index] = factory._getSeparableBlurMaterial(kernel);
    }
    bloom.materialHighPassFilter.uniforms.uSrc = { value: new Vector2() };
    bloom.materialHighPassFilter.fragmentShader = replaceShader(
      bloom.materialHighPassFilter.fragmentShader, "uniform sampler2D tDiffuse;", "uniform sampler2D tDiffuse;\nuniform vec2 uSrc;",
    );
    bloom.materialHighPassFilter.fragmentShader = replaceShader(
      bloom.materialHighPassFilter.fragmentShader, "vec4 texel = texture2D( tDiffuse, vUv );",
      "vec4 texel = (texture2D(tDiffuse, vUv + uSrc) + texture2D(tDiffuse, vUv - uSrc) + texture2D(tDiffuse, vUv + vec2(uSrc.x,-uSrc.y)) + texture2D(tDiffuse, vUv + vec2(-uSrc.x,uSrc.y))) * .25;",
    );
    const originalSize = bloom.setSize.bind(bloom);
    bloom.setSize = (width, height) => {
      originalSize(Math.round(width / ratio), Math.round(height / ratio));
      bloom.materialHighPassFilter.uniforms.uSrc.value.set(ratio / 2 / width, ratio / 2 / height);
    };
    output.material.fragmentShader = replaceShader(
      output.material.fragmentShader,
      "gl_FragColor = sRGBTransferOETF( gl_FragColor );\n\n\t\t\t#endif",
      "gl_FragColor = sRGBTransferOETF( gl_FragColor );\n\n\t\t\t#endif\n gl_FragColor.a = max(gl_FragColor.a, max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b)));",
    );
    composer.addPass(render);
    composer.addPass(bloom);
    composer.addPass(output);
    return {
      composer,
      bloom,
      resize(width: number, height: number) {
        const next = renderer.getPixelRatio();
        if (next !== ratio) { ratio = next; composer.setPixelRatio(ratio); }
        composer.setSize(width, height);
      },
      dispose,
    };
  } catch (error) { dispose(); throw error; }
}
