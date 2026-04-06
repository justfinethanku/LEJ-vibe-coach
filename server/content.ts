import { PROJECT_CONTEXT } from '../vibe-coach.project.js'

export type QuizQuestionSeed = {
  prompt: string
  options: string[]
  correctOption: string
  explanation: string
}

export type LessonSeed = {
  slug: string
  title: string
  stage: 'Foundations' | 'Systems' | 'Advanced'
  difficulty: 'Intro' | 'Intermediate' | 'Advanced'
  orderIndex: number
  estimatedMinutes: number
  summary: string
  goals: string[]
  relatedResearchSlugs: string[]
  content: string
  quizTitle: string
  quizQuestions: QuizQuestionSeed[]
}

export const PROJECT_SEED = {
  slug: PROJECT_CONTEXT.slug,
  title: PROJECT_CONTEXT.title,
  description: PROJECT_CONTEXT.description,
}

export const LEARNING_TRACK_SEED = {
  slug: PROJECT_CONTEXT.track.slug,
  title: PROJECT_CONTEXT.track.title,
  description: PROJECT_CONTEXT.track.description,
}

export const RESEARCH_METADATA_BY_FILE: Record<
  string,
  { summary: string; category: string }
> = {
  'README.md': {
    summary:
      'The blunt verdict on feasibility, hardware fit, and the recommended v1 boundary.',
    category: 'orientation',
  },
  '01-landscape-and-teardown.md': {
    summary:
      'A teardown of current coding agents and the core product primitives they share.',
    category: 'landscape',
  },
  '02-local-runtimes-and-models.md': {
    summary:
      'The local runtime and model choices that fit this project and this machine.',
    category: 'runtime',
  },
  '03-target-architecture.md': {
    summary:
      'The recommended subsystem boundaries for the host, adapter, tools, state, and extensions.',
    category: 'architecture',
  },
  '04-build-phases-and-evals.md': {
    summary:
      'A phased implementation plan plus the evaluation model required to trust the system.',
    category: 'roadmap',
  },
  'sources.md': {
    summary:
      'The current official and project-maintained sources used to ground this prototype.',
    category: 'reference',
  },
}

