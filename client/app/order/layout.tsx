"use client";

import { Suspense } from "react";
import OrderPage from "./page";

export default function OrderLayout() {
  return (
    <Suspense fallback={null}>
      <OrderPage />
    </Suspense>
  );
}
