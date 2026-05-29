import { describe, expect, it } from "vitest";

import { acknowledge } from "./activities.js";

describe("acknowledge", () => {
  it("returns the deterministic smoke-check acknowledgement", async () => {
    await expect(acknowledge("hello-world")).resolves.toBe("hello-world:ack");
  });
});
