import pgPool from '@/lib/pg';

export interface Customer {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string;
}

/**
 * CustomerRepository — raw SQL queries only, no business logic.
 */
export class CustomerRepository {
  /**
   * Search customers by first_name, last_name, phone_number, or order_id.
   * A single query with a JOIN handles all four search cases.
   */
  public async search(query: string): Promise<Customer[]> {
    const sql = `
      SELECT DISTINCT c.id, c.first_name, c.last_name, c.phone_number
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      WHERE
        c.first_name   ILIKE $1 OR
        c.last_name    ILIKE $1 OR
        c.phone_number ILIKE $1 OR
        CAST(o.order_id AS TEXT) = $2
      ORDER BY c.last_name, c.first_name
    `;
    const { rows } = await pgPool.query<Customer>(sql, [`%${query}%`, query]);
    return rows;
  }

  /**
   * List every customer (used mainly in tests / admin view).
   */
  public async findAll(): Promise<Customer[]> {
    const { rows } = await pgPool.query<Customer>(
      'SELECT id, first_name, last_name, phone_number FROM customers ORDER BY last_name, first_name'
    );
    return rows;
  }

  /**
   * Find a single customer by primary key.
   */
  public async findById(id: number): Promise<Customer | null> {
    const { rows } = await pgPool.query<Customer>(
      'SELECT id, first_name, last_name, phone_number FROM customers WHERE id = $1',
      [id]
    );
    return rows[0] ?? null;
  }
}

export default new CustomerRepository();
