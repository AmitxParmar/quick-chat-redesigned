import api from "@/lib/api";

export interface Customer {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string;
}

export interface Order {
  order_id: number;
  customer_id: number;
}

const BASE = "/customers";

/** Search customers by name, phone, or order ID */
export async function searchCustomers(q: string): Promise<Customer[]> {
  const res = await api.get(`${BASE}/search`, { params: { q } });
  return res.data.data ?? [];
}

/** Fetch all orders belonging to a customer */
export async function fetchOrdersByCustomer(customerId: number): Promise<Order[]> {
  const res = await api.get(`${BASE}/${customerId}/orders`);
  return res.data.data ?? [];
}