export const LESSON_SEEDS: LessonSeed[] = [
  {
    slug: 'what-you-are-actually-building',
    title: 'What You Are Actually Building',
    stage: 'Foundations',
    difficulty: 'Intro',
    orderIndex: 1,
    estimatedMinutes: 20,
    summary:
      'Separate the harness from the model so you can reason about the product clearly.',
    goals: [
      'Distinguish a coding harness host from an LLM runtime or model.',
      'Recognize the core primitives shared by strong coding agents.',
      'Explain why cloning every Claude Code or Codex feature in v1 is the wrong goal.',
    ],
    relatedResearchSlugs: ['readme', '01-landscape-and-teardown'],
    content: `## Core idea

The useful product is **not** "a local model wrapper." The useful product is a **local agent host** for coding work.

That host owns the parts that make an agent usable:

- it understands the workspace
- it knows which tools exist
- it enforces permissions
- it chooses and records tool calls
- it stores session state and progress
- it assembles the right context for the model

The model is still important, but it is only one subsystem.

## Why this distinction matters

If you blur the harness and the model together, you end up with a fragile product:

- every model swap feels like a rewrite
- tool behavior gets encoded in prompts instead of policy
- state leaks into chat history
- debugging becomes guesswork

If you keep the host separate, the model becomes a provider detail.

## The product boundary for v1

The right v1 target is:

> a local-first code agent host with the same core primitives as the best tools

That means:

- read and patch files
- run shell commands with approval
- stay aware of git state
- connect to pluggable model backends
- store logs and progress
- support extensions cleanly

It does **not** mean:

- rebuild every surface from Claude Code
- ship cloud sync
- start with agent swarms
- optimize for polished multi-device workflows before the engine works

## Mental model to keep

Use this sentence as a gut check:

> The harness is the system of record. The model is a replaceable reasoning engine.

Once that is true, the rest of the architecture becomes much easier to reason about.
`,
    quizTitle: 'Check the mental model',
    quizQuestions: [
      {
        prompt:
          'What is the most accurate description of the product you are building?',
        options: [
          'A chatbot with file access',
          'A local model downloader',
          'A local code agent host with explicit tool, state, and permission systems',
          'A VS Code theme with AI commands',
        ],
        correctOption:
          'A local code agent host with explicit tool, state, and permission systems',
        explanation:
          'The durable product is the host that manages tools, permissions, context, and state. The model plugs into that host.',
      },
      {
        prompt:
          'Why is “clone Claude Code feature-for-feature” a bad v1 target?',
        options: [
          'Because local models cannot edit code',
          'Because it adds a lot of surface area before the core host is trustworthy',
          'Because MCP makes desktop apps obsolete',
          'Because SQLite cannot scale to that many features',
        ],
        correctOption:
          'Because it adds a lot of surface area before the core host is trustworthy',
        explanation:
          'The risk is overbuilding the product surface before the architecture earns trust.',
      },
      {
        prompt:
          'Which statement best captures the intended architecture?',
        options: [
          'The model should manage all policy in the prompt.',
          'The chat transcript should be the main state store.',
          'The harness should own policy and state, while the model remains replaceable.',
          'The UI should decide which tools are safe.',
        ],
        correctOption:
          'The harness should own policy and state, while the model remains replaceable.',
        explanation:
          'A strong host architecture keeps policy and durability outside the model prompt.',
      },
    ],
  },
  {
    slug: 'local-runtimes-and-models',
    title: 'Local Runtimes And Models',
    stage: 'Foundations',
    difficulty: 'Intro',
    orderIndex: 2,
    estimatedMinutes: 25,
    summary:
      'Understand the runtime layer so you choose providers that fit your machine and your product.',
    goals: [
      'Compare LM Studio, Ollama, and vLLM in product terms.',
      'Understand why Apple-Silicon fit matters more than generic compatibility.',
      'Explain why context length and tool use reliability are as important as raw benchmark strength.',
    ],
    relatedResearchSlugs: ['02-local-runtimes-and-models', 'sources'],
    content: `## Start with the runtime, not just the model name

A local coding setup has two moving parts:

1. the **runtime**, which serves the model
2. the **model**, which actually reasons and emits tool calls

You need both.

## The best fit for this machine

For this project, the current best first-tier choices are:

- **LM Studio** for the easiest local server and Mac-friendly workflow
- **Ollama** for scriptability and automation
- **vLLM** later, if you move toward a more server-style deployment

Why LM Studio is the strongest default here:

- strong Apple Silicon path
- OpenAI-compatible serving
- useful GUI plus headless mode
- good fit for experimentation

Why Ollama still matters:

- simple API
- easy automation
- broad integration support across coding tools

## Model quality is not the only variable

A weaker local model can make a good host feel broken.

The biggest failure modes are:

- poor tool calling
- short effective context
- weak recovery after a bad command or patch

That is why current docs keep emphasizing **tool support** and **context length**, not just "coding benchmark."

## Your practical takeaway

For v1, design the host around:

- OpenAI-compatible local endpoints first
- model switching without rewriting business logic
- explicit per-model config, especially context length

That gives you room to use what works now and swap models later.
`,
    quizTitle: 'Runtime and model tradeoffs',
    quizQuestions: [
      {
        prompt: 'Why is LM Studio the best first runtime for this machine?',
        options: [
          'It is the only runtime that supports coding models',
          'It is a strong Mac-friendly local server with both GUI and headless paths',
          'It replaces the need for a database',
          'It guarantees the best model quality',
        ],
        correctOption:
          'It is a strong Mac-friendly local server with both GUI and headless paths',
        explanation:
          'LM Studio fits the Apple Silicon workflow well and exposes the compatibility layer the harness wants.',
      },
      {
        prompt:
          'What is one major reason a local coding setup can feel bad even if the architecture is sound?',
        options: [
          'The repo uses TypeScript',
          'The model is weak at tool calling or context handling',
          'SQLite cannot store markdown',
          'The browser UI is not dark mode',
        ],
        correctOption:
          'The model is weak at tool calling or context handling',
        explanation:
          'A poor local model can make a well-designed host feel unreliable.',
      },
      {
        prompt:
          'Why should the host center an OpenAI-compatible adapter first?',
        options: [
          'Because it unlocks multiple local runtimes behind one app-facing interface',
          'Because it removes the need for permissions',
          'Because only OpenAI-style models can edit code',
          'Because MCP requires OpenAI-specific APIs',
        ],
        correctOption:
          'Because it unlocks multiple local runtimes behind one app-facing interface',
        explanation:
          'Many local runtimes speak an OpenAI-like API, so one adapter buys a lot of flexibility.',
      },
    ],
  },
  {
    slug: 'tools-and-permissions',
    title: 'Tools, Permissions, And Safety',
    stage: 'Foundations',
    difficulty: 'Intermediate',
    orderIndex: 3,
    estimatedMinutes: 30,
    summary:
      'The harness earns trust by making tool access explicit and inspectable.',
    goals: [
      'Understand why tools should exist as metadata before execution.',
      'Design a simple allow/ask/deny permission model.',
      'Spot the difference between safe reads and risky mutations.',
    ],
    relatedResearchSlugs: ['01-landscape-and-teardown', '03-target-architecture'],
    content: `## A coding agent is mostly a tool router

The model decides **what** to do next, but the harness decides:

- which tools exist
- what each tool is allowed to do
- whether approval is required
- how the tool is executed
- what gets logged

That means a tool should be defined as metadata before the model touches it.

## Why metadata-first tools matter

Each tool should declare:

- name
- purpose
- input shape
- read/write/destructive profile
- permission category
- execution owner

This keeps policy out of prompt spaghetti.

## The permission model for v1

Use three outcomes:

- **allow** for safe reads
- **ask** for edits, shell execution, and other meaningful side effects
- **deny** for destructive defaults like \`rm\`, remote writes, or anything too risky for autonomous execution

That model is simple enough to understand and strong enough to protect the user.

## Important product lesson

Do not hide safety inside vague instructions like:

> be careful when editing files

That is not a permission model. That is wishful thinking.

## Git is part of safety

Strong coding tools also make git part of the harness:

- show status and diff
- checkpoint changes
- separate prior dirty work from new agent work

That is not polish. It is recoverability.
`,
    quizTitle: 'Safety primitives',
    quizQuestions: [
      {
        prompt: 'Why should tools be defined as metadata before execution?',
        options: [
          'So the model can discover policy, purpose, and risk without executing anything',
          'So the UI can avoid making API calls',
          'So the database can skip migrations',
          'So shell commands run faster',
        ],
        correctOption:
          'So the model can discover policy, purpose, and risk without executing anything',
        explanation:
          'The capability registry should answer what exists and how risky it is before a tool is ever executed.',
      },
      {
        prompt: 'Which default action is best for file edits in v1?',
        options: ['allow', 'ask', 'deny forever', 'hide from the model'],
        correctOption: 'ask',
        explanation:
          'File edits are valuable, but they are still mutations and should be explicitly approved in a first version.',
      },
      {
        prompt: 'Why is git awareness part of safety, not just convenience?',
        options: [
          'Because git makes the model smarter',
          'Because it provides checkpoints, diffs, and rollback paths when the agent makes mistakes',
          'Because every AI app must be a GitHub app',
          'Because MCP requires git',
        ],
        correctOption:
          'Because it provides checkpoints, diffs, and rollback paths when the agent makes mistakes',
        explanation:
          'Recoverability is one of the core ways a coding harness earns trust.',
      },
    ],
  },
  {
    slug: 'context-and-memory',
    title: 'Context, Repo Maps, And Memory',
    stage: 'Systems',
    difficulty: 'Intermediate',
    orderIndex: 4,
    estimatedMinutes: 30,
    summary:
      'Most bad coding-agent behavior is really bad context assembly in disguise.',
    goals: [
      'Understand why context is a scarce resource even on bigger local models.',
      'Explain the role of repo maps, file selection, and retrieval.',
      'Separate short-lived task context from durable knowledge.',
    ],
    relatedResearchSlugs: ['03-target-architecture', '04-build-phases-and-evals'],
    content: `## Context is not “everything the repo contains”

The best coding agents do not dump the entire codebase into the model.

They assemble context from layers:

- the user request
- current file focus
- recent conversation summary
- repo map
- git state
- targeted full-file reads
- symbol lookups through LSP

## Why repo maps matter

A repo map gives the model structural awareness without forcing full-file reads for everything.

That helps with:

- navigation
- naming consistency
- architectural awareness
- lower token usage

It is one of the simplest high-leverage ideas to copy from tools like Aider.

## Memory should stay small and trustworthy

Split memory into buckets:

- **session context** for current-task details
- **persistent project knowledge** for stable, validated facts
- **operator policy** for rules that should not drift

Do not let every model inference become durable memory. That creates stale, conflicting knowledge fast.

## Design rule

The model should see the **right information**, not the **maximum information**.
`,
    quizTitle: 'Context discipline',
    quizQuestions: [
      {
        prompt: 'What is the main purpose of a repo map?',
        options: [
          'To store quiz scores',
          'To compress global codebase structure into a smaller context budget',
          'To replace git history',
          'To prevent the model from reading files',
        ],
        correctOption:
          'To compress global codebase structure into a smaller context budget',
        explanation:
          'A repo map gives broad structural awareness without sending full source for everything.',
      },
      {
        prompt: 'Which statement is the healthiest memory rule for v1?',
        options: [
          'Persist every model summary forever',
          'Treat conversation history as the only state model',
          'Keep memory scoped, provenance-aware, and smaller than you think you need',
          'Avoid any summaries at all',
        ],
        correctOption:
          'Keep memory scoped, provenance-aware, and smaller than you think you need',
        explanation:
          'Unscoped memory quickly becomes stale and contradictory.',
      },
      {
        prompt: 'What is the better design rule for context assembly?',
        options: [
          'Send everything and let the model sort it out',
          'Minimize tool calls by avoiding retrieval',
          'Show the right information, not the maximum information',
          'Only show files the user manually selects',
        ],
        correctOption:
          'Show the right information, not the maximum information',
        explanation:
          'High-signal context beats high-volume context, especially in coding workflows.',
      },
    ],
  },
  {
    slug: 'state-durability-and-logs',
    title: 'State, Durability, And Logs',
    stage: 'Systems',
    difficulty: 'Intermediate',
    orderIndex: 5,
    estimatedMinutes: 25,
    summary:
      'A chat transcript is not a workflow engine. Durable state makes the harness explainable and recoverable.',
    goals: [
      'Separate session state from workflow state.',
      'Understand why logs and event history belong outside the transcript.',
      'Learn the minimum durable primitives required for approvals and retries.',
    ],
    relatedResearchSlugs: ['03-target-architecture', '04-build-phases-and-evals'],
    content: `## The dangerous mistake

Many early agent prototypes treat the chat transcript as the whole state model.

That breaks down immediately when you need:

- approvals
- retries
- progress tracking
- crash recovery
- a searchable history of what happened

## Session state vs workflow state

**Session state** answers:

- what the user and agent have said
- what the current context is

**Workflow state** answers:

- what step is happening
- what side effects already occurred
- what can be retried safely
- what the system is waiting on

They overlap, but they are not the same thing.

## Why SQLite is the right v1 move

For a local prototype, SQLite gives you:

- one file
- strong inspectability
- durable history
- easy backups
- simple queries for progress, notes, quizzes, and runs

That is exactly the right trade for this product stage.

## Logging rule

Log more than the transcript:

- tool calls
- permission decisions
- state changes
- quiz attempts
- comments and follow-up signals

If the only audit trail lives in conversational prose, the system will be painful to debug.
`,
    quizTitle: 'Durability basics',
    quizQuestions: [
      {
        prompt:
          'Why is a raw chat transcript not enough for a real coding harness?',
        options: [
          'Because markdown cannot be searched',
          'Because it does not reliably model approvals, retries, workflow steps, or durable state',
          'Because local models cannot read prior messages',
          'Because browser apps cannot display long transcripts',
        ],
        correctOption:
          'Because it does not reliably model approvals, retries, workflow steps, or durable state',
        explanation:
          'A transcript is communication history, not a full workflow state machine.',
      },
      {
        prompt: 'What makes SQLite a strong v1 choice here?',
        options: [
          'It is distributed by default',
          'It is a single-file, inspectable, durable store that fits a local prototype well',
          'It removes the need for an API',
          'It can replace the model runtime',
        ],
        correctOption:
          'It is a single-file, inspectable, durable store that fits a local prototype well',
        explanation:
          'SQLite matches the solo-maintainable, local-first design goal.',
      },
      {
        prompt: 'Which item belongs in workflow state rather than just session state?',
        options: [
          'A user preference for concise explanations',
          'The exact step currently awaiting approval',
          'The lesson title',
          'A markdown heading from the research notes',
        ],
        correctOption: 'The exact step currently awaiting approval',
        explanation:
          'Waiting states, retries, and side-effect boundaries belong to workflow state.',
      },
    ],
  },
  {
    slug: 'mcp-lsp-and-extensions',
    title: 'MCP, LSP, And Extension Surfaces',
    stage: 'Systems',
    difficulty: 'Intermediate',
    orderIndex: 6,
    estimatedMinutes: 30,
    summary:
      'Use extension standards to widen the harness safely instead of hand-wiring every capability.',
    goals: [
      'Understand the host-client-server shape of MCP.',
      'See why LSP belongs in the context layer rather than the model prompt.',
      'Learn why extension surfaces should arrive after the core host is stable.',
    ],
    relatedResearchSlugs: ['01-landscape-and-teardown', '03-target-architecture'],
    content: `## Why MCP matters

MCP is useful because it gives the harness a standard way to talk to focused capability providers.

The important architectural point is:

- the **host** owns context, permissions, and orchestration
- each **client** talks to one MCP server
- each **server** provides narrow tools, resources, or prompts

That separation keeps the main agent in control.

## Why LSP matters

LSP gives the harness precise code intelligence:

- definitions
- references
- symbols
- structure-aware lookups

That belongs in the context engine and tool layer, not buried inside general chat reasoning.

## The sequencing lesson

You do want MCP and LSP.

You do **not** want a plugin marketplace before:

- the tool registry is stable
- permissions are explicit
- logs are trustworthy
- the core agent loop is measurable

Extension surfaces amplify both good architecture and bad architecture. Ship them after the core host can carry the weight.
`,
    quizTitle: 'Extension surfaces',
    quizQuestions: [
      {
        prompt:
          'In MCP, which component should own permissions and overall orchestration?',
        options: ['The server', 'The host', 'The model runtime', 'The browser UI'],
        correctOption: 'The host',
        explanation:
          'The host coordinates clients, aggregates context, and enforces security boundaries.',
      },
      {
        prompt: 'Why is LSP valuable in a coding harness?',
        options: [
          'It replaces the need for file reads',
          'It provides precise code intelligence like symbols and references',
          'It generates better CSS automatically',
          'It is required for SQLite',
        ],
        correctOption:
          'It provides precise code intelligence like symbols and references',
        explanation:
          'LSP gives structure-aware signals that improve navigation and context assembly.',
      },
      {
        prompt:
          'What is the healthiest sequencing rule for extensibility in v1?',
        options: [
          'Build a plugin marketplace before a capability registry',
          'Ship extensibility only after the core host and policy layer are stable',
          'Avoid standards like MCP entirely',
          'Let plugins bypass policy for flexibility',
        ],
        correctOption:
          'Ship extensibility only after the core host and policy layer are stable',
        explanation:
          'Extension systems multiply architecture decisions, so the base needs to be solid first.',
      },
    ],
  },
  {
    slug: 'evaluation-and-trust',
    title: 'Evaluation And Trust',
    stage: 'Advanced',
    difficulty: 'Advanced',
    orderIndex: 7,
    estimatedMinutes: 25,
    summary:
      'The difference between a demo and a harness is whether you can measure regressions and explain failures.',
    goals: [
      'Understand why evaluation belongs in the initial design.',
      'Define golden tasks, permission tests, and durability tests.',
      'Track the metrics that actually tell you whether the harness is getting better.',
    ],
    relatedResearchSlugs: ['04-build-phases-and-evals', 'sources'],
    content: `## Why evaluation cannot wait

Agent systems are slippery.

You can make a change that feels better in one session and silently breaks:

- tool selection
- permission boundaries
- retry behavior
- context quality

If you do not have evals, you will not know.

## The minimum eval stack

For this project, v1 should still include:

- **golden tasks** on representative repos
- **permission boundary tests**
- **durability tests** for restart and recovery
- **model comparison runs**

This is the part that turns “it seemed smart today” into a real engineering loop.

## What to measure

Track:

- lesson progress and quiz performance in this prototype
- harness task success later
- average quiz score or task score
- failure categories
- approval frequency
- retry frequency
- token and time cost by run

## Product trust rule

Do not call the harness good because it can make code changes.

Call it good when:

- it works safely
- it explains itself
- it recovers from failure
- it can be evaluated repeatedly
`,
    quizTitle: 'Evaluation discipline',
    quizQuestions: [
      {
        prompt: 'Why should evaluation be part of the initial design?',
        options: [
          'Because local apps need more CSS',
          'Because agent changes can silently regress behavior unless you measure them',
          'Because SQLite requires test fixtures',
          'Because MCP servers only run with benchmarks',
        ],
        correctOption:
          'Because agent changes can silently regress behavior unless you measure them',
        explanation:
          'Without evals, it is too easy to mistake a lucky run for actual improvement.',
      },
      {
        prompt:
          'Which of these is a strong example of a durability test?',
        options: [
          'Can the UI resize on mobile?',
          'Does the app restart after a crash and preserve the workflow state?',
          'Can the model generate a catchy tagline?',
          'Does the sidebar use gradients?',
        ],
        correctOption:
          'Does the app restart after a crash and preserve the workflow state?',
        explanation:
          'Durability tests verify that work survives failures and resumes safely.',
      },
      {
        prompt:
          'What is the healthiest definition of trust for this project?',
        options: [
          'The model sounds confident',
          'The UI looks polished',
          'The system works safely, explains itself, recovers, and can be measured',
          'The app uses many agents',
        ],
        correctOption:
          'The system works safely, explains itself, recovers, and can be measured',
        explanation:
          'Trust comes from system behavior and observability, not just flashy outputs.',
      },
    ],
  },
  {
    slug: 'your-build-plan',
    title: 'Your Build Plan',
    stage: 'Advanced',
    difficulty: 'Advanced',
    orderIndex: 8,
    estimatedMinutes: 20,
    summary:
      'Translate the research into a concrete implementation order that stays maintainable.',
    goals: [
      'Name the correct v1 boundary for your harness.',
      'Break the work into phases that add leverage without overbuilding.',
      'Use comments and quiz results from this app as inputs for future lesson revisions.',
    ],
    relatedResearchSlugs: ['readme', '04-build-phases-and-evals'],
    content: `## The practical sequence

If you start building the harness itself next, the order should be:

1. single-agent CLI host
2. OpenAI-compatible model adapter
3. file tools, shell tools, git status and diffs
4. permission engine and approval flow
5. SQLite sessions, logs, and history
6. repo map, LSP, MCP
7. better UI and optional browser or desktop shell

## Why this order works

It gives you:

- real utility early
- a narrow surface to debug
- hard architectural feedback before UI polish
- a clean place to add future capabilities

## How this learning app fits in

This prototype is not just a one-off.

It demonstrates a reusable pattern:

- collect research
- store it in SQLite
- generate lessons and quizzes
- track progress and confusion
- use learner comments to refine future content

That means the comment system is not fluff. It is the input channel for the next version of the curriculum.

## Your next move after this prototype

Once this learning app works, the smartest follow-up is to build the **harness engine**, not a bigger curriculum system.

You now have enough structure to learn while building, instead of waiting to feel “fully ready” first.
`,
    quizTitle: 'Implementation order',
    quizQuestions: [
      {
        prompt: 'What is the healthiest v1 build sequence for the harness?',
        options: [
          'Start with desktop polish, then add state later',
          'Start with a CLI host and core engine, then layer richer context and UI',
          'Start with a plugin marketplace',
          'Start with multi-agent orchestration and ignore approvals',
        ],
        correctOption:
          'Start with a CLI host and core engine, then layer richer context and UI',
        explanation:
          'That sequence keeps the system lean and lets the architecture prove itself early.',
      },
      {
        prompt: 'Why does this prototype app matter beyond this one project?',
        options: [
          'It proves SQLite can store markdown',
          'It establishes a reusable pattern for research, lessons, comments, and progress tracking',
          'It eliminates the need for future docs',
          'It means you no longer need research',
        ],
        correctOption:
          'It establishes a reusable pattern for research, lessons, comments, and progress tracking',
        explanation:
          'The app is a prototype for a repeatable learning workflow, not just a single lesson set.',
      },
      {
        prompt:
          'What should happen after this prototype is working well enough to use?',
        options: [
          'Pause all work until every lesson is perfect',
          'Shift effort into building the actual harness engine',
          'Delete the research because it has already been learned',
          'Replace SQLite before any further work',
        ],
        correctOption: 'Shift effort into building the actual harness engine',
        explanation:
          'The app should support the real build, not become a detour that consumes the whole project.',
      },
    ],
  },
]
