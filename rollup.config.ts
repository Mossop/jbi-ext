import typescript from "@rollup/plugin-typescript";
import type { RollupOptions } from "rollup";

function config(name: string): RollupOptions {
  return {
    input: `src/${name}.ts`,
    external: ["webextension-polyfill"],
    output: {
      dir: "build",
      name,
      sourcemap: true,
      interop: false,
      format: "iife",
      globals: {
        "webextension-polyfill": "browser",
      },
    },
    plugins: [typescript()],
  };
}

export default [config("background"), config("bugzilla")];
