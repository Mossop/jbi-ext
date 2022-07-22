import gulp from "gulp";
import typescript from "@rollup/plugin-typescript";
import { promises as fs } from "fs";
import path from "path";
import { rollup, OutputOptions, InputOptions } from "rollup";
import { src, dest } from "gulp";

const SRC = path.join(__dirname, "src");
const TARGET = path.join(__dirname, "build");

function memoized<T>(inner: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | undefined = undefined;
  return (): Promise<T> => {
    if (!cached) {
      cached = inner();
    }

    return cached;
  };
}

const loadManifest = memoized(async () => {
  let contents = await fs.readFile(path.join(__dirname, "manifest.json.in"), {
    encoding: "utf8",
  });

  return JSON.parse(contents);
});

const loadPackage = memoized(async () => {
  let contents = await fs.readFile(path.join(__dirname, "package.json"), {
    encoding: "utf8",
  });
  return JSON.parse(contents);
});

const contentScripts = memoized(async (): Promise<string[]> => {
  let manifest = await loadManifest();
  let files: string[] = [];
  for (let { js = [] } of manifest.content_scripts ?? []) {
    files.push(...js);
  }

  return files;
});

async function ensureDir(dir: string) {
  try {
    let stat = await fs.stat(dir);
    if (!stat.isDirectory()) {
      throw new Error(`Target ${dir} is not a directory`);
    }
  } catch (e) {
    await fs.mkdir(dir, { recursive: true });
  }
}

const backgroundScripts = memoized(async (): Promise<string[]> => {
  let manifest = await loadManifest();
  return manifest.background?.scripts ?? [];
});

export function clean() {
  return Promise.all([
    fs.rm(TARGET, { recursive: true, force: true }),
    fs.rm(path.join(__dirname, "web-ext-artifacts"), {
      recursive: true,
      force: true,
    }),
  ]);
}

function rollupOptions(script: string): [InputOptions, OutputOptions] {
  let name = path.relative(SRC, script.replace(".ts", ""));

  return [
    {
      input: script,
      plugins: [typescript()],
    },
    {
      dir: path.join(TARGET, "scripts"),
      name,
      sourcemap: true,
      interop: false,
      format: "iife",
    },
  ];
}

export async function buildJS() {
  let scripts = [...(await contentScripts()), ...(await backgroundScripts())];

  for (let script of scripts) {
    let [inputOptions, outputOptions] = rollupOptions(script);

    let bundle = await rollup(inputOptions);
    await bundle.write(outputOptions);

    await bundle.close();
  }
}

export async function buildManifest() {
  const scriptPath = (script: string) =>
    path.join("scripts", path.relative(SRC, script).replace(".ts", ".js"));

  await ensureDir(TARGET);

  let pkg = await loadPackage();
  let manifest = JSON.parse(JSON.stringify(await loadManifest()));
  manifest.version = pkg.version;
  manifest.name = pkg.description;

  for (let contentScript of manifest.content_scripts ?? []) {
    if (!contentScript.js) {
      continue;
    }

    contentScript.js = contentScript.js.map(scriptPath);
  }

  if (manifest.background?.scripts) {
    manifest.background.scripts = manifest.background.scripts.map(scriptPath);
  }

  await fs.writeFile(
    path.join(TARGET, "manifest.json"),
    JSON.stringify(manifest, undefined, 2)
  );
}

export function copyResources() {
  return src("icons/**").pipe(dest(path.join(TARGET, "icons")));
}

export const build = gulp.parallel(buildManifest, buildJS, copyResources);
export const cleanBuild = gulp.series(clean, build);
export default build;
