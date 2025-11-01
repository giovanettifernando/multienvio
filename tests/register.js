process.env.TS_NODE_PROJECT = process.env.TS_NODE_PROJECT ?? "tsconfig.test.json";
process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
require("ts-node/register");
