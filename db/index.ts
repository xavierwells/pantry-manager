import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function getDb() {
  if (!env.DB) {
    throw new Error(
      'Cloudflare D1 binding `DB` is unavailable. Configure a D1 database named `DB` before using synchronized storage.',
    );
  }

  return drizzle(env.DB, { schema });
}

let schemaReady: Promise<unknown> | null = null;

export function ensureSchema() {
  if (!env.DB) throw new Error('Cloudflare D1 binding `DB` is unavailable.');
  schemaReady ??= env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS grocery_lists (
      user_id TEXT PRIMARY KEY NOT NULL,
      items_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS recipe_books (
      user_id TEXT PRIMARY KEY NOT NULL,
      recipes_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
  ]);
  return schemaReady;
}
