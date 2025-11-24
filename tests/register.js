// tests/register.js
const path = require("path");
const fs = require("fs");
const tsNode = require("ts-node");
const tsConfigPaths = require("tsconfig-paths");

// Garante ambiente de teste
process.env.NODE_ENV = process.env.NODE_ENV ?? "test";

// Não deixar o ts-node usar um tsconfig com moduleResolution=bundler
delete process.env.TS_NODE_PROJECT;

// Lê o tsconfig raiz apenas para baseUrl / paths (para reaproveitar aliases)
const tsconfigPath = path.resolve(__dirname, "..", "tsconfig.json");
const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
const compilerOptions = tsconfig.compilerOptions || {};

const baseUrl = path.resolve(__dirname, "..", compilerOptions.baseUrl || ".");
const paths = compilerOptions.paths || {};

// Registrar ts-node em modo CommonJS, com compilerOptions próprios (sem project)
tsNode.register({
  transpileOnly: true,
  compilerOptions: {
    module: "commonjs",
    moduleResolution: "node",
    target: compilerOptions.target || "ES2020",
    jsx: compilerOptions.jsx || "react-jsx",
    esModuleInterop: true,
    allowJs: true,
    baseUrl,
    paths,
  },
});

// Registrar resolução de paths em runtime (para @/ na suíte antiga)
tsConfigPaths.register({
  baseUrl,
  paths,
});
