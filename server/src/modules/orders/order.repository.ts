import pgPool from '@/lib/pg';

/** Minimal Customer shape returned when looking up an order's owner. */
export interface CustomerSummary {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string;
}

export interface Order {
  order_id: number;
  customer_id: number;
}

/**
 * OrderRepository — raw SQL queries only, no business logic.
 */
export class OrderRepository {
  /**
   * Return all orders belonging to a given customer.
   */
  public async findByCustomerId(customerId: number): Promise<Order[]> {
    const { rows } = await pgPool.query<Order>(
      'SELECT order_id, customer_id FROM orders WHERE customer_id = $1 ORDER BY order_id',
      [customerId]
    );
    return rows;
  }

  /**
   * Return the customer who owns a specific order.
   */
  public async findCustomerByOrderId(orderId: number): Promise<CustomerSummary | null> {
    const sql = `
      SELECT c.id, c.first_name, c.last_name, c.phone_number
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE o.order_id = $1
    `;
    const { rows } = await pgPool.query<CustomerSummary>(sql, [orderId]);
    return rows[0] ?? null;
  }
}

export default new OrderRepository();
