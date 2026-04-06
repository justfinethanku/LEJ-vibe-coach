# Vibe Coach

The educational platform that teaches you while you build.

Vibe Coach is a local-first open-source schema for turning repo context into:

- structured research
- a project-specific lesson path
- quizzes and progress tracking
- learner comments that personalize future lessons

The current seeded example in this repo is the `Local AI Coding Harness` project, but the codebase is now organized so an AI can adapt it to a different repo quickly.

## Quick Start

1. Install dependencies with `npm install`.
2. Seed the local SQLite database with `npm run db:sync`.
3. Start the app with `npm run dev`.
4. Open `http://localhost:5173` in the browser.

## Core Product Idea

Drop Vibe Coach into a repo.

Then an AI should be able to:

1. inspect the repo, docs, and project context
2. write research into markdown and import it into SQLite
3. generate a progressive lesson plan based on that research
4. collect learner notes and quiz performance
5. refine future lessons around what the learner still does not understand

That makes it useful for:

- onboarding new engineers or collaborators
- learning unfamiliar domains while building
- starting greenfield projects outside your comfort zone
- preserving the reasoning behind a project as it evolves

## Repo Shape

This repo is meant to become a reusable schema, not just a single curriculum.

The adaptation surface is:

- [`vibe-coach.project.ts`](./vibe-coach.project.ts)
  The project context file an AI should rewrite for a new repo.
- [`server/content.ts`](./server/content.ts)
  The current lesson and quiz seed definitions.
- [`server/db.ts`](./server/db.ts)
  The import, persistence, progress, and personalization storage layer.
- [`docs/repo-schema.md`](./docs/repo-schema.md)
  The repo contract for reuse.
- [`docs/ai-builder-playbook.md`](./docs/ai-builder-playbook.md)
  The step-by-step instructions an AI should follow when adapting Vibe Coach to a user’s repo.

## Current Stack

- React + Vite for the browser UI
- Express for the local API
- `better-sqlite3` for the database
- Markdown as the human-editable source material

Why this stack:

- local-first
- inspectable
- easy for one person to operate
- easy for AI to patch without a lot of framework ceremony

## Current Runtime Files

- App code: [`src`](./src)
- Server and DB bootstrap: [`server`](./server)
- Project context config: [`vibe-coach.project.ts`](./vibe-coach.project.ts)
- Example research pack: [`research/2026-04-06-local-ai-coding-harness`](./research/2026-04-06-local-ai-coding-harness)
- SQLite database path: `data/vibe-coach.sqlite`
- Architecture notes: [`docs/architecture.md`](./docs/architecture.md)
- Implementation log: [`docs/implementation-log.md`](./docs/implementation-log.md)
- Open-source product direction: [`docs/product-vision.md`](./docs/product-vision.md)
- Roadmap: [`docs/open-source-roadmap.md`](./docs/open-source-roadmap.md)

## Scripts

- `npm run dev`
  Starts the Vite frontend and Express API together.
- `npm run build`
  Type-checks and builds the frontend.
- `npm run serve`
  Serves the built frontend through the Express app.
- `npm run db:sync`
  Synchronizes the SQLite database with the current research and lesson content.
- `npm run db:reset`
  Deletes the SQLite file and recreates it from seed data.

## What Is Already Working

- Research browsing
- Progressive lesson navigation
- Quiz scoring and history
- Confidence and completion tracking
- Lesson comments as teaching signals

## What Is Not Automated Yet

V1 does not yet automatically:

- research a repo on its own
- generate lesson seeds from research without code changes
- rewrite future lessons from comments

What it does do is put the right system boundaries in place so those features can be added without redesigning the whole app.
