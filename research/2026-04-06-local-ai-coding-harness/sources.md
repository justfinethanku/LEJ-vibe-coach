# Sources

Research date: 2026-04-06

This pack leans on official or project-maintained docs wherever possible.

## Coding Agent Products

- Claude Code overview: https://docs.anthropic.com/en/docs/claude-code/overview
- OpenCode agents: https://opencode.ai/docs/agents/
- OpenCode models: https://opencode.ai/docs/models/
- OpenCode permissions: https://opencode.ai/docs/permissions/
- OpenCode LSP: https://opencode.ai/docs/lsp/
- Continue offline guide: https://docs.continue.dev/guides/running-continue-without-internet
- Continue Ollama guide: https://docs.continue.dev/guides/ollama-guide
- Aider git integration: https://aider.chat/docs/git.html
- Aider repo map article: https://aider.chat/2023/10/22/repomap.html
- Cline overview: https://docs.cline.bot/introduction/overview
- Cline auto approve: https://docs.cline.bot/features/auto-approve
- Cline subagents: https://docs.cline.bot/features/subagents
- Cline local models overview: https://docs.cline.bot/running-models-locally/read-me-first
- Cline LM Studio guide: https://docs.cline.bot/running-models-locally/lm-studio
- Goose providers: https://block.github.io/goose/docs/getting-started/providers
- Goose logs: https://block.github.io/goose/docs/guides/logs/
- Goose sessions: https://block.github.io/goose/docs/guides/sessions/
- Goose subagents: https://block.github.io/goose/docs/guides/subagents/
- OpenHands local LLMs: https://docs.openhands.dev/openhands/usage/llms/local-llms
- OpenHands evaluation harness: https://docs.openhands.dev/openhands/usage/developers/evaluation-harness

## Local Model Runtimes

- LM Studio docs home: https://lmstudio.ai/docs
- LM Studio local API server: https://lmstudio.ai/docs/developer/core/server
- LM Studio headless service: https://lmstudio.ai/docs/api/headless
- LM Studio MCP host docs: https://lmstudio.ai/docs/app/plugins/mcp/
- LM Studio MCP via API: https://lmstudio.ai/docs/developer/core/mcp
- LM Studio MLX announcement: https://lmstudio.ai/mlx
- LM Studio Codex integration: https://lmstudio.ai/docs/integrations/codex
- Ollama quickstart: https://docs.ollama.com/quickstart
- Ollama API introduction: https://docs.ollama.com/api/introduction
- Ollama tool calling: https://docs.ollama.com/capabilities/tool-calling
- Ollama Anthropic compatibility: https://docs.ollama.com/api/anthropic-compatibility
- Ollama OpenCode integration: https://docs.ollama.com/integrations/opencode
- vLLM OpenAI-compatible server: https://docs.vllm.ai/en/latest/serving/openai_compatible_server/

## Protocol And Architecture

- Model Context Protocol architecture: https://modelcontextprotocol.io/specification/2024-11-05/architecture/index

## Notes

- A few findings in the writeup are explicit inference rather than direct claims from the docs. Those are labeled as inference in the relevant files.
- The most important recurring pattern across the sources is this: the model runtime is only one part of the system. Tool policy, context control, logging, and evaluation are what make the harness usable.
