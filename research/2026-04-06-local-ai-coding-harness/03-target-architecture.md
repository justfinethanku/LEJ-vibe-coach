# Target Architecture

## Recommended Shape

Build a `code agent host` with an optional local app shell.

Not:

- a VS Code extension first
- a desktop app first
- a multi-agent system first

Why:

- the host is the durable product
- the UI surface can change later
- a strong single-agent runtime is easier to debug, permission, and evaluate

## Core Principle

Models are replaceable.

The harness primitives are not.

That means the architecture should privilege:

- tool registry
- permission engine
- state and logs
- context assembly
- evals

over:

- clever prompt tricks
- provider-specific hacks
- special-casing one model family

## Recommended Subsystems

### 1. Session Controller

Owns:

- session IDs
- current workspace
- active model/provider
- status transitions
- user-visible run state

Status model:

- `idle`
- `planning`
- `awaiting_approval`
- `running`
- `waiting`
- `completed`
- `failed`

### 2. Orchestrator

A single agent loop that:

- assembles context
- chooses tools
- applies permissions
- records tool calls and outputs
- decides when to stop, ask, or retry

Do not start with multiple cooperating agents.

If you later need more structure, add:

- `planner` as read-only
- `explorer` as read-only
- `executor` as write-capable
- `verifier` as read-mostly

### 3. Model Adapter Layer

Start with:

- OpenAI-compatible adapter

Later add:

- Anthropic-compatible adapter
- provider-specific adapter only when compatibility breaks

This layer should normalize:

- model listing
- chat/responses calls
- tool call schemas
- streaming events
- token usage reporting
- context-window metadata

### 4. Capability Registry

Every tool should exist as metadata before execution.

Each entry should declare:

- tool name
- purpose
- input schema
- read/write/destructive profile
- permission category
- executor owner

Initial tool set:

- `read_file`
- `list_files`
- `search_code`
- `write_patch`
- `run_shell`
- `git_status`
- `git_diff`
- `git_branch`
- `fetch_url`

Phase 2 tools:

- `browser`
- `lsp_query`
- `mcp_tool`
- `test_runner`
- `formatter`

### 5. Permission Engine

This is a first-class subsystem.

Take the OpenCode and Cline lesson seriously: approvals should not live in prompt text.

Use three outcomes:

- `allow`
- `ask`
- `deny`

Policy dimensions:

- tool type
- command prefix
- file path pattern
- external directory access
- git mutation
- network use

Default policy I would ship:

- safe reads: `allow`
- search/list/LSP: `allow`
- file edits: `ask`
- shell commands: `ask`
- destructive shell patterns: `deny`
- git push / remote writes: `deny`
- network writes: `deny`

### 6. Execution Layer

Keep execution separate from orchestration.

Executors:

- file executor
- patch executor
- shell executor
- git executor
- web executor
- MCP executor

Each executor should:

- validate inputs
- enforce sandbox or path boundaries
- emit structured events
- return machine-readable outputs

### 7. Context Engine

This is where weaker local harnesses usually fall apart.

Inputs:

- user request
- current file selection
- recent transcript summary
- repo map
- LSP symbol lookups
- git diff and branch state
- project instructions
- optional retrieved docs

Rules:

- never dump the entire repo
- use a repo map for global structure
- load full files only when needed
- compact aggressively
- track provenance of retrieved context

### 8. State And Storage

Use SQLite from day one.

Tables I would expect:

- `sessions`
- `messages`
- `events`
- `tool_calls`
- `approvals`
- `artifacts`
- `settings`
- `eval_runs`

This gives you:

- resume
- search
- replay
- debugging
- export

### 9. Extension Surface

Use MCP as the first extension surface.

Why:

- MCP is explicitly host/client/server shaped
- the host owns permissions and context aggregation
- servers stay narrow and composable

Source:

- [MCP architecture](https://modelcontextprotocol.io/specification/2024-11-05/architecture/index)

Practical implication:

- the harness host should run MCP clients
- each connected MCP server should be treated as a scoped capability source
- full conversation history should stay with the host

### 10. Evaluation Layer

Do not add this later.

You want:

- golden tasks
- permission boundary tests
- replay traces
- model comparison runs
- crash/restart tests

OpenHands is a good proof point that serious agent systems need a real eval harness.  
Source: [OpenHands evaluation harness](https://docs.openhands.dev/openhands/usage/developers/evaluation-harness)

## Suggested Stack

### Core Engine

- TypeScript
- Node.js
- SQLite

Why:

- strong MCP and LLM tooling ecosystem
- easy process control for shell and local services
- good path to CLI, local server, and desktop shell

### UI

Start:

- CLI or TUI

Later:

- local web UI
- optional Electron or Tauri shell

I would not start in Next.js unless the UI is already the main product. The engine should be runnable without any browser.

## Lifecycle

1. User opens a workspace and chooses a model or provider.
2. Session controller loads project rules, recent summary, git state, and repo map.
3. Orchestrator receives the prompt with only the relevant tool pool.
4. If the model requests a tool, permission engine decides `allow`, `ask`, or `deny`.
5. Executor runs the tool and logs the event.
6. State is checkpointed after meaningful side effects.
7. Loop continues until completion, failure, or human intervention.
8. Final summary, artifacts, and diffs are stored for replay.

## What Not To Overbuild

- multi-agent orchestration in v1
- plugin marketplace in v1
- cloud sync in v1
- custom memory graph in v1
- browser automation in v1 unless you specifically need web app testing first

## Real Risks

- weak local tool-calling models will make the host look worse than it is
- context blowups will degrade behavior fast
- shell permissions can get dangerous if they are pattern-matched sloppily
- transcript-only persistence will make debugging miserable
- no eval harness means every improvement is guesswork

## My Opinionated Build Goal

Aim for this statement:

"A local coding host that can switch between LM Studio and Ollama, inspect a repo, plan safely, patch files, run tests with approval, use git sanely, and resume sessions."

That is already a serious product.
