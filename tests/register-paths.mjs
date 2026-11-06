import { registerHooks } from "node:module";

// Node 直接运行服务端测试时，需要解析 Next.js 的路径别名。
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      specifier = new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href;
    }
    return nextResolve(specifier, context);
  },
});
