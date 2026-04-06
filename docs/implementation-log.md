# Implementation Log

## 2026-04-06

### Prototype foundation

Built the first working local app with:

- research import into SQLite
- lesson and quiz storage
- progress tracking
- learner comments
- a browser UI for reading, testing, and reflecting

### Product direction update

Reframed the prototype as **Vibe Coach**:

> The educational platform that teaches you while you build.

That changed the intent of the repo from:

- a one-off harness study guide

to:

- an open-source schema for repo research, onboarding, and personalized learning

### Structural changes

- Added [`vibe-coach.project.ts`](../vibe-coach.project.ts) as the repo-specific adaptation surface.
- Moved database naming toward the product with `data/vibe-coach.sqlite`.
- Updated the UI branding to `Vibe Coach`.
- Rewrote docs around reusability and AI-assisted adaptation.

### Why this matters

The important shift is architectural:

- the app engine should stay reusable
- the project context should be thin and rewriteable
- an AI should be able to adapt this repo to a new codebase quickly

### Immediate next steps

- add a repo research pipeline
- add a curriculum generation pipeline
- add learner-profile and concept-gap views
- make the lesson seed process easier for AI to rewrite automatically

### Clean repo bootstrap

- Moved the working prototype into its own clean git repository.
- Pulled the example research pack into the repo so the app is self-contained.
- Fixed runtime pathing so research imports resolve from the repo root.
- Replaced machine-specific doc links with repo-relative links.

### Reuse logistics

- Added a `verify` script so AI or humans can validate the baseline in one command.
- Added a repo-level `AGENTS.md` contract for future AI adaptation work.
- Expanded [`vibe-coach.project.ts`](../vibe-coach.project.ts) with an explicit adaptation blueprint.
- Added a full automation loop doc to keep the next product phase grounded.
