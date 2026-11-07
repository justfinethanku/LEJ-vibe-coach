# Local operations

Run commands from the engine root: the checkout root for the sample app, or
`.vibe-coach` inside a host repo. Follow the [README setup](../README.md#run-this-repo)
first. Each installation uses one private learner database at
`data/vibe-coach.sqlite`, resolved relative to the engine, independent of your
shell's working directory.

## Start and stop the app

`npm run dev` starts Vite and Express together. Stop it with Ctrl+C in its
terminal. Stop any separately launched `dev:server`, `dev:client`, or `serve`
processes in their own terminals before restoring or resetting data.

| Mode | Frontend | API | Port configuration |
| --- | --- | --- | --- |
| `npm run dev` | `http://localhost:5173` by default; check Vite's output | `http://127.0.0.1:8787` through the Vite `/api` proxy | Vite can choose another frontend port if 5173 is busy. The proxy target is fixed at 8787 in `vite.config.ts`. |
| `npm run serve` after `npm run build` | `http://localhost:8787` | Same address, under `/api` | `PORT` changes Express's port. |
| `npm run preview` | Vite's build preview | No API proxy configured | Use `serve` for the complete app. |

For example, use another free port for the built app:

```bash
PORT=18787 npm run serve
```

Open `http://localhost:18787`. In development, changing only `PORT` moves the
API while leaving Vite's proxy at 8787, so leave it unset for the standard setup.
The API accepts local HTTP hostnames and origins and binds to IPv4 loopback.
Use `localhost` or `127.0.0.1`; LAN/custom hostnames and external origins fail
with HTTP 403. The app has no remote-user authentication.

## Refresh curriculum

1. Back up learner state before changing an existing curriculum.
2. Edit `vibe-coach.project.ts`, the configured research directory, and
   `server/content.ts` as needed. In embedded mode, research the host repo.
3. Run `npm run verify` from the engine root, then restart the app.
4. Check the lesson path and research library, and confirm existing progress,
   comments, and quiz history remain visible.

Startup and `db:sync` import research, update curriculum, and retire removed
content while preserving learner state. Returning content reuses its existing
rows. See [retirement and question identity](./embedded-install-mode.md#refresh-flow)
for history access and the prompt-based question identity, including reordering and
replacement behavior. `db:reset` deletes learner history; it is not a refresh
procedure for an installation whose history you want to keep.

## Back up learner state

Keep backups outside the repo because they contain private progress, comments,
and quiz answers. Git excludes the working database and its WAL/SHM sidecars,
but it does not exclude arbitrary backup filenames. The database uses SQLite
WAL mode; copying only the main file while it is active can miss recent writes.
Use the installed [SQLite backup API](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md#backupdestination-options---promise)
to create one consistent database file.

1. Stop the app to keep the backup's learner state stable.
2. Choose an unused absolute backup filename in an existing directory outside
   the repo. Replace `/ABSOLUTE/PATH/backup.sqlite` with that filename:

   ```bash
   node --input-type=module - /ABSOLUTE/PATH/backup.sqlite <<'JS'
   import Database from 'better-sqlite3'
   import { existsSync } from 'node:fs'
   const destination = process.argv[2]
   if (existsSync(destination)) throw new Error('Choose an unused backup filename.')
   const db = new Database('data/vibe-coach.sqlite', { readonly: true, fileMustExist: true })
   try {
     await db.backup(destination)
   } finally {
     db.close()
   }
   const backup = new Database(destination, { readonly: true, fileMustExist: true })
   try {
     const result = backup.pragma('integrity_check', { simple: true })
     if (result !== 'ok') throw new Error(String(result))
     console.log('Backup integrity: ok')
   } finally {
     backup.close()
   }
   JS
   ```

   Expect `Backup integrity: ok`. Keep the matching curriculum/research revision
   in Git; the database backup does not include the engine's source files.

## Restore a backup

Restoring replaces current learner state with the backup's state. Stop every
process using this installation before continuing. Use a backup whose integrity
check passed, with the matching engine and curriculum revision.

1. Move the current data directory to an unused recovery path outside the repo,
   preserving its database and any WAL/SHM files together. Replace both absolute
   paths with your recovery directory and backup file:

   ```bash
   mv data /ABSOLUTE/PATH/pre-restore-data
   mkdir data
   cp /ABSOLUTE/PATH/backup.sqlite data/vibe-coach.sqlite
   ```

2. Run `npm run db:sync`, then start the app and check your saved progress,
   comments, and quiz history. Sync reapplies the current source curriculum to
   the restored database. Keep the recovery directory until that check passes.

For a deliberately fresh learner database, stop the app, back it up, and run
`npm run db:reset`. This deletes `vibe-coach.sqlite` and its sidecars before
seeding again; it permanently removes history from the working database.

## Diagnose setup failures

| Symptom | Check and action |
| --- | --- |
| Install fails or a native `better-sqlite3` module cannot load | Check `node --version` and `npm --version` against the README. After changing Node versions, rerun `npm ci` to reinstall native dependencies. If no prebuilt binary exists for your platform, follow the package's [build troubleshooting](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md). |
| `EADDRINUSE` on 8787 | Stop the other API process you started, or choose another port for built mode. Changing `PORT` alone does not update the development proxy. |
| Page loads but bootstrap fails | Check the API terminal. Run `curl -f http://127.0.0.1:8787/api/bootstrap`; expect JSON containing lessons and research documents. Use `serve` rather than `preview` for the built app. |
| Built server returns 404 at `/` but bootstrap works | Run `npm run build` from the engine root, then restart `npm run serve`. Express only registers the frontend when `dist` exists at startup. |
| HTTP 403 from the API | Open the local HTTP URL; check Host/Origin values and avoid LAN/custom hostnames. |
| Content edits are absent | Run `npm run db:sync` and restart. HTTP reads use SQLite; editing markdown alone does not refresh the running database. |
| `npm run verify` fails | Read the first failing command: DB sync, tests, lint, or build. Sync errors can indicate missing research files or invalid curriculum. Fix that cause before retrying; reset deletes history. |

Setup and these local procedures were exercised on Ubuntu ARM64 with Node
22.22.2 and npm 10.9.7. HTTP probes covered development proxying, the built app,
custom built-server ports, and persisted synthetic learner state. Backup,
restore, and reset were checked on that synthetic database. This does not verify
other operating systems, a remote deployment, or visual browser behavior.
