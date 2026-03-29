import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useState } from "react";
import {
  searchCustomers,
  fetchOrdersByCustomer,
  type Customer,
  type Order,
} from "@/services/customers.service";

// ─── Search Hook ─────────────────────────────────────────────────────────────

/**
 * useCustomerSearch
 *
 * Exposes `query` + `setQuery` (debounced 350ms) and the TanStack Query result.
 * Only fires a request when the debounced query has at least 1 character.
 */
export function useCustomerSearch() {
  const [query, setQuery] = useState("");

  // Debounce the raw input by 350ms before using it as a query key
  const [debouncedQuery] = useDebouncedValue(query, { wait: 350 });

  const result = useQuery<Customer[]>({
    queryKey: ["customers", "search", debouncedQuery],
    queryFn: () => searchCustomers(debouncedQuery),
    enabled: debouncedQuery.trim().length > 0,
    staleTime: 1000 * 30,
    placeholderData: (prev) => prev, // keep previous results visible while fetching
  });

  return {
    query,
    setQuery,
    customers: result.data ?? [],
    isLoading: result.isFetching,
    isError: result.isError,
    /** True only when user has typed something but got 0 results */
    isEmpty:
      debouncedQuery.trim().length > 0 &&
      !result.isFetching &&
      result.data?.length === 0,
  };
}

// ─── Orders Hook ─────────────────────────────────────────────────────────────

/**
 * useCustomerOrders
 *
 * Fetches all orders for a given customerId.
 * Pass `null` to keep it disabled (no customer selected yet).
 */
export function useCustomerOrders(customerId: number | null) {
  return useQuery<Order[]>({
    queryKey: ["customers", "orders", customerId],
    queryFn: () => fetchOrdersByCustomer(customerId!),
    enabled: customerId !== null,
    staleTime: 1000 * 60,
  });
}

// default export for backward-compat with the stub
const useSearchResults = useCustomerSearch;
export default useSearchResults;
