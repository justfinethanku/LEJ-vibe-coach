# Local Runtimes And Models

## Your Hardware Envelope

Detected locally on 2026-04-06:

- Apple M4 Max
- 128 GB RAM
- 16 CPU cores

Inference from current local-model docs:

- you are well past the "can I run a coding model locally?" threshold
- 30B-class coding models should be comfortable
- larger quantized models are plausible to test
- Apple-Silicon-optimized runtimes matter more than raw compatibility

## Runtime Shortlist

### 1. LM Studio

Best first choice for your machine.

Why:

- supports local OpenAI-like endpoints and Anthropic-compatible endpoints
- supports llama.cpp and MLX
- has explicit Apple Silicon support, including MLX
- can run headless as a background service
- now acts as an MCP host and can expose MCP via API

Sources:

- [LM Studio docs home](https://lmstudio.ai/docs)
- [LM Studio local API server](https://lmstudio.ai/docs/developer/core/server)
- [Run LM Studio headless](https://lmstudio.ai/docs/api/headless)
- [Use MCP servers in LM Studio](https://lmstudio.ai/docs/app/plugins/mcp/)
- [Using MCP via API](https://lmstudio.ai/docs/developer/core/mcp)
- [LM Studio MLX support](https://lmstudio.ai/mlx)

Why I would start here:

- it is the cleanest "download model, run server, wire harness" path on a Mac
- it gives you a GUI when you want one and a service when you do not
- it already speaks the compatibility layers a harness wants

### 2. Ollama

Best scripting-first local runtime.

Why:

- simple install and stable local API
- local tool-calling support
- Anthropic-compatibility for tools that expect Claude-style APIs
- direct integrations with coding tools like Claude Code, Codex, OpenCode, Goose, Roo, and others

Sources:

- [Ollama quickstart](https://docs.ollama.com/quickstart)
- [Ollama API introduction](https://docs.ollama.com/api/introduction)
- [Ollama tool calling](https://docs.ollama.com/capabilities/tool-calling)
- [Ollama Anthropic compatibility](https://docs.ollama.com/api/anthropic-compatibility)

Why I would still keep it:

- great for automation and scripts
- great as a default local provider in a CLI-first harness
- useful even if LM Studio is your main GUI/runtime manager

### 3. vLLM

Best server-grade option, but not the first thing I would optimize for on your laptop.

Why:

- OpenAI-compatible server
- supports chat, responses, embeddings, realtime, and tool calling
- better fit for dedicated inference boxes and higher-concurrency serving

Source:

- [vLLM OpenAI-compatible server](https://docs.vllm.ai/en/latest/serving/openai_compatible_server/)

My read:

- worth designing for
- not worth making the first local runtime on Apple Silicon

### 4. Direct llama.cpp or MLX-lm

Use later if you want deeper control over quantization, packaging, or performance tuning.

Why not first:

- more moving parts
- more ops burden
- less leverage than getting the harness architecture right

## Model Shortlist For First Experiments

### Qwen3-Coder-30B-A3B-Instruct

This is the strongest recurring recommendation across the local-agent ecosystem right now.

Why it stands out:

- OpenHands recommends it directly for local coding workflows
- Cline recommends it as the default local coding model
- it is explicitly called out as strong for tool use and coding work

Sources:

- [OpenHands local LLMs](https://docs.openhands.dev/openhands/usage/llms/local-llms)
- [Cline local models overview](https://docs.cline.bot/running-models-locally/read-me-first)
- [Cline LM Studio guide](https://docs.cline.bot/running-models-locally/lm-studio)

### Devstral Small 2 (24B)

This is the other serious local-agent option called out by OpenHands.

Source:

- [OpenHands local LLMs](https://docs.openhands.dev/openhands/usage/llms/local-llms)

### Smaller coder models

Useful for:

- autocomplete
- cheap experimentation
- fast drafts

Not ideal as the main autonomous coding agent unless the task is light.

Why:

- Continue explicitly warns that model tool support in practice may not match advertised capabilities
- local-agent UX gets much worse when the model is weak at tool calling

Source:

- [Use Ollama with Continue](https://docs.continue.dev/guides/ollama-guide)

## Context Window Matters More Than People Admit

Several tools call this out directly:

- OpenHands says the default 4096 context in Ollama is too small for proper behavior and recommends at least 22000, with 32768 preferred
- OpenCode recommends at least 64k context for coding tasks when used through Ollama
- LM Studio's Codex integration docs advise using more than roughly 25k context

Sources:

- [OpenHands local LLMs](https://docs.openhands.dev/openhands/usage/llms/local-llms)
- [OpenCode with Ollama](https://docs.ollama.com/integrations/opencode)
- [Codex with LM Studio](https://lmstudio.ai/docs/integrations/codex)

Design consequence:

- your harness must treat context length as provider and model configuration, not a hidden default
- you should build prompt compaction and repo map support early

## What I Would Use On Your Machine

Default local stack:

- runtime: LM Studio
- secondary runtime: Ollama
- first agent model: Qwen3-Coder-30B-A3B-Instruct
- storage: local SSD
- context target: 32k to 64k minimum for serious coding sessions

Why:

- this is the shortest path to a credible local coding agent on Apple Silicon
- it keeps the door open to other runtimes without forcing them into v1

## Non-Obvious But Important Truth

If the goal is "use whatever models I want," the harness should support:

- local OpenAI-compatible endpoints
- Anthropic-style compatibility where useful
- explicit provider adapters for edge cases
- optional cloud fallback later

That gives you actual freedom.

Hard-coding around one runtime or one API shape would be the fastest way to accidentally recreate vendor lock-in inside your own project.
