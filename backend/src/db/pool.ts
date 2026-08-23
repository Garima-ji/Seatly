import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';

const isLocalPGlite = !process.env.DATABASE_URL || 
                      process.env.DATABASE_URL.includes('localhost') || 
                      process.env.DATABASE_URL.includes('local_database') ||
                      process.env.DATABASE_URL.startsWith('postgres://localhost');

let db: PGlite | null = null;
let pgPool: Pool | null = null;

if (isLocalPGlite) {
  const dbDir = path.join(process.cwd(), 'local_database');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  db = new PGlite(dbDir);
  console.log('✅ Connected to local PGlite database');
} else {
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for secure hosted DBs like Supabase / Neon
  });
  console.log('✅ Connected to remote PostgreSQL database');
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  fields?: any[];
}

function formatResult<T>(res: any): QueryResult<T> {
  const lastRes = Array.isArray(res) ? res[res.length - 1] : res;
  return {
    rows: (lastRes?.rows || []) as T[],
    rowCount: lastRes?.rowCount ?? (lastRes?.rows?.length || 0),
    fields: lastRes?.fields,
  };
}

export const pool = {
  async query<T = any>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    if (pgPool) {
      const res = await pgPool.query(text, params);
      return formatResult<T>(res);
    }

    // PGlite fallback
    const dbClient = db!;
    const trimmed = text.trim().toUpperCase();
    if (trimmed === 'BEGIN' || trimmed === 'COMMIT' || trimmed === 'ROLLBACK') {
      return { rows: [] as T[], rowCount: 0 };
    }
    if (!params || params.length === 0) {
      const results = await dbClient.exec(text);
      const last = results[results.length - 1];
      return {
        rows: (last?.rows || []) as T[],
        rowCount: last?.affectedRows ?? (last?.rows?.length || 0),
        fields: last?.fields,
      };
    }
    const res = await dbClient.query(text, (params || []) as any[]);
    return {
      rows: (res.rows || []) as T[],
      rowCount: res.affectedRows ?? res.rows.length,
      fields: res.fields,
    };
  },

  async connect() {
    if (pgPool) {
      const client = await pgPool.connect();
      return {
        async query<T = any>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
          const res = await client.query(text, params);
          return formatResult<T>(res);
        },
        release() {
          client.release();
        },
      };
    }

    // PGlite fallback
    const dbClient = db!;
    return {
      async query<T = any>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
        const trimmed = text.trim().toUpperCase();
        if (trimmed === 'BEGIN' || trimmed === 'COMMIT' || trimmed === 'ROLLBACK') {
          return { rows: [] as T[], rowCount: 0 };
        }
        if (!params || params.length === 0) {
          const results = await dbClient.exec(text);
          const last = results[results.length - 1];
          return {
            rows: (last?.rows || []) as T[],
            rowCount: last?.affectedRows ?? (last?.rows?.length || 0),
            fields: last?.fields,
          };
        }
        const res = await dbClient.query(text, (params || []) as any[]);
        return {
          rows: (res.rows || []) as T[],
          rowCount: res.affectedRows ?? res.rows.length,
          fields: res.fields,
        };
      },
      release() {},
    };
  },

  on(_event: string, _listener: (...args: any[]) => void) {},
  async end() {
    if (pgPool) {
      await pgPool.end();
    }
  },
};

/** Convenience wrapper: run a query and return rows */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export interface TxClient {
  query<R = any>(text: string, params?: unknown[]): Promise<QueryResult<R>>;
  release(): void;
}

/** Run multiple queries in a single transaction */
export async function withTransaction<T>(
  fn: (client: TxClient) => Promise<T>
): Promise<T> {
  if (pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const txClient: TxClient = {
        async query<R = any>(text: string, params?: unknown[]): Promise<QueryResult<R>> {
          const res = await client.query(text, params);
          return formatResult<R>(res);
        },
        release() {},
      };
      const result = await fn(txClient);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // PGlite fallback
  const dbClient = db!;
  return await dbClient.transaction(async (tx) => {
    const client: TxClient = {
      async query<R = any>(text: string, params?: unknown[]): Promise<QueryResult<R>> {
        const trimmed = text.trim().toUpperCase();
        if (trimmed === 'BEGIN' || trimmed === 'COMMIT' || trimmed === 'ROLLBACK') {
          return { rows: [] as R[], rowCount: 0 };
        }
        if (!params || params.length === 0) {
          const results = await tx.exec(text);
          const last = results[results.length - 1];
          return {
            rows: (last?.rows || []) as R[],
            rowCount: last?.affectedRows ?? (last?.rows?.length || 0),
            fields: last?.fields,
          };
        }
        const res = await tx.query(text, (params || []) as any[]);
        return {
          rows: (res.rows || []) as R[],
          rowCount: res.affectedRows ?? res.rows.length,
          fields: res.fields,
        };
      },
      release() {},
    };
    return await fn(client);
  });
}


