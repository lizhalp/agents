const env = process.env;

const required = [
  "AUTHENTIK_BOOTSTRAP_TOKEN",
  "AUTHENTIK_INTERNAL_SERVICE_URL",
  "AUTHENTIK_CLIENT_ID",
  "AUTHENTIK_CLIENT_SECRET",
  "AUTHENTIK_APP_SLUG",
  "PUBLIC_BASE_URL"
];

for (const key of required) {
  if (!env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const apiBase = `${env.AUTHENTIK_INTERNAL_SERVICE_URL}/api/v3`;
const headers = {
  Authorization: `Bearer ${env.AUTHENTIK_BOOTSTRAP_TOKEN}`,
  "Content-Type": "application/json"
};
const applicationSlug = env.AUTHENTIK_APP_SLUG;
const redirectUri = `https://${env.PUBLIC_BASE_URL}/api/auth/callback/authentik`;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

await waitForAuthentik();

const authorizationFlow = await getFlow("default-provider-authorization-implicit-consent");
const invalidationFlow = await getFlow("default-provider-invalidation-flow");

let provider = await findProvider(env.AUTHENTIK_CLIENT_ID);
if (!provider) {
  provider = await createProvider(authorizationFlow.pk, invalidationFlow.pk);
}

let application = await findApplication(applicationSlug);
if (!application) {
  application = await createApplication(provider.pk);
} else if (application.provider !== provider.pk) {
  await apiFetch(`/core/applications/${application.slug}/`, {
    method: "PATCH",
    body: JSON.stringify({ provider: provider.pk })
  });
}

console.log(`Authentik bootstrap complete for application ${application.slug}`);

async function waitForAuthentik() {
  const attempts = 60;
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(`${env.AUTHENTIK_INTERNAL_SERVICE_URL}/-/health/live/`);
      if (response.ok) {
        return;
      }
    } catch {
      // ignore and retry
    }
    await sleep(2000);
  }

  throw new Error("Authentik did not become healthy in time");
}

async function getFlow(slug) {
  return apiFetch(`/flows/instances/${slug}/`);
}

async function findProvider(clientId) {
  const response = await apiFetch(`/providers/oauth2/?client_id=${encodeURIComponent(clientId)}`);
  return response.results?.[0] ?? null;
}

async function createProvider(authorizationFlowPk, invalidationFlowPk) {
  return apiFetch("/providers/oauth2/", {
    method: "POST",
    body: JSON.stringify({
      name: "Personal Agent Suite",
      client_type: "confidential",
      client_id: env.AUTHENTIK_CLIENT_ID,
      client_secret: env.AUTHENTIK_CLIENT_SECRET,
      authorization_flow: authorizationFlowPk,
      invalidation_flow: invalidationFlowPk,
      redirect_uris: [
        {
          matching_mode: "strict",
          url: redirectUri
        }
      ],
      include_claims_in_id_token: true,
      signing_key: null
    })
  });
}

async function findApplication(slug) {
  try {
    return await apiFetch(`/core/applications/${slug}/`);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

async function createApplication(providerPk) {
  return apiFetch("/core/applications/", {
    method: "POST",
    body: JSON.stringify({
      name: "Personal Agent Suite",
      slug: applicationSlug,
      provider: providerPk
    })
  });
}

async function apiFetch(path, init = {}) {
  const attempts = 15;

  for (let index = 0; index < attempts; index += 1) {
    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        ...headers,
        ...(init.headers ?? {})
      }
    });

    if (response.ok) {
      return response.json();
    }

    const text = await response.text();
    if ((response.status === 502 || response.status === 503) && index < attempts - 1) {
      await sleep(2000);
      continue;
    }

    throw new HttpError(response.status, text);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
