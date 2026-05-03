import { build } from "esbuild";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url)));
const directDeps = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
]);

const isDirect = (id) => {
  if (id.startsWith("@repo/")) return false;
  const parts = id.split("/");
  const name = id.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
  return directDeps.has(name);
};

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  outfile: "dist/index.js",
  sourcemap: true,
  banner: {
    js: [
      "import { createRequire as __cr } from 'module';",
      "import { fileURLToPath as __ftp } from 'url';",
      "import { dirname as __dn } from 'path';",
      "const require = __cr(import.meta.url);",
      "const __filename = __ftp(import.meta.url);",
      "const __dirname = __dn(__filename);",
    ].join(""),
  },
  plugins: [
    {
      name: "externalize-direct-deps-only",
      setup(b) {
        b.onResolve({ filter: /.*/ }, (args) => {
          if (args.kind === "entry-point") return null;
          if (args.path.startsWith(".") || args.path.startsWith("/")) return null;
          if (isDirect(args.path)) return { path: args.path, external: true };
          return null;
        });
      },
    },
  ],
});
