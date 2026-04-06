# Local AI Coding Harness Research

As of 2026-04-06

## Bottom Line

Yes, this is buildable.

No, the right first target is not "clone Claude Code and Codex 1:1."

The right target is "build a local-first code agent host that has the same core primitives":

- workspace-aware code reading and editing
- shell execution with approvals
- git-aware checkpoints and recovery
- pluggable model backends
- MCP and custom tool support
- project instructions and lightweight memory
- session logs, compaction, and resume
- optional subagents and browser tooling
- an evaluation harness so changes do not silently make the system worse

If we get the host architecture right, model choice becomes a provider problem instead of a product rewrite.

## Recommendation

Build a local host/orchestrator in TypeScript with:

- an OpenAI-compatible model adapter first
- LM Studio or Ollama as the default local runtime
- SQLite for sessions, events, approvals, and settings
- a terminal-first interface first, then an optional local web or desktop shell
- explicit permission tiers instead of unrestricted tool access
- MCP as a first-class extension surface

Why this shape:

- most local runtimes already expose OpenAI-like APIs, so one adapter unlocks many models
- MCP gives you a standard tool surface instead of hard-coding every integration
- terminal-first gets you to usefulness faster than chasing desktop polish too early

## Machine-Specific Read

Local machine profile detected on 2026-04-06:

- Apple M4 Max
- 128 GB RAM
- 16 CPU cores

Inference from current tool docs plus your hardware:

- 30B-class coding models are a realistic default tier on this machine
- larger quantized models are plausible to experiment with locally
- LM Studio and Ollama are the best first runtimes for you
- vLLM matters later if you want a server-grade host or a separate Linux/NVIDIA box

## Important Truths Up Front

- The harness and the model are different products. A great harness can still feel bad with a weak local model.
- Tool use, permissions, state, and context selection matter more than prompt cleverness.
- Frontier cloud models still outperform local models on long-horizon coding tasks, recovery after mistakes, and large-context reasoning. Build for local-first, but do not paint yourself into a local-only corner.
- You do not need multi-agent first. A strong single-agent host with a clean permission model will beat a messy "agent swarm."

## Folder Contents

- `01-landscape-and-teardown.md`
- `02-local-runtimes-and-models.md`
- `03-target-architecture.md`
- `04-build-phases-and-evals.md`
- `sources.md`

## Best Starting Position

If we decide to build this, my recommendation is:

1. Ship a single-agent CLI harness first.
2. Back it with LM Studio or Ollama through an OpenAI-compatible adapter.
3. Add file tools, shell tools, git safety, approvals, and session logging.
4. Add repo map, LSP, MCP, and evals before subagents.
5. Add web or desktop UX only after the engine is stable.

That path gets you something real, local, and useful without turning the first version into a six-month rewrite trap.
