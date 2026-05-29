/**
 * Returns a deterministic acknowledgement string for orchestration smoke tests.
 *
 * @param input The workflow input to echo back.
 * @returns The acknowledgement payload consumed by the smoke workflow.
 */
export async function acknowledge(input: string) {
  return `${input}:ack`;
}
