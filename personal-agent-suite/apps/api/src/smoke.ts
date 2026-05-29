import { Connection, WorkflowClient } from "@temporalio/client";

export const TEMPORAL_SMOKE_WORKFLOW_ID = "platform-smoke-workflow";

/**
 * Executes the trivial Temporal workflow used to verify orchestration connectivity.
 *
 * @param address The Temporal frontend address.
 * @param namespace The namespace containing the smoke workflow.
 * @param taskQueue The task queue serviced by the orchestrator worker.
 * @returns The workflow result mapped into an API-friendly health payload.
 */
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
