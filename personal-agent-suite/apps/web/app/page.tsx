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
import { FormSubmitButton } from "./components/form-submit-button";
import { LogoutButton } from "./components/logout-button";

import type { Agent, Goal, PlatformSnapshot, Run } from "@agent-suite/shared-types";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

type FormErrorTarget = "goal" | "run" | "approval" | "memory" | "knowledge";
type DashboardFormError = { target: FormErrorTarget; message: string };

async function getPlatformSnapshot(ownerId: string): Promise<{ apiUnavailable: boolean; snapshot: PlatformSnapshot }> {
  try {
    const response = await apiFetch("/api/platform", { method: "GET" }, ownerId);
    if (!response.ok) {
      return { snapshot: emptySnapshot(), apiUnavailable: true };
    }

    return { snapshot: platformSnapshotSchema.parse(await response.json()), apiUnavailable: false };
  } catch {
    return { snapshot: emptySnapshot(), apiUnavailable: true };
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

function unavailableNotice(apiUnavailable: boolean) {
  if (apiUnavailable) {
    return {
      title: "Control-plane API unavailable",
      body: "Start the API and Postgres services to load the database-backed platform state."
    };
  }

  return null;
}

export default async function HomePage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin");
  }

  const ownerId = ownerIdentifier(session);
  const { snapshot, apiUnavailable } = await getPlatformSnapshot(ownerId);
  const activeGoals = snapshot.goals.filter((goal) => goal.status === "active");
  const pendingApprovals = snapshot.approvals.filter((approval) => approval.status === "pending");
  const latestRun = snapshot.runs[0];
  const notice = unavailableNotice(apiUnavailable);
  const formError = parseFormError(searchParams);

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
              <CreateGoalForm errorMessage={formError?.target === "goal" ? formError.message : null} />
              <div className="mt-5 grid gap-3">
                {snapshot.goals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} />
                ))}
              </div>
            </Panel>

            <Panel title="Run Timeline" action={latestRun ? <span>Latest: {latestRun.status}</span> : null}>
              <CreateRunForm
                agents={snapshot.agents}
                errorMessage={formError?.target === "run" ? formError.message : null}
                goals={snapshot.goals}
              />
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
              {formError?.target === "approval" ? (
                <p id="approval-form-error" role="alert" className="mb-3 rounded-xl border border-[#ff76765f] bg-[#ff76761a] p-2 text-sm text-[#ffd1d1]">
                  {formError.message}
                </p>
              ) : null}
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
              <CreateMemoryForm
                errorMessage={formError?.target === "memory" ? formError.message : null}
                goals={snapshot.goals}
              />
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
              <CreateKnowledgeSourceForm errorMessage={formError?.target === "knowledge" ? formError.message : null} />
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
  const ownerId = await requireOwner();

  try {
    const input = createGoalSchema.parse({
      title: formData.get("title"),
      description: formData.get("description"),
      successCriteria: formData.get("successCriteria"),
      constraints: formData.get("constraints") ?? "",
      horizon: formData.get("horizon") ?? "long_horizon",
      targetDate: emptyToUndefined(formData.get("targetDate"))
    });
    await apiJson("/api/goals", "POST", input, ownerId);
    revalidatePath("/");
  } catch (error) {
    redirect(formErrorUrl("goal", error));
  }
}

async function createRunAction(formData: FormData) {
  "use server";
  const ownerId = await requireOwner();

  try {
    const input = createRunSchema.parse({
      goalId: formData.get("goalId"),
      agentId: formData.get("agentId"),
      objective: formData.get("objective")
    });
    await apiJson("/api/runs", "POST", input, ownerId);
    revalidatePath("/");
  } catch (error) {
    redirect(formErrorUrl("run", error));
  }
}

async function resolveApprovalAction(formData: FormData) {
  "use server";
  const ownerId = await requireOwner();

  try {
    const approvalId = String(formData.get("approvalId") ?? "");
    const input = resolveApprovalSchema.parse({
      status: formData.get("status"),
      resolvedBy: ownerId
    });
    await apiJson(`/api/approvals/${approvalId}`, "PATCH", input, ownerId);
    revalidatePath("/");
  } catch (error) {
    redirect(formErrorUrl("approval", error));
  }
}

async function createMemoryAction(formData: FormData) {
  "use server";
  const ownerId = await requireOwner();

  try {
    const input = createMemorySchema.parse({
      goalId: emptyToUndefined(formData.get("goalId")),
      tier: formData.get("tier") ?? "working",
      title: formData.get("title"),
      content: formData.get("content"),
      importance: emptyToUndefined(formData.get("importance")) ?? "3"
    });
    await apiJson("/api/memories", "POST", input, ownerId);
    revalidatePath("/");
  } catch (error) {
    redirect(formErrorUrl("memory", error));
  }
}

