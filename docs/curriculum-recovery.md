# Recover curriculum and learner state

Use this runbook after a stopped curriculum refresh, an interrupted save, or a
quiz rejection following content changes. Run commands from the engine root
with the [installed dependencies](../README.md#run-this-repo). Each installation
has its own `data/vibe-coach.sqlite`.

## Preserve the state before recovery

1. Copy unsent notes and intended progress changes somewhere private before
   reloading or navigating to another lesson. Drafts live only in browser memory.
   Opening research and returning retains the current lesson draft; selecting
   another lesson or reloading discards it.
2. Stop every server and database command using this installation. Keep the
   database and its `-wal` and `-shm` files together. Do not delete sidecars to
   clear a lock: [SQLite's WAL can contain committed learner writes](https://www.sqlite.org/wal.html#the_wal_file).
3. Record the engine, curriculum, and research revision, including uncommitted
   content edits. Preserve those files before changing them. Starting the server,
   `db:sync`, and the first stage of `verify` all apply the current source content
   to the database; they are not inspection commands.

## Inspect saved state without syncing

Run this check before starting the app again. Replace `LESSON_SLUG` with the
affected lesson's slug from the curriculum. The command opens the existing
database read-only, checks its structure and foreign keys, and prints saved state
for that lesson, including retired lessons. Output contains private notes; keep
it local. The latest 20 notes and attempts are shown, ordered by ID.

```bash
node --input-type=module - LESSON_SLUG <<'JS'
import Database from 'better-sqlite3'
const slug = process.argv[2]
const db = new Database('data/vibe-coach.sqlite', { readonly: true, fileMustExist: true })
try {
  const integrity = db.pragma('integrity_check')
  const foreignKeys = db.pragma('foreign_key_check')
  if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok' || foreignKeys.length) {
    console.error({ integrity, foreignKeys })
    throw new Error('Database checks failed. Preserve the data directory before recovery.')
  }
  console.log('Database checks: ok')
  console.log('Project:', db.prepare('SELECT slug, title FROM projects').all())
  console.log('Lesson:', db.prepare(`
    SELECT l.id, l.slug, l.title, l.retired_at, p.status, p.confidence,
      p.quiz_best, p.quiz_average, p.updated_at
    FROM lessons l LEFT JOIN lesson_progress p ON p.lesson_id = l.id
    WHERE l.slug = ?
  `).all(slug))
  console.log('Notes:', db.prepare(`
    SELECT c.id, c.created_at, c.body, c.understanding_state
    FROM lesson_comments c JOIN lessons l ON l.id = c.lesson_id
    WHERE l.slug = ? ORDER BY c.id DESC LIMIT 20
  `).all(slug))
  console.log('Attempts:', db.prepare(`
    SELECT a.id, a.created_at, a.score, a.total_questions
    FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
    JOIN lessons l ON l.id = q.lesson_id
    WHERE l.slug = ? ORDER BY a.id DESC LIMIT 20
  `).all(slug))
} finally {
  db.close()
}
JS
```

Expect `Database checks: ok`. Empty lesson results mean the slug is absent;
check the spelling and installation path before concluding that progress is
missing. These checks do not prove that every intended save occurred. Compare
the notes, attempt IDs/times, and progress with what you submitted. The app shows
only five recent attempts; older attempts remain in SQLite.

If the file cannot open, check the engine path, permissions, and other processes.
If either database check fails, preserve the entire stopped data directory and
use a known-good [backup and matching source revision](./local-operations.md#restore-a-backup).
Do not reset the database as a repair. Restoring a backup loses newer working
state unless you retain its recovery copy.

## Resume an interrupted refresh

1. After successful inspection, [back up the database](./local-operations.md#back-up-learner-state)
   before retrying. If you suspect file damage, preserve the original data
   directory before opening or backing it up.
2. Review the intended `vibe-coach.project.ts`, `server/content.ts`, and configured
   research files as one content revision. Fix the reported source error, or
   restore those files from your preserved known-good revision. Restoring only
   a database will not undo the source content applied by the next sync.
3. Run `npm run db:sync`. Expect `vibe-coach database synchronized.`. A stopped
   process might have committed before its output was lost. The seed transaction
   applies the complete content refresh or rolls it back; retrying the same
   revision preserves learner rows and grading identities. Schema initialization
   runs separately and can already have added columns or indexes.
4. Run `npm run verify`, then restart the app. In built mode, `verify` also builds
   the frontend. Review the current lesson path and the affected lesson's saved
   notes, progress, and quiz history before discarding the recovery copy.

Removed lessons and research disappear from navigation but remain readable by
their direct API slugs: `/api/lessons/LESSON_SLUG` and
`/api/research/RESEARCH_SLUG` on the local API. A retired lesson has no current
quiz questions. Existing attempts, responses, and progress remain stored.
An empty lesson seed list or research directory can successfully retire all
corresponding content; a successful sync is not proof that you chose the intended
revision. Restore the intended source and sync again to reactivate it. See
[retirement and question identity](./embedded-install-mode.md#refresh-flow).

## Resolve an interrupted learner save

| What you observed | Recovery |
| --- | --- |
| `Note saved.`, `Progress saved.`, or a quiz score followed by `Dashboard refresh failed` or `Lesson refresh failed` | The write was acknowledged. Preserve any newer draft, reload to refresh the reads, and do not submit the saved note or quiz again. |
| A disconnected request, generic request error, or stopped server before a reply | The outcome is unknown. Inspect saved state before retrying. A committed note or attempt can remain even when its reply never arrived. |
| `The quiz may have changed; reload the lesson before retrying.` | The stale submission was rejected without saving an attempt. Preserve unsent notes, reload the lesson, review the new grading version, and answer every question again. |
| `database is locked` or `SQLITE_BUSY` during competing local work | Stop the competing process you own, preserve drafts, and inspect saved state before retrying. Keep WAL/SHM files in place. |

Note insertion and its progress update share a transaction. Quiz validation,
attempt, responses, and progress aggregates also share a transaction. A process
stopped before commit leaves none of that operation's changes after reopen; a
process stopped after commit can leave the whole operation saved. The HTTP layer
does not deduplicate replayed notes or quiz submissions. If the visible history
cannot establish whether a particular request saved, preserve the evidence and
resolve that uncertainty before replaying it.

## Verification boundary

These procedures were exercised on Ubuntu ARM64 with Node 22.22.2 and synthetic
learner databases. Separate writer processes were killed during curriculum,
note, and quiz transactions and reopened before retry. Local HTTP probes dropped
successful note and quiz replies and inspected the committed state before restart.
The inspection command was also checked against a missing database and an orphaned
foreign key. These checks do not simulate power loss, disk damage, or a browser's
network stack, and do not establish recovery on other operating systems.
