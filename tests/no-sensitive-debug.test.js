const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

test("deploys without logging values, secrets, or rendering context", async () => {
  const sentinel = "fake-only-sensitive-test-value";
  const inputs = {
    release: "test",
    namespace: "default",
    chart: "test",
    helm: "helm3",
    values: `password: ${sentinel}`,
    secrets: JSON.stringify({ password: sentinel }),
  };
  const logs = [];
  const files = new Map();
  const commands = [];
  const core = {
    getInput: (name) => inputs[name] || "",
    debug: (message) => logs.push(message),
    error: (error) => { throw error; },
    setFailed: (message) => { throw new Error(message); },
  };
  const modules = {
    "@actions/core": core,
    "@actions/github": { context: { payload: {} } },
    "@actions/exec": { exec: async (...args) => commands.push(args) },
    fs: {
      writeFile: (name, content, callback) => { files.set(name, content); callback(null); },
      readFile: (name, options, callback) => callback(null, files.get(name) || ""),
    },
    util: require("node:util"),
    mustache: require("mustache"),
  };
  const source = fs.readFileSync(path.join(__dirname, "../index.js"), "utf8");
  await vm.runInNewContext(source, {
    require: (name) => modules[name],
    process: { env: {} },
  });
  assert.equal(commands.length, 1);
  assert.equal(files.get("./values.yml"), inputs.values);
  assert.ok(!logs.some((line) => line.includes(sentinel)), "Sensitive input reached debug output");
});
