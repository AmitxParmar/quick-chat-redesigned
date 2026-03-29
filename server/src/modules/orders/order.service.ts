import orderRepository, { type Order } from './order.repository';

/**
 * OrderService — business logic layer for orders.
 */
export class OrderService {
  /**
   * Return all orders for a customer. Returns empty array when none found.
   */
  public async getOrdersByCustomerId(customerId: number): Promise<Order[]> {
    return orderRepository.findByCustomerId(customerId);
  }
}

export default new OrderService();
