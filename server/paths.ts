import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { EMBEDDED_INSTALL, PROJECT_CONTEXT } from '../vibe-coach.project.js'

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url))

export const APP_ROOT = resolve(CURRENT_DIR, '..')
export const DATA_DIR = resolve(APP_ROOT, 'data')
export const DIST_DIR = resolve(APP_ROOT, 'dist')
export const DB_PATH = resolve(DATA_DIR, 'vibe-coach.sqlite')
export const HOST_REPO_ROOT = resolve(
  APP_ROOT,
  EMBEDDED_INSTALL.hostRepositoryRootRelativePath,
)
export const RESEARCH_DIR = resolve(APP_ROOT, ...PROJECT_CONTEXT.researchDirectory)
