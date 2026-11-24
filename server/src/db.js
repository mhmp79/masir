'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

// Load server/.env first, then the repository-root .env as a fallback.
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const DEFAULT_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/masir';
const connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

const pool = new Pool({
  connectionString,
  max: Number.parseInt(process.env.PGPOOL_MAX || '10', 10) || 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ...(String(process.env.DB_SSL || '').toLowerCase() === 'true'
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
});

pool.on('error', (error) => {
  console.error('[db] idle client error:', error.message);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[db] rollback failed:', rollbackError.message);
    }
    throw error;
  } finally {
    client.release();
  }
}

const MIGRATION_NAME = '001_init.sql';
const MIGRATION_PATH = path.resolve(__dirname, '..', '..', 'sql', MIGRATION_NAME);
const SUPPLEMENTAL_MIGRATIONS = [
  {
    name: '002_advisor_invites.sql',
    path: path.resolve(__dirname, '..', 'sql', '002_advisor_invites.sql'),
  },
  {
    name: '003_password_auth.sql',
    path: path.resolve(__dirname, '..', 'sql', '003_password_auth.sql'),
  },
];

async function applyMigrationFile(name, filePath) {
  let sql;
  try {
    sql = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Migration file not found: ${filePath}`);
    }
    throw error;
  }

  if (!sql.trim()) {
    console.warn(`[db] migration ${name} is empty; nothing to do`);
    return;
  }

  const checksum = crypto.createHash('sha256').update(sql).digest('hex');
  const existing = await query(
    'SELECT 1 FROM app_migrations WHERE name = $1 AND checksum = $2',
    [name, checksum],
  );
  if (existing.rowCount > 0) {
    console.log(`[db] migration ${name} already applied`);
    return;
  }

  await withTransaction(async (client) => {
    await client.query(sql);
    await client.query(
      `INSERT INTO app_migrations (name, checksum)
       VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE
         SET checksum = EXCLUDED.checksum, applied_at = now()`,
      [name, checksum],
    );
  });
  console.log(`[db] migration ${name} applied`);
}

async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await applyMigrationFile(MIGRATION_NAME, MIGRATION_PATH);
  for (const migration of SUPPLEMENTAL_MIGRATIONS) {
    await applyMigrationFile(migration.name, migration.path);
  }
}

const columnCache = new Map();

function assertTableName(tableName) {
  if (typeof tableName !== 'string' || !/^[a-z_][a-z0-9_]*$/.test(tableName)) {
    throw new Error(`Unsafe table name: ${String(tableName)}`);
  }
  return tableName;
}

/** Map of column_name -> data_type for a table, cached for the process lifetime. */
async function getColumnInfo(tableName) {
  const table = assertTableName(tableName);
  if (!columnCache.has(table)) {
    const { rows } = await query(
      `SELECT column_name, data_type
         FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = $1`,
      [table],
    );
    columnCache.set(table, new Map(rows.map((row) => [row.column_name, row.data_type])));
  }
  return columnCache.get(table);
}

async function getColumns(tableName) {
  return new Set((await getColumnInfo(tableName)).keys());
}

/** First candidate column that actually exists in the table, or null. */
async function columnFor(tableName, candidates) {
  const columns = await getColumns(tableName);
  return candidates.find((name) => columns.has(name)) || null;
}

async function requireColumn(tableName, candidates, label) {
  const column = await columnFor(tableName, candidates);
  if (!column) {
    throw new Error(
      `Database table "${tableName}" is missing the ${label} column ` +
        `(expected one of: ${candidates.join(', ')})`,
    );
  }
  return column;
}

function clearSchemaCache() {
  columnCache.clear();
}

async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  withTransaction,
  migrate,
  getColumnInfo,
  getColumns,
  columnFor,
  requireColumn,
  clearSchemaCache,
  closePool,
  MIGRATION_PATH,
};
