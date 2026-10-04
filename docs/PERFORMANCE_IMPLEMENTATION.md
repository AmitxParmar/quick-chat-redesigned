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

## First measurement to take

`__qcPerf.getSnapshot()` in the dev console after sending a message — that RTT
number is the baseline every future optimization is judged against.

## Deliberately left out (still in the playbook)

- History offset → cursor migration (server `findByConversation` still paged; catch-up path is keyset)
- Roster-room presence scoping (needs participant index first)
- Web Vitals / bundle budget in CI

## Related Documentation

- [Performance Engineering](PERFORMANCE_ENGINEERING.md) — concepts + rollout order
- [Performance](PERFORMANCE.md) — baseline optimizations
- [Message Flow](MESSAGE_FLOW.md) — delivery path these phases modified
