import { beforeEach, describe, expect, it, vi } from "vitest";

const acknowledgeMock = vi.fn(async (input: string) => `${input}:ack`);

vi.mock("@temporalio/workflow", () => ({
  proxyActivities: vi.fn(() => ({
    acknowledge: acknowledgeMock
  }))
}));

describe("smokeWorkflow", () => {
  beforeEach(() => {
    acknowledgeMock.mockClear();
    vi.resetModules();
  });

  it("delegates to the acknowledge activity", async () => {
    const { smokeWorkflow } = await import("./workflows.js");

    await expect(smokeWorkflow("hello-world")).resolves.toBe("hello-world:ack");
    expect(acknowledgeMock).toHaveBeenCalledWith("hello-world");
  });
});
