/**
 * PerfMetrics — client-side send-path latency/throughput instrumentation.
 *
 * Ported from realtime-market-lab's usePerfMetrics/metricsStore:
 * raw counters plus a bounded ring buffer of RTT samples, read out on a
 * 1-second cadence. Deliberately framework-free (no React/Zustand) so the
 * hot send path never pays for a re-render to record a sample.
 *
 * Wiring: MessageQueueService.sendViaSocket records performance.now()
 * before emit and pushes the RTT when the server ack lands; the server
 * stamps `receivedAt` on the ack (server/src/lib/socket.ts) so client
 * queueing vs server processing can be told apart later.
 */

const MAX_SAMPLES = 200;

export interface PerfSnapshot {
    sent: number;
    acked: number;
    failed: number;
    samples: number;
    avgRttMs: number;
    p95RttMs: number;
}

class PerfMetricsService {
    private sentCount = 0;
    private ackedCount = 0;
    private failedCount = 0;
    private rttSamples: number[] = [];

    markSent(): void {
        this.sentCount += 1;
    }

    /** Record a successful ack round-trip in milliseconds. */
    markAcked(rttMs: number): void {
        this.ackedCount += 1;
        this.rttSamples.push(Math.max(0, rttMs));
        if (this.rttSamples.length > MAX_SAMPLES) {
            this.rttSamples.shift();
        }
    }

    markFailed(): void {
        this.failedCount += 1;
    }

    getSnapshot(): PerfSnapshot {
        const sorted = [...this.rttSamples].sort((a, b) => a - b);
        const sum = sorted.reduce((a, b) => a + b, 0);
        const p95 = sorted.length > 0 ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;
        return {
            sent: this.sentCount,
            acked: this.ackedCount,
            failed: this.failedCount,
            samples: sorted.length,
            avgRttMs: sorted.length > 0 ? sum / sorted.length : 0,
            p95RttMs: p95,
        };
    }

    /** Reset cumulative counters (keeps no history — snapshots are point-in-time). */
    reset(): void {
        this.sentCount = 0;
        this.ackedCount = 0;
        this.failedCount = 0;
        this.rttSamples = [];
    }
}

export const perfMetrics = new PerfMetricsService();

// Dev-only escape hatch: `__qcPerf.getSnapshot()` in the console.
// No production overhead beyond one property assignment at module load.
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    (window as unknown as { __qcPerf: PerfMetricsService }).__qcPerf = perfMetrics;
}

export default perfMetrics;
