# Architecture

## Goal

Vibe Coach is a reusable local system for turning repo context into an evolving learning experience.

The core model is:

> research is the source material, SQLite is the system of record, and the browser UI is the teaching surface

## Product Shape

Vibe Coach has two layers:

### 1. Reusable engine

The reusable engine is the open-source part.

It owns:

- database schema
- research import
- lesson and quiz persistence
- progress tracking
- comment capture
- browser UI and local API

### 2. Project context

The project context is the repo-specific part.

It owns:

- the project title and description
- where research lives
- the initial learning track metadata
- the AI adaptation blueprint
- eventually, AI-generated curriculum material

That context currently lives in [`vibe-coach.project.ts`](../vibe-coach.project.ts).

## High-Level Shape

### Research layer

Source:

- markdown files in the repo research folder defined by the project context

Responsibility:

- hold raw project research in a human-editable form
- stay readable outside the app

### Database layer

Source of truth:

- `data/vibe-coach.sqlite`

Responsibility:

- persist imported research documents
- store lessons and quiz questions
- track progress, quiz history, and learner notes

### API layer

Implementation:

- Express in [`server/index.ts`](../server/index.ts)

Responsibility:

- expose project bootstrap data
- return lesson and research content
- accept progress, comments, and quiz submissions

### UI layer

Implementation:

- React in [`src/App.tsx`](../src/App.tsx)

Responsibility:

- present a project-specific lesson path
- expose the underlying research library
- capture signals about learner understanding
- show measurable progress over time

## Schema

### `projects`

One row for the current project learning context.

### `research_documents`

Stores imported markdown research with:

- slug
- title
- summary
- category
- content
- source path
- content hash

### `learning_tracks`

Groups lessons into a coherent path.

### `lessons`

Stores:

- title and order
- stage and difficulty
- summary
- learning goals
- lesson markdown
- related research references

### `quizzes`

One quiz per lesson.

### `quiz_questions`

Stores:

- prompt
- answer options
- correct option
- explanation

### `lesson_progress`

Stores:

- status
- confidence
- quiz best score
- quiz average score
- timestamps

### `quiz_attempts`

Stores historical quiz submissions.

### `quiz_responses`

Stores per-question answer history.

### `lesson_comments`

Stores learner notes tagged by understanding state.

This is the first real personalization input.

## Why SQLite

SQLite is still the right fit because Vibe Coach should be:

- local-first
- inspectable
- solo-maintainable
- easy to back up
- easy for AI to read and patch around

This product does not need a networked database to prove its value.

## Seed Strategy

The app starts by:

1. ensuring the schema exists
2. reading project context from `vibe-coach.project.ts`
3. importing research markdown into `research_documents`
4. syncing lesson and quiz seeds
5. preserving learner-generated data like progress and comments

That gives the repo a stable engine plus a thin project-specific adaptation surface.

## Next Architectural Step

The next major upgrade is not "more UI."

It is:

- an AI research pipeline that reads a repo and writes the research docs
- a curriculum generation pipeline that drafts lessons from that research
- a revision loop that uses learner comments and quiz misses to improve later lessons
- a repo-level AI contract in [`AGENTS.md`](../AGENTS.md) that keeps those steps explicit

That is the open-source direction that makes Vibe Coach broadly useful.
