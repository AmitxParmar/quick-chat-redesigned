import { Request, Response, NextFunction } from 'express';
import customerService from './customer.service';

/**
 * CustomerController — HTTP layer only.
 * Reads req, calls service, writes res.  No business logic here.
 */
class CustomerController {
  /**
   * GET /customers
   * Returns all customers.
   */
  public getAll = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const customers = await customerService.getAll();
      res.status(200).json({ data: customers, message: 'Customers fetched successfully' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /customers/:id
   * Returns a single customer by ID.
   */
  public getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: 'Invalid customer id' });
        return;
      }
      const customer = await customerService.getById(id);
      res.status(200).json({ data: customer, message: 'Customer fetched successfully' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /search?q=:query
   * Searches across first_name, last_name, phone_number, and order_id.
   */
  public search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query.q as string;
      if (!query || query.trim() === '') {
        res.status(400).json({ message: 'Search query "q" is required' });
        return;
      }
      const results = await customerService.search(query);
      res.status(200).json({ data: results, message: 'Search completed', count: results.length });
    } catch (error) {
      next(error);
    }
  };
}

export default CustomerController;
