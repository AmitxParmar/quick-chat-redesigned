# Performance Engineering Playbook

> Advanced frontend/backend performance concepts ported from the
> `realtime-market-lab` WebSocket lab, plus further recommendations from a
> code-level review of this repo. Complements [Performance](PERFORMANCE.md),
> which documents what's already implemented.

[← Performance](PERFORMANCE.md) · [Security →](SECURITY.md)

`PERFORMANCE.md` = baseline (virtualization, memoization, caching, indexes —
already shipped). This playbook = the next tier: connection resilience,
instrumentation, and fanout hot spots found by reviewing actual code paths
(`client/services/socket.service.ts`, `client/hooks/useMessages.tsx`,
`server/src/lib/socket.ts`). Each concept states source, finding, and fix.

---

## Part 1 — Concepts ported from realtime-market-lab

The lab proved these patterns under load (100–5000 events/s against a live
Vercel WebSocket). Chat traffic is burstier but sparser; the same mechanics apply.

### 1.1 Infinite reconnect with exponential backoff + cap

**Finding:** `client/services/socket.service.ts:53` sets
`reconnectionAttempts: 5` — after 5 failures the socket is dead until a full
page reload. Chat apps run on mobile networks where 5 consecutive failures is
a normal subway ride.

**Port** (from `realtime-market-lab/frontend/lib/wsClient.ts`):

```typescript
// socket.io already does backoff — just stop giving up
reconnection: true,
reconnectionAttempts: Infinity,       // was: 5
reconnectionDelay: 500,               // start fast
reconnectionDelayMax: 10_000,         // cap at 10s
randomizationFactor: 0.5,             // jitter (socket.io default) — avoids
                                      // a thundering herd when server restarts
```

**Priority: highest.** One-line change, prevents permanent silent failure.

### 1.2 Resync-on-reconnect (re-join rooms, don't just reconnect)

**Finding:** `client/hooks/useMessages.tsx:155` — the `connect` handler only
retries *pending sends*. `conversation:join` is emitted once at effect mount
(line 148) and **never again after a reconnect**. After any network blip:

- `message:created` still arrives (it's also emitted to `user:{waId}` rooms,
  which the server re-joins per connection — `server/src/lib/socket.ts:193`),
- but `message:status-updated` and read receipts go to `socket.to(conversationId)`
  only → **delivered/read ticks silently freeze until remount**.

