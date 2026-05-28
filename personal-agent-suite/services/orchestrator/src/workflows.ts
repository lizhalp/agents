import { proxyActivities } from "@temporalio/workflow";

const { acknowledge } = proxyActivities<typeof import("./activities.js")>({
  startToCloseTimeout: "30 seconds"
});

export async function smokeWorkflow(input: string) {
  return acknowledge(input);
}
