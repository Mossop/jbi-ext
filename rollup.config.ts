import typescript from "@rollup/plugin-typescript";
import type { RollupOptions } from "rollup";

function config(name: string): RollupOptions {
  return {
    input: `src/${name}.ts`,
    output: {
      dir: "build",
      name,
      sourcemap: true,
      interop: false,
      format: "iife",
    },
    plugins: [typescript()],
  };
}

export default [config("background"), config("bugzilla"), config("jira")];
