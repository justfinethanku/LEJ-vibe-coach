# Landscape And Teardown

## What You Are Actually Trying To Build

You are not trying to build "a chatbot that can edit files."

You are trying to build a local agent host for coding work. The current generation of tools proves that the useful product is the host, not the model wrapper.

The recurring primitives across the strongest tools are:

- codebase read, search, patch, and shell execution
- explicit approval and permission modes
- git-aware safety rails
- model/provider flexibility
- good context assembly instead of dumping whole repos into the prompt
- durable session history
- extension surfaces like MCP, hooks, skills, or recipes
- optional subagents for bounded parallel work

## What Current Tools Prove

### Claude Code

Anthropic positions Claude Code as an agentic coding tool that reads the codebase, edits files, runs commands, integrates with git, supports MCP, supports project instructions and hooks, and can spawn multiple agents. It also runs across terminal, IDE, desktop, and web surfaces.  
Source: [Claude Code overview](https://docs.anthropic.com/en/docs/claude-code/overview)

What to borrow:

- one engine, many surfaces
- MCP as the tool bridge
- project-level instructions
- hooks for repeatable local automation
- clear separation between planning, execution, and extension surfaces

What not to copy first:

- remote control
- scheduled tasks
- multi-surface continuity
- cloud/off-device workflows

### OpenCode

OpenCode is one of the clearest references for a model-agnostic coding host. Its docs show:

- configurable primary agents and subagents
- a built-in `Build` mode and a restricted `Plan` mode
- model/provider abstraction over 75+ providers and local models
- granular permission policies for bash, edit, read, subagents, web fetch, and external directories
- built-in LSP and MCP integration

Sources:

- [OpenCode agents](https://opencode.ai/docs/agents/)
- [OpenCode models](https://opencode.ai/docs/models/)
- [OpenCode permissions](https://opencode.ai/docs/permissions/)
- [OpenCode LSP](https://opencode.ai/docs/lsp/)

What to borrow:

- permissions as config, not prompt text
- agent roles as data
- explicit `Plan` vs `Build`
- LSP and MCP as first-class system pieces

### Continue

Continue is a strong reference for local and offline IDE integration. Its docs explicitly support offline operation with local models, and its Ollama guide calls out a hard truth: some models claim tool support but do not actually behave well enough for agent mode.  
Sources:

- [Run Continue without internet](https://docs.continue.dev/guides/running-continue-without-internet)
- [Use Ollama with Continue](https://docs.continue.dev/guides/ollama-guide)

What to borrow:

- offline-first setup paths
- clear model capability checks
- context selection as a real subsystem, not an afterthought

### Aider

Aider remains one of the best references for terminal-first pragmatism:

- it is tightly integrated with git
- it auto-commits edits so undo and review stay cheap
- it isolates pre-existing dirty changes before applying its own edits
- it uses a tree-sitter-powered repo map to compress codebase structure into a smaller context budget

Sources:

- [Aider git integration](https://aider.chat/docs/git.html)
- [Aider repo map](https://aider.chat/2023/10/22/repomap.html)

What to borrow:

- git checkpoints by default
- repo map generation
- compact, explainable terminal workflow

### Cline

Cline is useful to study because it makes approvals and local model tradeoffs very explicit:

- read, write, shell, browser, and MCP actions can be individually approved
- auto-approve is per tool category
- "YOLO mode" is explicitly marked dangerous
- its local-model docs set realistic expectations around speed, context, and hardware
- it supports plan/act and subagent workflows

Sources:

- [What is Cline](https://docs.cline.bot/introduction/overview)
- [Auto approve and YOLO mode](https://docs.cline.bot/features/auto-approve)
- [Subagents](https://docs.cline.bot/features/subagents)
- [Local models overview](https://docs.cline.bot/running-models-locally/read-me-first)
- [LM Studio with Cline](https://docs.cline.bot/running-models-locally/lm-studio)

What to borrow:

- per-tool approvals
- explicit danger modes
- realistic local-model guidance

### Goose

Goose is a good reference for local persistence and operational hygiene:

- broad provider support, including local OpenAI-compatible endpoints
- local session storage in SQLite
- local logs with tool invocations and session IDs
- subagents with visible tool calls
- session search and resume

Sources:

- [Supported providers](https://block.github.io/goose/docs/getting-started/providers)
- [Logging system](https://block.github.io/goose/docs/guides/logs/)
- [Session management](https://block.github.io/goose/docs/guides/sessions/)
- [Subagents](https://block.github.io/goose/docs/guides/subagents/)

What to borrow:

- local session database
- human-readable logs
- replayable session IDs
- transparent subagent activity

### OpenHands

OpenHands is important because it takes runtime isolation and evaluation more seriously than most agent UIs:

- it warns that local LLMs may have limited functionality
- it recommends LM Studio plus strong local coding models
- it supports local backends through OpenAI-compatible endpoints
- it has an evaluation harness for benchmark integration

Sources:

- [OpenHands local LLMs](https://docs.openhands.dev/openhands/usage/llms/local-llms)
- [OpenHands evaluation harness](https://docs.openhands.dev/openhands/usage/developers/evaluation-harness)

What to borrow:

- separate runtime from agent controller
- evaluation as a real product concern
- explicit local-backend compatibility layers

## What The Best Tools Agree On

Across all of the above, the overlap is clear:

- local or remote model backends need a stable adapter layer
- tool access needs explicit policy
- code agents need git awareness
- context compression matters a lot
- logs and session state need to exist outside the chat transcript
- browser use and subagents are additive, not foundational

## What Frontier Products Still Do Better Than Local Setups

- better long-horizon reasoning
- better recovery after bad tool calls
- better consistency on large codebases
- better UI polish across multiple devices
- better multimodal and browser-assisted flows

That does not kill the local harness idea. It just changes the goal:

Build something that is locally great first, and architect it so stronger models can be dropped in later.

## My Read

This is not a pipe dream.

The realistic version is:

- build a lean, local-first host
- match the best open tools on system design
- accept that frontier-model quality is still a separate axis

That is a solid project. Trying to clone every product surface from day one is the part that turns it into fantasy.
