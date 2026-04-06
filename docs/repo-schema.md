# Repo Schema

## Purpose

This repo should be easy for an AI to adapt to a user’s context.

That means the repo needs a small number of explicit, high-leverage files.

## Required Surfaces

### `vibe-coach.project.ts`

This is the main adaptation file.

An AI should update it with:

- project slug
- project title
- project description
- research directory
- learning track metadata

### `research/...`

This is where AI-generated or human-written research should live before import.

Why markdown first:

- easy for humans to inspect
- easy for AI to patch
- easy to diff

### `server/content.ts`

This currently stores lesson and quiz seeds.

For now, an AI can edit this directly.

Later, this should become an output artifact from a curriculum generation step.

### `server/db.ts`

This is the system-of-record layer.

An AI should treat it as the contract for:

- research import
- curriculum persistence
- learner progress
- personalization signals

## AI Adaptation Workflow

For a new repo, the AI should:

1. inspect the repo structure, docs, package manifests, and key source files
2. write research markdown into a project-specific research folder
3. update `vibe-coach.project.ts`
4. draft lessons and quizzes in `server/content.ts` or a future generator input
5. run `npm run db:sync`
6. verify the app locally

## Design Rule

The AI should not have to redesign the app for every new repo.

It should mainly need to change:

- project context
- research content
- curriculum content

That is the point of the schema.
