# Vibe Coach Agent Instructions

## What This Repo Is

Vibe Coach is a local-first teaching engine.

Its job is to turn repo context into:

- inspectable research
- a progressive lesson path
- quizzes and progress tracking
- learner feedback that can personalize later lessons

## Default Working Rule

Keep the engine stable. Adapt the content.

If you are adapting Vibe Coach to a new repo, prefer changing:

- `vibe-coach.project.ts`
- `research/...`
- `server/content.ts`
- docs that describe the current project context

Do not rewrite the core server or UI unless the reusable engine itself needs a capability upgrade.

## Reusable Engine Files

These are the main engine surfaces:

- `server/db.ts`
- `server/index.ts`
- `src/App.tsx`
- `src/lib/api.ts`

Treat them as product code, not per-project configuration.

## Adaptation Workflow

1. Inspect the target repo.
2. Write research markdown first.
3. Update `vibe-coach.project.ts`.
4. Draft lessons and quizzes in `server/content.ts`.
5. Run `npm run verify`.
6. Launch the app with `npm run dev` if you changed the teaching surface.

## Repo Intake Checklist

When inspecting a repo, read:

- the main README
- package manifests
- architecture or onboarding docs
- the highest-signal source directories
- deployment, workflow, or infrastructure files

Use `vibe-coach.project.ts` as the structured guide for what to inspect and what deliverables to create.

## Curriculum Rules

- Start with orientation and the core mental model.
- Move from foundations into subsystem understanding.
- Save advanced design tradeoffs for later lessons.
- Keep quizzes focused on reasoning, not rote recall.
- Tie lessons back to the research docs they came from.

## Personalization Rules

- Treat learner comments as evidence.
- Use quiz misses to identify concept gaps.
- Revise later lessons around actual confusion, not generic completeness.
- Preserve inspectability. Do not hide the teaching logic in prompts alone.

## Validation

The standard validation pass is:

- `npm run verify`

That runs:

- database sync
- lint
- production build

If the UI or API behavior changed, run the app locally and smoke-test the lesson flow.
