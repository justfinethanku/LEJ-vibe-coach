import { rmSync } from 'node:fs'

import { DB_PATH } from './paths.js'

rmSync(DB_PATH, { force: true })
rmSync(`${DB_PATH}-shm`, { force: true })
rmSync(`${DB_PATH}-wal`, { force: true })

await import('./sync-db.js')
