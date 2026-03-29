import { Router } from 'express';
import CustomerController from './customer.controller';
import OrderController from '@/modules/orders/order.controller';

const router: Router = Router();
const customerController = new CustomerController();
const orderController = new OrderController();

/**
 * GET /customers
 * @summary List all customers
 * @tags customers
 * @return {array<Customer>} 200 - All customers
 */
router.get('/', customerController.getAll);

/**
 * GET /customers/search?q=:query
 * @summary Search customers by name, phone, or order ID
 * @tags customers
 * @param {string} q.query.required - Search term
 * @return {array<Customer>} 200 - Matching customers
 */
router.get('/search', customerController.search);

/**
 * GET /customers/:id
 * @summary Get a single customer by ID
 * @tags customers
 * @param {number} id.path.required - Customer ID
 * @return {Customer} 200 - Customer object
 */
router.get('/:id', customerController.getById);

/**
 * GET /customers/:id/orders
 * @summary Fetch all orders for a customer
 * @tags customers
 * @param {number} id.path.required - Customer ID
 * @return {array<Order>} 200 - List of orders
 */
router.get('/:id/orders', orderController.getOrdersByCustomer);

export default router;
