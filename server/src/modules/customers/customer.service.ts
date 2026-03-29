import customerRepository, { type Customer } from './customer.repository';

/**
 * CustomerService — business logic layer.
 * Validates inputs, orchestrates repository calls.
 */
export class CustomerService {
  /**
   * Search customers. Trims and validates the query before hitting the DB.
   */
  public async search(query: string): Promise<Customer[]> {
    const trimmed = query?.trim();
    if (!trimmed || trimmed.length < 1) {
      return [];
    }
    return customerRepository.search(trimmed);
  }

  /**
   * List all customers.
   */
  public async getAll(): Promise<Customer[]> {
    return customerRepository.findAll();
  }

  /**
   * Get a single customer, throws 404-style error if not found.
   */
  public async getById(id: number): Promise<Customer> {
    const customer = await customerRepository.findById(id);
    if (!customer) {
      const error = new Error(`Customer with id ${id} not found`);
      (error as any).statusCode = 404;
      throw error;
    }
    return customer;
  }
}

export default new CustomerService();
