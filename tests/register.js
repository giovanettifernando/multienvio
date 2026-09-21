// tests/register.js
const path = require("path");
const fs = require("fs");
const tsNode = require("ts-node");
const tsConfigPaths = require("tsconfig-paths");

// Evita que intervals de libs (ex.: rate-limit) mantenham o processo vivo
const originalSetInterval = global.setInterval;
global.setInterval = (...args) => {
  const handle = originalSetInterval(...args);
  if (handle && typeof handle.unref === "function") {
    handle.unref();
  }
  return handle;
};

// Garante ambiente de teste
process.env.NODE_ENV = process.env.NODE_ENV ?? "test";

// Segredos de teste: a suíte não pode depender do .env de quem roda (vários
// módulos leem o segredo no import e quebram com chave vazia). São gerados a
// cada execução — basta serem estáveis dentro do processo — e nunca valem
// fora dos testes.
const { randomBytes } = require("crypto");
const TEST_SECRETS = {
  JWT_SECRET: randomBytes(32).toString("hex"),
  ADMIN_JWT_SECRET: randomBytes(32).toString("hex"),
  NEXTAUTH_SECRET: randomBytes(32).toString("hex"),
  ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  CARD_VAULT_KEY: randomBytes(32).toString("base64"),
  CRON_SECRET: randomBytes(16).toString("hex"),
};
for (const [key, value] of Object.entries(TEST_SECRETS)) {
  if (!process.env[key]) process.env[key] = value;
}

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
