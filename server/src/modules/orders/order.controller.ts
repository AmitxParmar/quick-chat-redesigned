import { Request, Response, NextFunction } from 'express';
import orderService from './order.service';

/**
 * OrderController — HTTP layer only.
 */
class OrderController {
  /**
   * GET /customers/:id/orders
   * Fetches all orders for the given customer.
   */
  public getOrdersByCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const customerId = parseInt(req.params.id, 10);
      if (isNaN(customerId)) {
        res.status(400).json({ message: 'Invalid customer id' });
        return;
      }
      const orders = await orderService.getOrdersByCustomerId(customerId);
      res.status(200).json({
        data: orders,
        message: 'Orders fetched successfully',
        count: orders.length,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default OrderController;