async function createKnowledgeSourceAction(formData: FormData) {
  "use server";
  const ownerId = await requireOwner();

  try {
    const input = createKnowledgeSourceSchema.parse({
    name: formData.get("name"),
    sourceType: formData.get("sourceType"),
    uri: formData.get("uri")
    });
    await apiJson("/api/knowledge-sources", "POST", input, ownerId);
    revalidatePath("/");
  } catch (error) {
    redirect(formErrorUrl("knowledge", error));
  }
}

async function requireOwner() {
  const session = await auth();
  if (!session?.user || session.role !== "owner") {
    redirect("/auth/signin");
  }

  return ownerIdentifier(session);
}

async function apiJson(path: string, method: "POST" | "PATCH", body: unknown, ownerId: string) {
  const response = await apiFetch(
    path,
    {
    method,
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json"
    }
    },
    ownerId
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload && typeof payload === "object" && "message" in payload ? String(payload.message) : null;
    throw new Error(message ?? `API request failed: ${response.status}`);
  }
}

async function apiFetch(path: string, init: RequestInit, ownerId?: string) {
  const env = loadEnv();
  const urls = buildServiceUrls(env);
  const headers = new Headers(init.headers);
  headers.set("x-internal-api-secret", env.INTERNAL_API_SECRET);
  if (ownerId) {
    headers.set("x-owner-id", ownerId);
  }

  return fetch(`${urls.apiBaseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers
  });
}

function CreateGoalForm({ errorMessage }: { errorMessage: string | null }) {
  const errorId = "goal-form-error";

  return (
    <form action={createGoalAction} className="grid gap-3 rounded-2xl border border-white/10 bg-[#09131f]/70 p-4">
      {errorMessage ? (
        <p id={errorId} role="alert" className="rounded-xl border border-[#ff76765f] bg-[#ff76761a] p-2 text-sm text-[#ffd1d1]">
          {errorMessage}
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          id="goal-title-field"
          errorId={errorMessage ? errorId : undefined}
          label="Goal title"
          name="title"
          placeholder="Launch reliable Phase 1"
        />
        <div className="grid gap-2">
          <FieldLabel htmlFor="goal-horizon">Horizon</FieldLabel>
          <select id="goal-horizon" name="horizon" className="field-control" aria-describedby={errorMessage ? errorId : undefined}>
            <option value="long_horizon">Long horizon</option>
            <option value="quarterly">Quarterly</option>
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="daily">Daily</option>
          </select>
        </div>
      </div>
      <Textarea
        id="goal-description-field"
        errorId={errorMessage ? errorId : undefined}
        label="Description"
        name="description"
        placeholder="What objective should the platform pursue?"
      />
      <Textarea
        id="goal-success-criteria-field"
        errorId={errorMessage ? errorId : undefined}
        label="Success criteria"
        name="successCriteria"
        placeholder="What does success look like?"
      />
      <div className="grid gap-3 md:grid-cols-[1fr_180px]">
        <Field
          id="goal-constraints-field"
          errorId={errorMessage ? errorId : undefined}
          label="Constraints"
          name="constraints"
          placeholder="Constraints, policies, or boundaries"
        />
        <Field id="goal-target-date-field" errorId={errorMessage ? errorId : undefined} label="Target date" name="targetDate" type="date" />
      </div>
      <FormSubmitButton pendingLabel="Creating goal...">Create goal</FormSubmitButton>
    </form>
  );
}

function CreateRunForm({ agents, errorMessage, goals }: { agents: Agent[]; errorMessage: string | null; goals: Goal[] }) {
  const errorId = "run-form-error";

  return (
    <form action={createRunAction} className="grid gap-3 rounded-2xl border border-white/10 bg-[#09131f]/70 p-4">
      {errorMessage ? (
        <p id={errorId} role="alert" className="rounded-xl border border-[#ff76765f] bg-[#ff76761a] p-2 text-sm text-[#ffd1d1]">
          {errorMessage}
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <FieldLabel htmlFor="run-goal">Goal</FieldLabel>
          <select id="run-goal" name="goalId" className="field-control" required aria-describedby={errorMessage ? errorId : undefined}>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="run-agent">Agent</FieldLabel>
          <select id="run-agent" name="agentId" className="field-control" required aria-describedby={errorMessage ? errorId : undefined}>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Textarea
        id="run-objective-field"
        errorId={errorMessage ? errorId : undefined}
        label="Objective"
        name="objective"
        placeholder="What should the selected agent run now?"
      />
      <FormSubmitButton pendingLabel="Submitting run...">Request manual run</FormSubmitButton>
    </form>
  );
}

function CreateMemoryForm({ errorMessage, goals }: { errorMessage: string | null; goals: Goal[] }) {
  const errorId = "memory-form-error";

  return (
    <form action={createMemoryAction} className="grid gap-3 rounded-2xl border border-white/10 bg-[#09131f]/70 p-4">
      {errorMessage ? (
        <p id={errorId} role="alert" className="rounded-xl border border-[#ff76765f] bg-[#ff76761a] p-2 text-sm text-[#ffd1d1]">
          {errorMessage}
        </p>
      ) : null}
      <Field id="memory-title-field" errorId={errorMessage ? errorId : undefined} label="Memory title" name="title" placeholder="Memory title" />
      <Textarea
        id="memory-content-field"
        errorId={errorMessage ? errorId : undefined}
        label="Memory content"
        name="content"
        placeholder="Fact, preference, observation, or completed-run memory"
      />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-2">
          <FieldLabel htmlFor="memory-goal">Goal</FieldLabel>
          <select id="memory-goal" name="goalId" className="field-control" aria-describedby={errorMessage ? errorId : undefined}>
            <option value="">No goal</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="memory-tier">Tier</FieldLabel>
          <select id="memory-tier" name="tier" className="field-control" aria-describedby={errorMessage ? errorId : undefined}>
            <option value="working">Working</option>
            <option value="episodic">Episodic</option>
            <option value="semantic">Semantic</option>
          </select>
        </div>
        <Field
          id="memory-importance-field"
          defaultValue="3"
          errorId={errorMessage ? errorId : undefined}
          label="Importance (1-5)"
          max="5"
          min="1"
          name="importance"
          type="number"
          placeholder="3"
        />
      </div>
      <FormSubmitButton pendingLabel="Saving memory...">Add memory</FormSubmitButton>
    </form>
  );
}

function CreateKnowledgeSourceForm({ errorMessage }: { errorMessage: string | null }) {
  const errorId = "knowledge-form-error";

  return (
    <form action={createKnowledgeSourceAction} className="grid gap-3 rounded-2xl border border-white/10 bg-[#09131f]/70 p-4">
      {errorMessage ? (
        <p id={errorId} role="alert" className="rounded-xl border border-[#ff76765f] bg-[#ff76761a] p-2 text-sm text-[#ffd1d1]">
          {errorMessage}
        </p>
      ) : null}
      <Field id="knowledge-name-field" errorId={errorMessage ? errorId : undefined} label="Source name" name="name" placeholder="Architecture docs" />
      <div className="grid gap-3 md:grid-cols-[150px_1fr]">
        <Field id="knowledge-source-type-field" errorId={errorMessage ? errorId : undefined} label="Source type" name="sourceType" placeholder="repo" />
        <Field id="knowledge-uri-field" errorId={errorMessage ? errorId : undefined} label="URI" name="uri" placeholder="docs/architecture.md" />
      </div>
      <FormSubmitButton pendingLabel="Registering source...">Register source</FormSubmitButton>
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
  errorId,
  id,
  label,
  max,
  min,
  name,
  placeholder,
  type = "text"
}: {
  defaultValue?: string;
  errorId?: string;
  id?: string;
  label: string;
  max?: string;
  min?: string;
  name: string;
  placeholder?: string;
  type?: string;
}) {
  const inputId = id ?? `${name}-field`;

  return (
    <div className="grid gap-2">
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <input
        id={inputId}
        aria-describedby={errorId}
        className="field-control"
        defaultValue={defaultValue}
        max={max}
        min={min}
        name={name}
        placeholder={placeholder}
        type={type}
      />
    </div>
  );
}

function Textarea({
  errorId,
  id,
  label,
  name,
  placeholder
}: {
  errorId?: string;
  id?: string;
  label: string;
  name: string;
  placeholder: string;
}) {
  const inputId = id ?? `${name}-field`;

  return (
    <div className="grid gap-2">
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <textarea id={inputId} aria-describedby={errorId} className="field-control min-h-24 resize-y" name={name} placeholder={placeholder} />
    </div>
  );
}

function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor: string }) {
  return (
    <label className="text-xs uppercase tracking-[0.14em] text-[#cad6de]" htmlFor={htmlFor}>
      {children}
    </label>
  );
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

function ownerIdentifier(session: { preferredUsername?: string | null; user?: { email?: string | null } }) {
  const preferred = session.preferredUsername?.trim();
  if (preferred) {
    return preferred;
  }

  const email = session.user?.email?.trim();
  if (email) {
    return email;
  }

  return "owner";
}

function parseFormError(searchParams?: Record<string, string | string[] | undefined>): DashboardFormError | null {
  const target = firstParam(searchParams, "formError");
  const message = firstParam(searchParams, "message");

  if (!target || !message) {
    return null;
  }

  if (target !== "goal" && target !== "run" && target !== "approval" && target !== "memory" && target !== "knowledge") {
    return null;
  }

  return {
    target,
    message
  };
}

function formErrorUrl(target: FormErrorTarget, error: unknown) {
  const params = new URLSearchParams({
    formError: target,
    message: dashboardErrorMessage(error)
  });

  return `/?${params.toString()}`;
}

function dashboardErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Request failed. Please check your input and try again.";
}

function firstParam(searchParams: Record<string, string | string[] | undefined> | undefined, key: string) {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value;
}
