import { proxyActivities } from "@temporalio/workflow";

import type * as activities from "./activities.js";

const { acknowledge } = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 seconds"
});

/**
 * Runs the trivial workflow used to prove the Temporal worker can execute work.
 *
 * @param input The message supplied by the smoke-check caller.
 * @returns The acknowledgement returned by the orchestrator activity.
 */
export async function smokeWorkflow(input: string) {
  return acknowledge(input);
}
