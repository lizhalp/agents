import { NativeConnection, Worker } from "@temporalio/worker";

import { buildServiceUrls, loadEnv } from "@agent-suite/config";
import * as activities from "./activities.js";

const env = loadEnv();
const urls = buildServiceUrls(env);

async function start() {
  const connection = await NativeConnection.connect({ address: urls.temporalAddress });
  const worker = await Worker.create({
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
    taskQueue: env.TEMPORAL_TASK_QUEUE,
    workflowsPath: new URL("./workflows.js", import.meta.url).pathname,
    activities
  });

  await worker.run();
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
