Install Vibe Coach into the current repository and leave it fully set up.

Use this GitHub repo as the source:

- `https://github.com/justfinethanku/LEJ-vibe-coach.git`

Treat the current working directory as the host repo.

Your job:

1. Install Vibe Coach into `./.vibe-coach/` in this repo.
2. Do not leave a nested git repository inside `./.vibe-coach/`.
3. Treat `./.vibe-coach/` as the engine root and the current repo root as the project being taught.
4. Read `./.vibe-coach/AGENTS.md` after install and follow it.
5. Rewrite `./.vibe-coach/vibe-coach.project.ts` for this repo.
6. Inspect the host repo, not `./.vibe-coach`, and write a project-specific research pack into `./.vibe-coach/research/<date>-<repo-slug>/`.
7. Rewrite `./.vibe-coach/server/content.ts` so the lesson plan and quizzes teach this actual repo.
8. Run `npm install` inside `./.vibe-coach/`.
9. Run `npm run verify` inside `./.vibe-coach/`.
10. Start the app with `npm run dev` inside `./.vibe-coach/`.

Rules:

- Do not ask me follow-up questions unless you are truly blocked.
- Make reasonable assumptions and move.
- Keep the reusable engine intact unless the engine itself must change.
- Keep learner-state files local and uncommitted.
- Make the result something future agents can resume from.

When you finish:

- tell me the Vibe Coach URL
- tell me the main research folder you created
- summarize the project learning path you generated
