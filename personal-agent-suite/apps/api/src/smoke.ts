import { Connection, WorkflowClient } from "@temporalio/client";

export const TEMPORAL_SMOKE_WORKFLOW_ID = "platform-smoke-workflow";

export async function runTemporalSmokeCheck(address: string, namespace: string, taskQueue: string) {
  const connection = await Connection.connect({ address });
  try {
    const client = new WorkflowClient({ connection, namespace });
    const handle = await client.start("smokeWorkflow", {
      args: ["hello-world"],
      taskQueue,
      workflowId: `${TEMPORAL_SMOKE_WORKFLOW_ID}-${Date.now()}`
    });

    const result = await handle.result();
    return { ok: result === "hello-world:ack", message: `workflow result=${result}` };
  } finally {
    await connection.close();
  }
}
