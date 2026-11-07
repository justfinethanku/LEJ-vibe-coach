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

Use the [README setup](../README.md#run-this-repo) for runtime prerequisites
and commands, running them from `.vibe-coach` after installation. The bootstrap
prompt delegates research and adaptation to the coding agent; the included
course is a sample until those content files are changed.

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

Follow [Local operations](./local-operations.md#refresh-curriculum) for backups.
Startup and `npm run db:sync` upgrade existing databases in place and mark missing
lessons, research documents, and quiz questions with `retired_at`. They never
delete those rows. Returning content clears retirement and reuses the same IDs.
Retired content is excluded from navigation, bootstrap lists, related research,
and new quiz scoring. Direct lesson and research detail reads remain available
by slug, including retained progress, comments, and recent attempts. Historical
attempts and responses remain inspectable in SQLite, including joins to retired
questions. Historical scores and totals are not recalculated.

### Question identity

Within a quiz (identified by lesson slug), a question keeps its ID while its
prompt, ordered answer options, and correct answer are unchanged. Changing any
of those fields creates a new question and retires the old one, preserving the
original choices and answer key alongside historical responses. Reordering whole
questions only changes display positions. Returning to the exact earlier grading
content reactivates its existing row. Duplicate questions with identical grading
content match distinct rows in ascending ID order, once per seed occurrence.

Explanations can improve in place without changing question IDs. Past scores,
selected answers, correctness, and totals are not recalculated. Changes already
made in place by an earlier engine version cannot be reconstructed automatically.

A page opened before a grading change cannot submit the retired question IDs.
For interrupted saves or refreshes, use the
[recovery runbook](./curriculum-recovery.md) before retrying or reloading.
If submission says the quiz may have changed, reload the lesson, review the new
questions, and answer them again. Rejection does not save an attempt or change
progress. Quiz validation and writes use one database transaction, and a failed
note-progress update rolls back the note too.

Do not reset a database whose learner history you want to preserve.

## Product Rule

The prompt is the entrypoint.

The actual product is the repo-local Vibe Coach layer that remains behind for humans and future agents.
