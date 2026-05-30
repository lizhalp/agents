import { buildServiceUrls, loadEnv } from "@agent-suite/config";
import {
  createGoalSchema,
  createKnowledgeSourceSchema,
  createMemorySchema,
  createRunSchema,
  platformSnapshotSchema,
  resolveApprovalSchema
} from "@agent-suite/shared-types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "../auth";
import { LogoutButton } from "./components/logout-button";

import type { Agent, Goal, PlatformSnapshot, Run } from "@agent-suite/shared-types";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

async function getPlatformSnapshot(): Promise<PlatformSnapshot> {
  try {
    const response = await apiFetch("/api/platform", { method: "GET" });
    if (!response.ok) {
      return emptySnapshot();
    }

    return platformSnapshotSchema.parse(await response.json());
  } catch {
    return emptySnapshot();
  }
}

function emptySnapshot(): PlatformSnapshot {
  return {
    goals: [],
    agents: [],
    runs: [],
    runEvents: [],
    approvals: [],
    memories: [],
    knowledgeSources: []
  };
}

function unavailableNotice(snapshot: PlatformSnapshot) {
  if (
    snapshot.goals.length === 0 &&
    snapshot.agents.length === 0 &&
    snapshot.runs.length === 0 &&
    snapshot.approvals.length === 0 &&
    snapshot.memories.length === 0 &&
    snapshot.knowledgeSources.length === 0
  ) {
    return {
      title: "Control-plane API unavailable",
      body: "Start the API and Postgres services to load the database-backed platform state."
    };
  }

  return null;
}

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin");
  }

  const snapshot = await getPlatformSnapshot();
  const activeGoals = snapshot.goals.filter((goal) => goal.status === "active");
  const pendingApprovals = snapshot.approvals.filter((approval) => approval.status === "pending");
  const latestRun = snapshot.runs[0];
  const notice = unavailableNotice(snapshot);

  return (
    <main className="min-h-screen px-5 py-6 text-[#f2ebdf] lg:px-8">
      <div className="mx-auto grid max-w-[1440px] gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-[28px] border border-white/10 bg-white/[0.035] p-5 shadow-panel">
          <div>
            <p className="m-0 text-xs uppercase tracking-[0.28em] text-accent">Personal Agent Suite</p>
            <h1 className="m-0 mt-2 font-display text-[clamp(2.4rem,5vw,5rem)] font-medium leading-[0.9] tracking-[-0.045em]">
              Goal operating system
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[#aab5c0]">
              Postgres-backed control plane for goals, agents, durable runs, memory, knowledge sources, and approval
              gates.
            </p>
          </div>
          <div className="grid gap-3 text-sm text-[#cad6de]">
            <span>
              Signed in as <strong>{session.preferredUsername ?? session.user.email ?? "owner"}</strong>
            </span>
            <LogoutButton />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <Metric label="Active goals" value={activeGoals.length} />
          <Metric label="Agents" value={snapshot.agents.length} />
          <Metric label="Runs" value={snapshot.runs.length} />
          <Metric label="Pending approvals" value={pendingApprovals.length} />
        </section>

        {notice ? (
          <section className="rounded-2xl border border-[#d9b96d]/30 bg-[#d9b96d]/10 p-4 text-sm text-[#f2ebdf]">
            <strong>{notice.title}</strong>
            <p className="m-0 mt-1 text-[#d6dee6]">{notice.body}</p>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <div className="grid gap-6">
            <Panel title="Goals" action={<span>{snapshot.goals.length} total</span>}>
              <CreateGoalForm />
              <div className="mt-5 grid gap-3">
                {snapshot.goals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} />
                ))}
              </div>
            </Panel>

            <Panel title="Run Timeline" action={latestRun ? <span>Latest: {latestRun.status}</span> : null}>
              <CreateRunForm agents={snapshot.agents} goals={snapshot.goals} />
              <div className="mt-5 grid gap-3">
                {snapshot.runs.map((run) => (
                  <RunCard key={run.id} agents={snapshot.agents} goals={snapshot.goals} run={run} />
                ))}
              </div>
            </Panel>
          </div>

          <div className="grid content-start gap-6">
            <Panel title="Agent Registry" action={<span>{snapshot.agents.length} active profiles</span>}>
              <div className="grid gap-3">
                {snapshot.agents.map((agent) => (
                  <article key={agent.id} className="rounded-2xl border border-white/10 bg-[#09131f]/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="m-0 text-base font-bold">{agent.name}</h3>
                        <p className="mt-1 text-sm leading-6 text-[#aab5c0]">{agent.description}</p>
                      </div>
                      <StatusPill value={`v${agent.version}`} />
                    </div>
                    <dl className="mt-3 grid gap-2 text-xs text-[#cad6de]">
                      <Meta label="Planning" value={agent.planningStyle} />
                      <Meta label="Tools" value={agent.toolPolicy} />
                      <Meta label="Memory" value={agent.memoryScope} />
                    </dl>
                  </article>
                ))}
              </div>
            </Panel>

            <Panel title="Approval Queue" action={<span>{pendingApprovals.length} pending</span>}>
              <div className="grid gap-3">
                {snapshot.approvals.map((approval) => (
                  <article key={approval.id} className="rounded-2xl border border-white/10 bg-[#09131f]/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="m-0 text-base font-bold">{approval.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-[#aab5c0]">{approval.description}</p>
                      </div>
                      <StatusPill value={approval.status} />
                    </div>
                    {approval.status === "pending" ? (
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <form action={resolveApprovalAction}>
                          <input name="approvalId" type="hidden" value={approval.id} />
                          <input name="status" type="hidden" value="approved" />
                          <button className="w-full rounded-xl bg-accent px-3 py-2 text-sm font-bold text-ink">
                            Approve
                          </button>
                        </form>
                        <form action={resolveApprovalAction}>
                          <input name="approvalId" type="hidden" value={approval.id} />
                          <input name="status" type="hidden" value="rejected" />
                          <button className="w-full rounded-xl border border-white/15 px-3 py-2 text-sm font-bold">
                            Reject
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </Panel>

            <Panel title="Memory Explorer" action={<span>{snapshot.memories.length} entries</span>}>
              <CreateMemoryForm goals={snapshot.goals} />
              <div className="mt-5 grid gap-3">
                {snapshot.memories.map((memory) => (
                  <article key={memory.id} className="rounded-2xl border border-white/10 bg-[#09131f]/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="m-0 text-sm font-bold">{memory.title}</h3>
                      <StatusPill value={memory.tier} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#aab5c0]">{memory.content}</p>
                  </article>
                ))}
              </div>
            </Panel>

            <Panel title="Knowledge Sources" action={<span>{snapshot.knowledgeSources.length} sources</span>}>
              <CreateKnowledgeSourceForm />
              <div className="mt-5 grid gap-3">
                {snapshot.knowledgeSources.map((source) => (
                  <article key={source.id} className="rounded-2xl border border-white/10 bg-[#09131f]/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="m-0 text-sm font-bold">{source.name}</h3>
                        <p className="mt-1 break-all text-xs text-[#aab5c0]">{source.uri}</p>
                      </div>
                      <StatusPill value={source.status} />
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
          </div>
        </section>
      </div>
    </main>
  );
}

async function createGoalAction(formData: FormData) {
  "use server";
  await requireOwner();
  const input = createGoalSchema.parse({
    title: formData.get("title"),
    description: formData.get("description"),
    successCriteria: formData.get("successCriteria"),
    constraints: formData.get("constraints") ?? "",
    horizon: formData.get("horizon") ?? "long_horizon",
    targetDate: emptyToUndefined(formData.get("targetDate"))
  });
  await apiJson("/api/goals", "POST", input);
  revalidatePath("/");
}

async function createRunAction(formData: FormData) {
  "use server";
  await requireOwner();
  const input = createRunSchema.parse({
    goalId: formData.get("goalId"),
    agentId: formData.get("agentId"),
    objective: formData.get("objective")
  });
  await apiJson("/api/runs", "POST", input);
  revalidatePath("/");
}

async function resolveApprovalAction(formData: FormData) {
  "use server";
  await requireOwner();
  const approvalId = String(formData.get("approvalId") ?? "");
  const input = resolveApprovalSchema.parse({
    status: formData.get("status"),
    resolvedBy: "owner"
  });
  await apiJson(`/api/approvals/${approvalId}`, "PATCH", input);
  revalidatePath("/");
}

async function createMemoryAction(formData: FormData) {
  "use server";
  await requireOwner();
  const input = createMemorySchema.parse({
    goalId: emptyToUndefined(formData.get("goalId")),
    tier: formData.get("tier") ?? "working",
    title: formData.get("title"),
    content: formData.get("content"),
    importance: emptyToUndefined(formData.get("importance")) ?? "3"
  });
  await apiJson("/api/memories", "POST", input);
  revalidatePath("/");
}

async function createKnowledgeSourceAction(formData: FormData) {
  "use server";
  await requireOwner();
  const input = createKnowledgeSourceSchema.parse({
    name: formData.get("name"),
    sourceType: formData.get("sourceType"),
    uri: formData.get("uri")
  });
  await apiJson("/api/knowledge-sources", "POST", input);
  revalidatePath("/");
}

async function requireOwner() {
  const session = await auth();
  if (!session?.user || session.role !== "owner") {
    redirect("/auth/signin");
  }
}

async function apiJson(path: string, method: "POST" | "PATCH", body: unknown) {
  const response = await apiFetch(path, {
    method,
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
}

async function apiFetch(path: string, init: RequestInit) {
  const env = loadEnv();
  const urls = buildServiceUrls(env);
  const headers = new Headers(init.headers);
  headers.set("x-internal-api-secret", env.INTERNAL_API_SECRET);

  return fetch(`${urls.apiBaseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers
  });
}

function CreateGoalForm() {
  return (
    <form action={createGoalAction} className="grid gap-3 rounded-2xl border border-white/10 bg-[#09131f]/70 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field name="title" placeholder="Launch reliable Phase 1" />
        <select name="horizon" className="field-control">
          <option value="long_horizon">Long horizon</option>
          <option value="quarterly">Quarterly</option>
          <option value="monthly">Monthly</option>
          <option value="weekly">Weekly</option>
          <option value="daily">Daily</option>
        </select>
      </div>
      <Textarea name="description" placeholder="What objective should the platform pursue?" />
      <Textarea name="successCriteria" placeholder="What does success look like?" />
      <div className="grid gap-3 md:grid-cols-[1fr_180px]">
        <Field name="constraints" placeholder="Constraints, policies, or boundaries" />
        <Field name="targetDate" type="date" />
      </div>
      <Submit>Create goal</Submit>
    </form>
  );
}

function CreateRunForm({ agents, goals }: { agents: Agent[]; goals: Goal[] }) {
  return (
    <form action={createRunAction} className="grid gap-3 rounded-2xl border border-white/10 bg-[#09131f]/70 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <select name="goalId" className="field-control" required>
          {goals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.title}
            </option>
          ))}
        </select>
        <select name="agentId" className="field-control" required>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </div>
      <Textarea name="objective" placeholder="What should the selected agent run now?" />
      <Submit>Request manual run</Submit>
    </form>
  );
}

function CreateMemoryForm({ goals }: { goals: Goal[] }) {
  return (
    <form action={createMemoryAction} className="grid gap-3 rounded-2xl border border-white/10 bg-[#09131f]/70 p-4">
      <Field name="title" placeholder="Memory title" />
      <Textarea name="content" placeholder="Fact, preference, observation, or completed-run memory" />
      <div className="grid gap-3 md:grid-cols-3">
        <select name="goalId" className="field-control">
          <option value="">No goal</option>
          {goals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.title}
            </option>
          ))}
        </select>
        <select name="tier" className="field-control">
          <option value="working">Working</option>
          <option value="episodic">Episodic</option>
          <option value="semantic">Semantic</option>
        </select>
        <Field defaultValue="3" max="5" min="1" name="importance" type="number" placeholder="3" />
      </div>
      <Submit>Add memory</Submit>
    </form>
  );
}

function CreateKnowledgeSourceForm() {
  return (
    <form action={createKnowledgeSourceAction} className="grid gap-3 rounded-2xl border border-white/10 bg-[#09131f]/70 p-4">
      <Field name="name" placeholder="Architecture docs" />
      <div className="grid gap-3 md:grid-cols-[150px_1fr]">
        <Field name="sourceType" placeholder="repo" />
        <Field name="uri" placeholder="docs/architecture.md" />
      </div>
      <Submit>Register source</Submit>
    </form>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#09131f]/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="m-0 text-lg font-bold">{goal.title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#aab5c0]">{goal.description}</p>
        </div>
        <StatusPill value={goal.status} />
      </div>
      <dl className="mt-4 grid gap-2 text-sm text-[#cad6de] md:grid-cols-3">
        <Meta label="Horizon" value={goal.horizon.replace("_", " ")} />
        <Meta label="Success" value={goal.successCriteria} />
        <Meta label="Constraints" value={goal.constraints || "None"} />
      </dl>
    </article>
  );
}

function RunCard({ agents, goals, run }: { agents: Agent[]; goals: Goal[]; run: Run }) {
  const agent = agents.find((candidate) => candidate.id === run.agentId);
  const goal = goals.find((candidate) => candidate.id === run.goalId);

  return (
    <article className="rounded-2xl border border-white/10 bg-[#09131f]/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="m-0 text-base font-bold">{run.objective}</h3>
          <p className="mt-1 text-sm text-[#aab5c0]">
            {agent?.name ?? "Unknown agent"} on {goal?.title ?? "unknown goal"}
          </p>
        </div>
        <StatusPill value={run.status} />
      </div>
      <p className="mt-3 text-sm leading-6 text-[#cad6de]">{run.summary}</p>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <div className="text-3xl font-bold text-accent">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[#aab5c0]">{label}</div>
    </article>
  );
}

function Panel({ action, children, title }: { action?: ReactNode; children: ReactNode; title: string }) {
  return (
    <section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 shadow-panel">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-xl font-bold">{title}</h2>
        {action ? <div className="text-xs uppercase tracking-[0.18em] text-accent">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  defaultValue,
  max,
  min,
  name,
  placeholder,
  type = "text"
}: {
  defaultValue?: string;
  max?: string;
  min?: string;
  name: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      className="field-control"
      defaultValue={defaultValue}
      max={max}
      min={min}
      name={name}
      placeholder={placeholder}
      type={type}
    />
  );
}

function Textarea({ name, placeholder }: { name: string; placeholder: string }) {
  return <textarea className="field-control min-h-24 resize-y" name={name} placeholder={placeholder} />;
}

function Submit({ children }: { children: ReactNode }) {
  return <button className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-ink">{children}</button>;
}

function StatusPill({ value }: { value: string }) {
  return (
    <span className="rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-accent">
      {value.replace("_", " ")}
    </span>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.16em] text-[#7f8d9a]">{label}</dt>
      <dd className="m-0 mt-1 leading-6">{value}</dd>
    </div>
  );
}

function emptyToUndefined(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  return value;
}
