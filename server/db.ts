import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'

import {
  LEARNING_TRACK_SEED,
  LESSON_SEEDS,
  PROJECT_SEED,
  RESEARCH_METADATA_BY_FILE,
} from './content.js'
import { DATA_DIR, DB_PATH, RESEARCH_DIR } from './paths.js'
import { createCoachStore } from './store.js'

// Default local runtime. Reusable persistence lives in store.ts and receives
// its connection and curriculum explicitly.
mkdirSync(DATA_DIR, { recursive: true })
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

export const {
  initializeDatabase,
  syncSeedData,
  getBootstrapData,
  getLessonDetail,
  getResearchDocumentDetail,
  updateLessonProgress,
  addLessonComment,
  submitQuizAnswers,
} = createCoachStore(db, {
  project: PROJECT_SEED,
  track: LEARNING_TRACK_SEED,
  lessons: LESSON_SEEDS,
  researchDirectory: RESEARCH_DIR,
  researchMetadata: RESEARCH_METADATA_BY_FILE,
})
