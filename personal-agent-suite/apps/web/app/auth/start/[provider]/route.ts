import { signIn } from "../../../../auth";

const supportedProviders = new Set(["authentik", "google", "github"]);

type StartAuthRouteContext = {
  params: Promise<{
    provider: string;
  }>;
};

export async function GET(request: Request, context: StartAuthRouteContext) {
  const { provider } = await context.params;

  if (!supportedProviders.has(provider)) {
    return new Response("Unsupported provider.", { status: 404 });
  }

  const url = new URL(request.url);
  return signIn(provider, {
    redirectTo: url.searchParams.get("callbackUrl") ?? "/"
  });
}
