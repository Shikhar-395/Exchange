import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  outfile: "dist/index.js",
  sourcemap: true,
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  plugins: [
    {
      name: "externalize-node-modules",
      setup(b) {
        b.onResolve({ filter: /.*/ }, (args) => {
          if (args.kind === "entry-point") return null;
          if (args.path.startsWith(".") || args.path.startsWith("/")) return null;
          if (args.path.startsWith("@repo/")) return null;
          return { path: args.path, external: true };
        });
      },
    },
  ],
});
