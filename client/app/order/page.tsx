"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Package, Loader2, AlertCircle } from "lucide-react";
import { useCustomerOrders } from "@/hooks/useSearchResults";
import type { Order } from "@/services/customers.service";

// Inner component that reads search params (must be inside Suspense)
function OrderContent() {
  const router = useRouter();
  const params = useSearchParams();

  const rawId = params.get("customerId");
  const name = params.get("name") ?? "Customer";
  const customerId = rawId ? parseInt(rawId, 10) : null;

  const { data: orders = [], isLoading, isError } = useCustomerOrders(customerId);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border">
        <button
          id="back-to-search"
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-accent transition-colors"
          aria-label="Go back"
          title="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-semibold">{name}</h1>
          <p className="text-xs text-muted-foreground">Customer #{customerId}</p>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">
        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Fetching orders…</p>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="flex flex-col items-center gap-2 py-20 text-destructive">
            <AlertCircle className="w-8 h-8" />
            <p className="text-sm">Failed to load orders. Try again.</p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && orders.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
            <Package className="w-8 h-8" />
            <p className="text-sm">No orders found for this customer.</p>
          </div>
        )}

        {/* Orders list */}
        {!isLoading && !isError && orders.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-medium">
              {orders.length} order{orders.length !== 1 ? "s" : ""}
            </p>
            <ul id="orders-list" className="flex flex-col gap-3">
              {orders.map((order: Order) => (
                <li
                  key={order.order_id}
                  id={`order-${order.order_id}`}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Order #{order.order_id}</p>
                    <p className="text-xs text-muted-foreground">
                      Customer ID: {order.customer_id}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}

// Page wraps content in Suspense (required by Next.js for useSearchParams)
export default function OrderPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 animate-spin" /></div>}>
      <OrderContent />
    </Suspense>
  );
}
