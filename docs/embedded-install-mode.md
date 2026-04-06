# Embedded Install Mode

## Goal

Vibe Coach should be dead simple to drop into an existing repo.

The intended install shape is:

- host project root
- `./.vibe-coach/` as the embedded teaching engine

That gives the host repo a repo-local learning layer without forcing a separate app workspace.

## Why Embedded Mode

This is the right shape because:

- the learning system lives next to the code it teaches
- agents can inspect the host repo and immediately write the teaching layer locally
- the team can commit the shared research and curriculum artifacts
- each developer can keep personal learning state out of git

## Path Model

In embedded mode:

- engine root: `./.vibe-coach`
- host repo root: `../` from inside the engine
- research output: `./.vibe-coach/research/...`
- local DB: `./.vibe-coach/data/vibe-coach.sqlite`

The important rule is simple:

inspect the host repo, store the learning system inside `.vibe-coach`.

## What Should Be Committed

These artifacts are meant to be shared:

- `./.vibe-coach/AGENTS.md`
- `./.vibe-coach/vibe-coach.project.ts`
- `./.vibe-coach/research/...`
- `./.vibe-coach/server/content.ts`
- `./.vibe-coach/docs/...`
- the reusable engine code

This lets another developer clone the host repo and immediately have Vibe Coach available.

## What Should Stay Local

These artifacts should stay out of git by default:

- `./.vibe-coach/data/*.sqlite`
- `./.vibe-coach/data/*.sqlite-shm`
- `./.vibe-coach/data/*.sqlite-wal`

That keeps quiz history, comments, and personal progress local to each developer.

## First-Run Flow

1. A user opens their host repo in a capable coding agent.
2. They paste the Vibe Coach bootstrap prompt.
3. The agent installs Vibe Coach into `./.vibe-coach/`.
4. The agent researches the host repo and writes the first research pack.
5. The agent drafts the initial curriculum and runs verification.
6. The user opens Vibe Coach and it is already teaching their project.

## Refresh Flow

As the host repo evolves:

1. the user pastes the refresh prompt
2. the agent inspects recent changes in the host repo
3. the research and lesson pack are updated
4. local learner state stays intact

## Product Rule

The prompt is the entrypoint.

The actual product is the repo-local Vibe Coach layer that remains behind for humans and future agents.
