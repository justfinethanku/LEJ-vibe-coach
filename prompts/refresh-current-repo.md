Refresh the Vibe Coach installation in the current repository.

Assume Vibe Coach already exists at:

- `./.vibe-coach/`

Treat the current working directory as the host repo and `./.vibe-coach/` as the embedded learning engine.

Your job:

1. Read `./.vibe-coach/AGENTS.md` and `./.vibe-coach/vibe-coach.project.ts`.
2. Inspect the host repo for meaningful changes since the current Vibe Coach research pack was written.
3. Update or extend the research documents in `./.vibe-coach/research/...`.
4. Update `./.vibe-coach/server/content.ts` so the curriculum reflects the current project state.
5. Preserve local learner state, comments, and quiz history.
6. Run `npm run verify` inside `./.vibe-coach/`.
7. Start or restart the app with `npm run dev` inside `./.vibe-coach/`.

Rules:

- Do not rebuild Vibe Coach from scratch.
- Do not wipe learner-state files.
- Prefer targeted curriculum changes over broad rewrites.
- Keep the research and lessons inspectable.

When you finish:

- tell me what changed in the research
- tell me what changed in the lesson path
- tell me the Vibe Coach URL
