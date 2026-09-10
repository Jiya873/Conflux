## Case Study: Real-time Editor App - A collaborative text editor

### The Problem

Building a collaborative editor is straightforward until multiple users type simultaneously. The naive approach — every client broadcasts its delta and every other client applies it directly — breaks down under real-world latency. Two users editing the same region at the same time produce deltas that are each valid against their local state but conflict when applied out of order on a peer. The result is silent document corruption.

A second problem emerges at scale: if every connected user independently saves the document on a fixed interval, the Redis write rate grows linearly with the number of users. Ten users editing simultaneously means ten redundant full-document writes every two seconds — all writing the same content.

### Key Technical Decisions

**Server-side delta composition**

Rather than treating the server as a dumb relay, it maintains an authoritative in-memory `Delta` per document using Quill's operational transform model. Every incoming `text-change` is composed onto this canonical state before being rebroadcast. This means the server always holds the ground-truth document regardless of client timing, and saves are always derived from that authoritative state rather than trusting any individual client's payload.

```
Client A types → emit delta A → server composes onto authoritative state → broadcast to peers
Client B types → emit delta B → server composes onto authoritative state → broadcast to peers
                                ↓
                         Redis save = server's composed state (not A or B's version)
```

**Debounced server-initiated save**

The save responsibility was moved entirely server-side. On each `text-change`, the server resets a per-document 2-second debounce timer. When the doc goes quiet, the server emits a `request-save` event to one client — the one whose change triggered the quiet period — and that client responds with the current contents. This collapses N concurrent saves into one regardless of how many users are active.

**Redis key namespacing and TTL**

Document content keys are stored as `doc:{id}` and user lists as `users:{id}`. Without this separation, a document with ID `users:abc` would silently overwrite the user list for document `abc`. Every write also refreshes a 24-hour TTL, so inactive documents are automatically evicted without manual cleanup.

**Socket-boundary input validation**

All payloads entering the server — `docId`, `username`, `delta`, and cursor `range` — are validated at the socket event boundary before any Redis or broadcast operation. `docId` is constrained to `[a-zA-Z0-9_-]{1,64}`, deltas must carry a valid `ops` array, and usernames are trimmed and capped at 50 characters. This prevents malformed data from propagating into storage or peer clients.

**Reconnection resilience**

The client `get-doc` emit is attached to the socket's `connect` event rather than being fired once on mount. If the socket drops and reconnects, the editor automatically rejoins the document room and reloads the current state — users see a seamless resume rather than a broken editor.
