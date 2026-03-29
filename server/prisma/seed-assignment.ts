/**
 * seed-assignment.ts
 *
 * Creates the customers + orders tables and seeds them with realistic data.
 * Run with: npx tsx prisma/seed-assignment.ts
 *
 * Uses POSTGRES_DATABASE_URL from .env
 */
import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function createTables(client: Awaited<ReturnType<typeof pool.connect>>) {
  console.log('📦  Creating tables...');

  await client.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id           SERIAL PRIMARY KEY,
      first_name   VARCHAR(100) NOT NULL,
      last_name    VARCHAR(100) NOT NULL,
      phone_number VARCHAR(20)  NOT NULL UNIQUE
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS orders (
      order_id    SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE
    );
  `);

  console.log('✅  Tables ready.');
}

async function seedCustomers(client: Awaited<ReturnType<typeof pool.connect>>): Promise<number[]> {
  console.log('🌱  Seeding 10 customers...');

  // Clear existing seed data (idempotent re-runs)
  await client.query('DELETE FROM orders');
  await client.query('DELETE FROM customers');
  await client.query('ALTER SEQUENCE customers_id_seq RESTART WITH 1');
  await client.query('ALTER SEQUENCE orders_order_id_seq RESTART WITH 1');

  const customers = [
    ['Amit',    'Patel',  '+91-98765-11001'],
    ['Jayas',   'Patel',  '+91-98765-11002'],
    ['Ramesh',  'Patel',  '+91-98765-11003'],
    ['Priya',   'Shah',   '+91-98765-11004'],
    ['Rahul',   'Shah',   '+91-98765-11005'],
    ['Neha',    'Kumar',  '+91-98765-11006'],
    ['Vikram',  'Kumar',  '+91-98765-11007'],
    ['Sunita',  'Mehta',  '+91-98765-11008'],
    ['Arjun',   'Gupta',  '+91-98765-11009'],
    ['Divya',   'Sharma', '+91-98765-11010'],
  ];

  const ids: number[] = [];

  for (const [first_name, last_name, phone_number] of customers) {
    const { rows } = await client.query<{ id: number }>(
      'INSERT INTO customers (first_name, last_name, phone_number) VALUES ($1, $2, $3) RETURNING id',
      [first_name, last_name, phone_number]
    );
    ids.push(rows[0].id);
  }

  console.log(`✅  Inserted ${ids.length} customers.`);
  return ids;
}

async function seedOrders(client: Awaited<ReturnType<typeof pool.connect>>, customerIds: number[]) {
  console.log('🌱  Seeding 22 orders (min 2 per customer)...');

  // 2 orders per customer = 20, plus 2 extras for customers[0] and customers[2]
  const assignments: number[] = [
    ...customerIds,       // 1 order each (10 orders)
    ...customerIds,       // 2nd order each (20 orders)
    customerIds[0],       // extra order for Amit Patel  (21)
    customerIds[2],       // extra order for Ramesh Patel (22)
  ];

  for (const customerId of assignments) {
    await client.query(
      'INSERT INTO orders (customer_id) VALUES ($1)',
      [customerId]
    );
  }

  console.log(`✅  Inserted ${assignments.length} orders.`);
}

async function main() {
  const client = await pool.connect();
  try {
    await createTables(client);
    const customerIds = await seedCustomers(client);
    await seedOrders(client, customerIds);
    console.log('\n🎉  Database seeded successfully!\n');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
