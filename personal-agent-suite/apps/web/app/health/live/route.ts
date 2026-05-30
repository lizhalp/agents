/**
 * Reports that the Next.js web server is able to answer requests.
 *
 * @returns A lightweight liveness payload for container health checks.
 */
export function GET() {
  return Response.json({
    service: "web",
    status: "live",
    timestamp: new Date().toISOString()
  });
}
