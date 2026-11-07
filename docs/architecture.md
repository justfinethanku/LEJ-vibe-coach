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

- hold raw project research source material in a human-editable form
- stay readable outside the app
- give agents and humans something easy to diff and rewrite

This layer is source material, not the runtime memory system.

### Database layer

Source of truth:

- `data/vibe-coach.sqlite`

Responsibility:

- persist imported research documents
- store lessons and quiz questions
- track progress, quiz history, and learner notes
- act as the actual runtime state layer for the learning system

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

## Runtime boundaries and data flow

| Layer | Inputs | Output and side effects |
| --- | --- | --- |
| Project adaptation | `vibe-coach.project.ts`, `server/content.ts`, research markdown | Inspectable project, track, lesson and quiz seeds |
| Local runtime setup | `server/db.ts`, paths from `server/paths.ts` | Opens the local SQLite connection with WAL and supplies the project inputs to the store |
| Reusable store | `createCoachStore(connection, options)` in `server/store.ts` | Schema, research import, curriculum sync, queries and learner writes on the supplied connection |
| HTTP API | `server/index.ts` | Initializes and syncs the default store, checks the local request boundary, validates writes and returns JSON |
| Browser | `src/lib/api.ts`, `src/lib/types.ts`, `src/App.tsx` | Fetches bootstrap/details, renders lessons and research, submits learner signals |

`server/store.ts` has no runtime dependency on the sample curriculum or default
paths. Importing it opens no database and reads no research. The caller supplies
a SQLite connection and the project, track, lessons, research directory and
research metadata. The caller also owns closing that connection. Each connection
holds one project and one learner; multiple stores use separate connections and
research directories, rather than sharing one database between projects.

The existing server and database CLI commands use `server/db.ts` as their local
setup module. Startup and `db:sync` explicitly initialize the schema and run the
seed transaction. The transaction imports research, updates current curriculum,
and retires removed content while preserving progress, comments and quiz history.
Dashboard quiz averages and attempt counts cover active lessons only. Request handlers then read from
SQLite; they do not reread markdown for each request. Quiz submissions write the
attempt, responses and progress aggregates in one transaction.

`tests/store.test.ts` exercises independent stores, refresh/reopen preservation,
quiz scoring and rollback after a failed research import. The HTTP tests exercise
the default local setup through real server processes. Run both with `npm test`.

## Browser state ownership

[`src/App.tsx`](../src/App.tsx) owns project/dashboard data, navigation, and the
research view. Dashboard requests carry a sequence number; a late older read
cannot overwrite a newer dashboard. Unmounted app instances discard their reads.

[`src/LessonWorkspace.tsx`](../src/LessonWorkspace.tsx) owns one lesson visit:
its detail, progress draft, note draft, quiz answers/result, pending mutation,
and feedback. App keys the component by lesson slug. Navigating to another lesson
ends the visit; late responses cannot publish into the new lesson, including a
later visit to the original slug. Opening research hides the existing workspace
without ending its visit, preserving drafts and restoring heading focus on return.

One pending mutation serializes progress, note, and quiz writes within a visit.
Progress and note responses already contain updated lesson detail, so the UI
uses that response directly. Quiz results are retained before fetching updated
lesson detail. A failed follow-up read reports the acknowledged save separately
from the refresh failure. It does not turn a successful write into a failed save.
Edits made while a save is pending remain drafts. Refreshed question IDs/options
invalidate old quiz selections and feedback while preserving the note draft.

[`tests/client.test.ts`](../tests/client.test.ts) renders the real app in JSDOM
with delayed transport responses and an isolated SQLite store. It checks navigation
races, same-slug return visits, draft edits during writes, failed refreshes,
changed grading, focus, mutation ownership, and the normal learner flow. Run it
with `npm test`; the production build validates CSS imports separately. These tests
do not measure rendered layout or human screen-reader speech.

Unsent drafts live in memory and are discarded when leaving a lesson or reloading
the page. A write whose HTTP acknowledgment is lost still has an unknown outcome;
this design does not provide server-side replay deduplication.

## Schema

### `projects`

One row for the current project learning context.

### `research_documents`

Stores research imported from markdown source files with:

- slug
- title
- summary
- category
- content
- source path
- content hash
- `retired_at` (nullable; retired documents stay readable by slug)

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
- `retired_at` (nullable; retired lessons retain progress, comments, and attempts)

### `quizzes`

One quiz per lesson.

### `quiz_questions`

Stores:

- prompt
- answer options
- correct option
- explanation
- `retired_at` (nullable; retired questions retain their text and responses)

Questions match by prompt, ordered options, and correct answer within a quiz,
independent of question display order. A grading change creates a new row so stale
submissions cannot be scored against it. Explanation-only edits retain identity.
Sync temporarily assigns negative `order_index` values before restoring active
questions to positive positions; retired rows preserve their text, choices, answer
keys, and responses. Exact returning versions reuse their IDs. Identical duplicates
match once per seed occurrence in ascending ID order.
See [question identity](./embedded-install-mode.md#question-identity).

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
