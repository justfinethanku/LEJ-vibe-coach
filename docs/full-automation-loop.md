# Full Automation Loop

## Goal

Make Vibe Coach easy to drop into any repo and useful from the first pass.

The full automation loop should do four things well:

1. inspect a repo
2. turn that inspection into research
3. turn research into a lesson path
4. revise the lesson path using learner signals

The intended entrypoint is a single pasted prompt to a capable coding agent.

## The Right Product Shape

This is not a generic chat app.

It is a local knowledge and curriculum engine with:

- a repo inspection phase
- a research artifact layer
- a curriculum layer
- a learner feedback loop
- an embedded install shape at `./.vibe-coach/`

## Phase 1: Repo Intake

In the default product shape, the engine lives in `./.vibe-coach/` and the host repo is the project being inspected.

Inputs:

- README and docs
- package manifests
- source directories
- deployment or workflow files
- optional issue tracker or roadmap context

Outputs:

- a project map
- a list of high-friction concepts
- a list of workflows that matter for onboarding

The rule here is simple:

research before curriculum.

## Phase 2: Research Generation

The agent writes markdown into `research/...`.

Each research pass should produce:

- an orientation doc
- a product and architecture overview
- a tooling and runtime explainer
- a workflow or operations explainer
- a roadmap and risk memo
- a source ledger

Why markdown first:

- humans can inspect it
- AI can patch it safely
- diffs stay understandable
- the database can be rebuilt from source material

## Phase 3: Curriculum Drafting

The agent updates:

- `vibe-coach.project.ts`
- `server/content.ts`

The lesson path should:

- start with the mental model
- move into subsystem literacy
- expose the actual workflows that matter
- end with advanced architecture or operational tradeoffs

## Phase 4: Learning Runtime

The app imports the research into SQLite and tracks:

- lesson progress
- quiz history
- learner comments
- confidence signals

This is the current working product boundary.

## Phase 5: Personalization Loop

The next useful automation layer is not “AI magic.”

It is a measured revision loop driven by:

- repeated quiz misses
- comments marked `confused`
- requests for examples
- requests for more depth

Those signals should feed lesson revisions, deeper examples, and follow-up content.

## What Should Stay Explicit

Keep these visible in the repo:

- the project context
- the research artifacts
- the lesson seed content
- the validation commands
- the personalization signals

If adaptation becomes opaque, Vibe Coach stops being trustworthy.

## Near-Term Build Plan

1. Keep the repo-level AI contract sharp with `AGENTS.md`.
2. Keep `vibe-coach.project.ts` as the structured adaptation blueprint.
3. Add better curriculum generation inputs when the seed file becomes too large.
4. Add learner-profile and concept-gap views before attempting autonomous lesson rewrites.
5. Add repo-ingestion automation only after the research and validation loop are stable.

## Acceptance Criteria

The automation loop is good enough when:

- an AI can adapt Vibe Coach to a new repo without rewriting the engine
- the research is readable and useful on its own
- the first lesson path teaches the real project, not generic software ideas
- learner comments and quiz results point clearly to what should be improved next
