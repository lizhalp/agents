import { loadEnv } from "@agent-suite/config";

import { buildApp } from "./app.js";

const env = loadEnv();
const app = buildApp();

app.listen({ host: "0.0.0.0", port: env.API_PORT }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
