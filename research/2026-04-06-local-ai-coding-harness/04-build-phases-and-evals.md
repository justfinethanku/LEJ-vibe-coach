# Build Phases And Evals

## Phase 1: Minimum Safe Harness

Goal:

Ship something you would actually use on a repo by yourself.

Build:

- CLI entrypoint
- workspace/session creation
- OpenAI-compatible provider adapter
- LM Studio and Ollama config
- file read, list, grep, and patch tools
- shell tool with `ask` by default
- git status and git diff tools
- SQLite event and session storage
- project instructions file support
- simple transcript compaction

Do not build yet:

- browser automation
- MCP
- subagents
- desktop UI
- scheduling

Acceptance criteria:

- can inspect a repo and answer codebase questions
- can propose a plan without making changes
- can apply a patch after approval
- can run tests or lint after approval
- can resume a prior session
- every tool call is logged outside the chat transcript

## Phase 2: Dependable Local Agent

Goal:

Make it feel trustworthy instead of merely impressive.

Build:

- explicit `Plan` mode and `Build` mode
- granular permission rules by tool, command prefix, and path
- repo map generation
- LSP-backed symbol lookups
- MCP client support
- richer patch preview and diff review
- retry policy for transient tool failures
- approval records
- better compaction and summaries

Acceptance criteria:

- local models do not get flooded with irrelevant context
- dangerous commands are consistently gated
- the host can explain why a tool was blocked
- MCP tools appear as scoped capabilities, not global chaos

## Phase 3: Product-Grade Operator Experience

Goal:

Make long sessions and repeated workflows manageable.

Build:

- local web or desktop shell
- richer timeline view for tool calls and approvals
- run history and searchable sessions
- worktree support for isolated tasks
- model presets and variants
- stronger health checks
- cost and token telemetry
- export and replay tools

Acceptance criteria:

- you can debug a bad run without reading the whole chat
- you can compare the same task across two models
- you can see where time and tokens were spent

## Phase 4: Optional Advanced Features

Only do this if the core host is already stable.

Possible additions:

- bounded subagents
- browser automation
- recurring local tasks
- remote worker support
- cloud fallback provider routing
- shared team profiles

Why these are later:

- they add complexity faster than they add trust
- they are the easiest place to overbuild

## Evaluation Plan

### Golden Tasks

Create a small benchmark repo set and run these every time you change the harness:

- explain architecture of an unfamiliar repo
- fix a failing unit test
- add one small feature across multiple files
- refactor a small module without breaking tests
- update docs based on a code change

### Permission Boundary Tests

These should be automated invariants:

- file edits require approval in `Plan` mode
- `rm`, `git push`, and other destructive commands are denied by default
- external-directory access is blocked unless allowed
- denied tools never execute

### Context Tests

- repo map stays under the configured token budget
- stale summaries do not override fresh file reads
- context compaction preserves task intent and open TODOs
- large repos still produce sane first-step behavior

### Durability Tests

- resume a prior session after process restart
- crash after a tool result is logged but before the final response
- reject an approval request and confirm the run remains consistent
- replay a past run from stored events

### Model Comparison Tests

Run the same task on:

- LM Studio model A
- Ollama model B
- optional stronger cloud model later

Record:

- success or failure
- number of tool calls
- token usage
- time to completion
- human correction needed

## What Success Looks Like

Short version:

- you trust it on your own repos
- it does not hide what it is doing
- it does not silently make risky changes
- swapping models does not require rewriting the app

## My Strong Recommendation

Do not call v1 "done" because it can edit files.

Call v1 done when:

- it can work safely
- it can explain itself
- it can recover
- it can be measured

That is the difference between a demo and a harness.