**Port** (the lab's "resend pendingConfig on every onopen"):

```typescript
// client/hooks/useMessages.tsx
const onConnect = () => {
    socket.emit(SocketEvents.CONVERSATION_JOIN, conversationId); // re-join
    retryPendingMessages();                                       // already there
};
socket.on("connect", onConnect);
```

**Priority: high.** Fix first among reconnect issues — it's a correctness bug
wearing a performance costume (users re-send messages they think were lost).

### 1.3 Snapshot/delta catch-up on connect

**Concept (lab):** the server's first frame after connect is a full snapshot,
so a client that missed frames converges without any replay machinery.

**Apply:** on `conversation:join`, have the server (or an HTTP call the client
fires on reconnect) return messages **since the client's last-seen cursor**
(`{ conversationId, since: lastTimestamp } → missed[]`), instead of relying on
queue-retry alone. The queue only covers *outgoing* unsent messages; incoming
messages missed during downtime are currently only recovered by the next
`getMessages` refetch if the component remounts.

```typescript
// on connect:
socket.emit("conversation:sync", { conversationId, since: lastInboxTs });
server → socket.emit("conversation:catchup", { messages: missed });
// already idempotent: Dexie .put() upserts by primary key (message.dexie.service.ts:10)
```

**Priority: high** for offline resilience (README's stated goal).

### 1.4 Bounded backpressure buffer (drop-oldest, counted)

**Concept (lab):** incoming events land in a plain array capped at
`MAX_CLIENT_BUFFER`; overflow drops the *oldest* (stale data is worthless) and
increments a drop counter. Never let an unbounded queue grow on the main thread.

**Apply:** message storms (busy group, missed catch-up batches) currently flow
`socket event → Dexie put → Zustand notification` per message, unbounded.
Stage bursts into a small ring buffer drained on a timer or rAF:

```typescript
private buffer: Message[] = [];
push(m: Message) {
    this.buffer.push(m);
    if (this.buffer.length > MAX_BUFFER) {
        this.buffer.splice(0, this.buffer.length - MAX_BUFFER);
        this.droppedCount += this.buffer.length - MAX_BUFFER;
    }
}
```

Dexie's `put` already makes replays idempotent — buffering is safe.

**Priority: medium** — only bites during catch-up storms or very busy groups.

### 1.5 rAF-batched consumption (never update React per message)

**Concept (lab):** high-frequency messages are pulled from the buffer by a
`requestAnimationFrame` hook, then one Zustand/store write per frame (~16ms),
not one per message.

**Apply:** `handleIncomingMessage` (`client/logic/socket-event-handlers.ts`)
runs Dexie write + status ack per event. During a 100-message burst that's 100
store notifications and 100 renders of the message list. Drain the buffer from
1.4 once per animation frame; emit delivered-acks from the same batch.

```typescript
const flush = () => {
    const batch = buffer.drain();
    if (batch.length) store.addMessages(batch);   // single update
    sendDeliveredAcks(batch);
    requestAnimationFrame(flush);
};
requestAnimationFrame(flush);
```

**Priority: medium-high** for group chats; low for 1:1 traffic.

### 1.6 Instrument first — port the lab's PerfMetrics

**Concept (lab):** `usePerfMetrics.ts` + `metricsStore.ts` — raw event count,
drop count, and a 200-sample latency ring buffer, reset once per second, read
by a metrics panel. The lab's whole method: *measure, then optimize*.

**Apply:** `PERFORMANCE.md`'s "Actual" latency column (~100–150ms) is an
estimate — nothing in this repo timestamps messages end-to-end today
(no `performance.now`/latency instrumentation in client code). Port it:

```typescript
// server: stamp on receive (MESSAGE_SEND handler)
callback({ status: 'ok', messageId: message.id, receivedAt: Date.now() });

// client: latency sample per confirmed message
const rtt = performance.now() - sentAtMap.get(messageId);
perfMetrics.pushLatency(rtt);   // 200-sample ring, 1s readout

// wire a dev-only overlay: events/s, p50/p95 latency, dropped, reconnects
```

**Priority: highest of the "shoulds"** — every other item in this doc gets
ranked by data this produces. Without it, "sub-100ms delivery" is a hope.

### 1.7 Deployment lesson: platform constraints shape client code

**From the lab:** free-tier WS connections die at 300s; regions add 150–250ms;
an unset framework preset silently serves 404s. Takeaways for this repo:

- The infinite backoff from 1.1 is also your **5-minute-cap survival kit** if
  this backend ever moves behind serverless WS (Vercel beta, etc.).
- **Function/instance region = your latency floor.** If deployed for India
  users, pick `bom1`, not `iad1` — the lab's measured ~200ms D.C. round trip
  would dominate your sub-100ms budget.
- Serverless WS breaks `io.emit` cross-instance fanout unless the Redis
  adapter is configured — this repo already has it (`server/src/lib/socket.ts:107`),
  which is exactly why it ports cleanly.

---

## Part 2 — Frontend recommendations (beyond the lab port)

### 2.1 Presence fanout is a client problem too — don't render it globally

**Finding:** `user:online`/`user:offline` are broadcast to **every connected
socket** (see backend 3.1) and handled in `GlobalSocketListener`. Each
connect/disconnect anywhere = a store update + re-render everywhere.

**Fix:** scope handling — ignore presence for users not in your visible
contact set *before* touching Zustand:

```typescript
const onPresence = ({ waId }: { waId: string }) => {
    if (!contactStore.has(waId)) return;   // bail before any state write
    handleUserOnline(socket, { waId });
};
```

**Priority: high** — cost scales with total connected users, not your friends.

### 2.2 Hot-path `console.log` hygiene

**Finding:** `socket.service.ts:43,58,66` and `useMessages.tsx:156` log on
every connect/disconnect/retry; with 1.1's infinite reconnect, a server outage
turns into unbounded log spam in production consoles (each line has I/O cost,
and DevTools open slows the main thread measurably).

**Fix:** strip or gate behind `process.env.NODE_ENV === 'development'`.
**Priority: medium** — trivial effort.

### 2.3 Transport fallback decision (websocket-only is a choice — document it)

`transports: ["websocket"]` skips the HTTP long-polling fallback: faster on
good networks, fails hard on restrictive proxies/captive portals. Keep it if
you want (polling doubles handshake cost), but pair it with 1.1's infinite
retry + a visible "reconnecting…" UI state so failure is never silent.
**Priority: medium.**

### 2.4 Web Vitals budget in CI

The lab verified every claim with a live probe; do the same for the client:
`@next/bundle-analyzer` + `web-vitals` reporting, fail CI if
First Load JS exceeds a set budget or a route's CLS regresses. Numbers beat
vibes — same principle as 1.6.
**Priority: low-medium.**

---

## Part 3 — Backend recommendations

### 3.1 Scope the presence broadcast (biggest fanout in the codebase)

**Finding:** `server/src/lib/socket.ts:338` and `:223` —
`this.io?.emit('user:online'/'user:offline', …)` sends to **all sockets on all
instances** on every connect and disconnect. At 10k concurrent users with normal
churn that's ~10k × churn events/s of cross-instance Redis pub/sub traffic, and
every client processes them (2.1).

**Fix options, ranked:**

1. **Roster rooms:** on connect, join `watch:{waId}` rooms for the user's
   contacts; emit presence only to `watch:{contactWaId}` rooms → O(friends), not O(all).
2. **Lazy pull:** drop push entirely; clients fetch presence on conversation
   open (there's already `user:get-status`, `server/src/lib/socket.ts:231`).
3. **Debounce:** coalesce rapid churn into one emit per 2s window (cheap stopgap).

**Priority: high** — the only O(N²)-shaped cost found in the repo.

### 3.2 Cache the auth handshake's DB read

**Finding:** auth middleware runs `authRepository.findUserById` (Mongo hit) on
**every socket handshake** (`server/src/lib/socket.ts:72`) — reconnect storms
(1.1 makes them longer-lived, which is fine) translate directly into DB QPS.

**Fix:** cache-aside in Redis, TTL 5–15 min (there's already a cache service;
user profile cache at 1h is documented in `PERFORMANCE.md` — same pattern):

```typescript
const cacheKey = `user:sock:${payload.userId}`;
let user = await cacheService.get(cacheKey);
if (!user) { user = await authRepository.findUserById(payload.userId);
             if (user) await cacheService.set(cacheKey, user, 900); }
```

**Priority: high** — handshake is the most frequent DB read per connection.

### 3.3 Pipeline the heartbeat

**Finding:** `server/src/lib/socket.ts:364` —
`Promise.all(waIds.map(SET))` issues **one round trip per user** every 30s
per instance. 1k connected users = 1k RTTs per heartbeat per instance.

**Fix:** single `pipeline()`/multi-exec (or one `MSET`) → 1 RTT.
Also consider refreshing presence only for sockets whose key is near expiry
instead of all of them.
**Priority: medium** — cheap fix, cost grows linearly with connected users.

### 3.4 Downgrade hot-path logging to debug

**Finding:** `logger.info('Relaying message …')` (`server/src/lib/socket.ts:261`)
plus per-event status/read logs — one log write per message per hop. At storm
rates, log I/O becomes measurable event-loop work.

**Fix:** `logger.debug` for per-message lines; keep `info` for lifecycle
(connect/disconnect/queue failures). If structured logs are consumed
externally, sample (1 in N) instead of dropping entirely.
**Priority: medium.**

### 3.5 Verify message pagination is keyset, not offset

**Finding:** the conversation repo already does keyset pagination
(`skip: cursor ? 1 : 0`, `conversation.repository.ts:84`) and Message has the
right compound index (`@@index([conversationId, timestamp])`,
`prisma/schema.prisma:95`) — but the client paginates by **offset pages**
(`useMessages.tsx` resultArrays/pageSize) and the message repository fetch
shows `take: limit, orderBy timestamp desc` with no cursor. Deep scrolling in
a busy chat will re-fetch overlapping windows or skip messages as new ones
arrive.

**Fix:** thread a `before: timestamp` cursor through
`getMessages → client getNextPage`, mirroring the conversation repo's pattern.
**Priority: medium-high** — correctness under load, aligns with an index
that's already there.

### 3.6 Keep `perMessageDeflate: false` — but own the tradeoff

Chat payloads are small (a few hundred bytes); compression costs CPU per frame
and the lab confirmed the same for its JSON frames. Current server config
(`server/src/lib/socket.ts:46-47`) is right. Revisit only if profiling shows
large payloads (image metadata, long threads) dominating bandwidth.
**Priority: informational — no change.**

---

## Rollout order

| # | Change | Where | Effort | Payoff |
|---|--------|-------|--------|--------|
| 1 | Infinite reconnect + re-join rooms (1.1, 1.2) | client | ~10 lines | kills silent permanent disconnects |
| 2 | Latency instrumentation (1.6) | both | small | makes every later item measurable |
| 3 | Presence fanout scoping (3.1 + 2.1) | both | medium | removes the O(N²) cost |
| 4 | Auth handshake cache (3.2) | server | small | cuts DB QPS per reconnect |
| 5 | Cursor pagination (3.5) | server+client | medium | deep-chat correctness |
| 6 | Catch-up snapshot (1.3) | both | medium | real offline resilience |
| 7 | rAF batching + bounded buffer (1.4, 1.5) | client | medium | group-storm headroom |
| 8 | Log/heartbeat/CI hygiene (2.2, 2.4, 3.3, 3.4) | both | trivial | keeps hot paths clean |

Rule from the lab: **ship #2 before believing anyone's latency numbers,
including this document's.**

## Related Documentation

- [Performance](PERFORMANCE.md) — baseline optimizations already shipped
- [Message Flow](MESSAGE_FLOW.md) — end-to-end delivery path referenced above
- [Engineering Decisions](ENGINEERING_DECISIONS.md) — compression, transport tradeoffs
- [System Design](SYSTEM_DESIGN.md) — cache strategy used by the handshake cache
