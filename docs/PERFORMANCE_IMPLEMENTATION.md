# Performance Implementation Log

> What actually shipped from the [Performance Engineering Playbook](PERFORMANCE_ENGINEERING.md),
> phase by phase. Each phase is its own commit — roll back one phase with
> `git revert <hash>`, or everything with `git reset --hard 389396f` (pre-plan baseline).

[← Performance Engineering](PERFORMANCE_ENGINEERING.md) · [Index →](INDEX.md)

## Shipped phases

| Phase | What | Commit | Verify |
|-------|------|--------|--------|
| Baseline | Pre-plan checkpoint (push fix, middleware fix, playbook) | `389396f` | clean tree |
| 1 — Reconnect | Infinite reconnect (500ms→10s + jitter); re-emit `conversation:join` on every connect | `d0e68b8` | client `tsc` clean |
| 2 — Instrumentation | Server `receivedAt` ack stamp; client RTT ring (200 samples), sent/acked/failed counters, `__qcPerf` dev hook wired into queue send path | `22339b6` | client `tsc` clean |
| 3 — Presence | `user:online` only on first socket, `user:offline` only on last socket per waId; client ignores own online event (was re-sending inbox into rejections) | `366fdfd` | client `tsc` clean |
| 4 — Server hot path | Auth user snapshot cached 15m; heartbeat via single pipeline RTT; 8 per-message logs → `debug` | `af02e2f` | server `tsc`: only 4 pre-existing controller errors (proven via stash test) |
| 5a — Catch-up query | Keyset `findByConversationSince` on `@@index([conversationId, timestamp])`; `conversation:sync` → `conversation:catchup` (requesting socket only, participant-checked) | `8fc06bd` | server `tsc`: no new errors |
| 5b — Catch-up + ingest | Sync requested on every connect (newest stored ts); idempotent bulkPut merge; 500-cap drop-oldest buffer flushed per macrotask; socket/fetch logs dev-only | `e423765` | client `tsc` clean |

## Phase 6 — Browser-side pass (implemented)

| Change | Where | Notes |
|---|---|---|
| Gate/prefetch/cache hardening | client/next.config.ts | `poweredByHeader: false`, `images.formats` (avif/webp) |
| Preconnect to API origin | client/app/layout.tsx | dynamic origin from `NEXT_PUBLIC_API_BASE_URL` |
| Conversation list virtualization | client/components/conversations/conversation-list/index.tsx | `@tanstack/react-virtual`, ~76px estimate; closes doc/code drift |
| Hot-path `console.log` gating | 6 client files | shifted to dev-only |
| Service worker runtime caching | client/public/sw.js | app shell + static/media cache-first; navigation network-first w/ fallback; RSC/API excluded |
| Message history keyset pagination | client/services/message.dexie.service.ts, client/hooks/useMessages.tsx | cursor window `[oldestTs, ∞)` — no offset scans, no skip/duplicate windows |
| Server cursor support | server/src/modules/message/{repository,service,controller}.ts | `?cursor=`/`?before=` keyset branch; page mode retained for compat |
| Presence hot-path index | client/services/message.dexie.service.ts | pending lookup uses `status` index before recipient filter |
| Roster-room presence scoping | server/src/lib/socket.ts + types, client/hooks/usePresenceWatch.ts | `presence:watch` full-set replace (cap 300, `watch:{waId}` rooms); `user:online/offline` emitted to watch rooms only — O(roster), not O(all) |
| Web Vitals collector | client/lib/web-vitals.ts + reporter | native PerformanceObserver; `__qcVitals.snapshot()`, `measureFps()`; optional beacon |
| Bundle budget gate | client/scripts/check-bundle-budget.mjs | `pnpm check:bundle`, `BUNDLE_BUDGET_KB` env |

Still open: none of the earlier phases — remaining follow-ups are only verification tasks (run `pnpm check:bundle` with a real budget, capture scroll FPS in a real browser).

## First measurement to take

`__qcPerf.getSnapshot()` in the dev console after sending a message — that RTT
number is the baseline every future optimization is judged against.

Measured headlessly 2026-10-06 (localhost, socket.io ack timing = same path
`__qcPerf` samples; probe script `/tmp/opencode/qc-probe.cjs`):

- Send→ack RTT (n=20): **avg 1.24ms, p95 1.98ms**, min 0.96 / max 1.98
- Reconnect handshake (fresh socket + JWT + room joins): **~334ms**
- `conversation:sync` → `conversation:catchup`: **~190ms** (worst case, `since: 0`)

Still open (needs a real browser): scroll-FPS ceiling at N thousand messages.

## Deliberately left out (still in the playbook)

- Web Vitals / bundle budget wired into an actual CI pipeline (collector + `pnpm check:bundle` are in place; no CI config exists in this repo yet)

## Related Documentation

- [Performance Engineering](PERFORMANCE_ENGINEERING.md) — concepts + rollout order
- [Performance](PERFORMANCE.md) — baseline optimizations
- [Message Flow](MESSAGE_FLOW.md) — delivery path these phases modified
