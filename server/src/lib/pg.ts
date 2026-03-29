import 'dotenv/config';
import { Pool } from 'pg';

/**
 * PostgreSQL connection pool using POSTGRES_DATABASE_URL.
 * Used exclusively by the customers/orders assignment module.
 * Kept separate from the main Prisma (MongoDB) client.
 */
const pgPool = new Pool({
  connectionString: process.env.POSTGRES_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pgPool.on('error', (err) => {
  console.error('[pg] Unexpected pool error:', err);
});

export default pgPool;
