import { initializeDatabase, syncSeedData } from './db.js'

initializeDatabase()
syncSeedData()

console.log('vibe-coach database synchronized.')
