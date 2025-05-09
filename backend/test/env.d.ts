// test/env.d.ts
/// <reference path="../src/worker-configuration.d.ts" />
declare module "cloudflare:test" {
  // ProvidedEnvは`import("cloudflare:test").env`の型を制御
  interface ProvidedEnv extends Env {}
}
