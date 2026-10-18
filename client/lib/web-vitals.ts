/**
 * Lightweight Web Vitals collector — no `web-vitals` dependency.
 *
 * Collects LCP, CLS, INP (p98 of event durations) and TTFB via
 * PerformanceObserver / Navigation Timing. Dev hook:
 *
 *   __qcVitals.snapshot()      -> current metrics
 *   __qcVitals.measureFps(ms)  -> rAF frame stats (scroll-FPS ceiling)
 *
 * Reporting: if NEXT_PUBLIC_VITALS_ENDPOINT is set, the snapshot is sent
 * with `navigator.sendBeacon` when the page is hidden (one request per
 * session, never a hot path).
 */

export interface WebVitalsSnapshot {
    lcpMs: number | null;
    cls: number;
    inpMs: number | null;
    ttfbMs: number | null;
    updatedAt: number;
}

export interface FpsResult {
    avgFps: number;
    p95FrameMs: number;
    frames: number;
}

const INP_SAMPLE_SIZE = 50;

class WebVitalsCollector {
    private lcpMs: number | null = null;
    private cls = 0;
    private inpSamples: number[] = [];
    private ttfbMs: number | null = null;
    private started = false;

    init(): void {
        if (this.started || typeof window === "undefined") return;
        this.started = true;

        try {
            this.readTtfb();
            this.observeLcp();
            this.observeCls();
            this.observeInp();
            this.setupBeacon();
        } catch {
            // API unavailable (old browser / SSR) — metrics stay null.
        }
    }

    snapshot(): WebVitalsSnapshot {
        return {
            lcpMs: this.lcpMs,
            cls: Number(this.cls.toFixed(4)),
            inpMs: this.computeInp(),
            ttfbMs: this.ttfbMs,
            updatedAt: Date.now(),
        };
    }

    private readTtfb(): void {
        const nav = performance.getEntriesByType("navigation")[0] as
            | PerformanceNavigationTiming
            | undefined;
        if (nav) this.ttfbMs = Math.max(0, nav.responseStart - nav.startTime);
    }

    private observeLcp(): void {
        const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const last = entries[entries.length - 1];
            if (last) this.lcpMs = Math.round(last.startTime);
        });
        observer.observe({ type: "largest-contentful-paint", buffered: true });
    }

    private observeCls(): void {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
                if (!shift.hadRecentInput && typeof shift.value === "number") {
                    this.cls += shift.value;
                }
            }
        });
        observer.observe({ type: "layout-shift", buffered: true });
    }

    private observeInp(): void {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                this.inpSamples.push(entry.duration);
                if (this.inpSamples.length > INP_SAMPLE_SIZE) {
                    this.inpSamples.shift();
                }
            }
        });
        // durationThreshold is not in the TS lib for all versions; cast.
        observer.observe({ type: "event", buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
    }

    /** p98 of the bounded event-duration samples (INP approximation). */
    private computeInp(): number | null {
        if (this.inpSamples.length === 0) return null;
        const sorted = [...this.inpSamples].sort((a, b) => a - b);
        const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.98));
        return Math.round(sorted[idx]);
    }

    /** One beacon per session, fired when the page is hidden. */
    private setupBeacon(): void {
        const endpoint = process.env.NEXT_PUBLIC_VITALS_ENDPOINT;
        if (!endpoint) return;

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState !== "hidden") return;
            try {
                navigator.sendBeacon(endpoint, JSON.stringify(this.snapshot()));
            } catch {
                // never break the app over telemetry
            }
        });
    }
}

/**
 * rAF frame sampler used to measure scroll/render smoothness in the dev
 * console: `await __qcVitals.measureFps(3000)` while scrolling.
 */
export function measureFps(durationMs = 3000): Promise<FpsResult> {
    return new Promise((resolve) => {
        const frameTimes: number[] = [];
        let last = performance.now();
        const start = last;

        const tick = (now: number) => {
            frameTimes.push(now - last);
            last = now;
            if (now - start >= durationMs || frameTimes.length > 100000) {
                const sorted = [...frameTimes].sort((a, b) => a - b);
                const sum = sorted.reduce((s, t) => s + t, 0);
                const avg = sorted.length > 0 ? sum / sorted.length : 0;
                resolve({
                    avgFps: avg > 0 ? Math.round(1000 / avg) : 0,
                    p95FrameMs: sorted.length > 0
                        ? Number(sorted[Math.floor(sorted.length * 0.95)].toFixed(1))
                        : 0,
                    frames: sorted.length,
                });
                return;
            }
            requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
    });
}

export const webVitals = new WebVitalsCollector();

// Dev-only escape hatch: `__qcVitals.snapshot()` / `__qcVitals.measureFps()`.
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    (window as unknown as {
        __qcVitals: { snapshot: () => WebVitalsSnapshot; measureFps: (ms?: number) => Promise<FpsResult> };
    }).__qcVitals = {
        snapshot: () => webVitals.snapshot(),
        measureFps,
    };
}