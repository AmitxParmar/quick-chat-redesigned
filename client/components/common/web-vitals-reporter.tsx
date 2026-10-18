"use client";

import { useEffect } from "react";
import { webVitals } from "@/lib/web-vitals";

/**
 * Mount-only initializer for the Web Vitals collector. Loaded via a
 * client-side dynamic import so it stays out of the initial server render.
 */
export default function WebVitalsReporter() {
    useEffect(() => {
        webVitals.init();
    }, []);

    return null;
}