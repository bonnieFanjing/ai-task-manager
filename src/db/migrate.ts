import { openDatabase } from './connection.js';
import { runMigrations } from './migrations.js';

const db = openDatabase();
const applied = runMigrations(db);
db.close();

if (applied.length === 0) {
  console.log('Database is already up to date.');
} else {
  console.log(`Applied migrations: ${applied.join(', ')}`);
}

