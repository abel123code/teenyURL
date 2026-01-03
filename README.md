## Getting Started

TeenyURL is a URL shortening service built to explore real-world system design tradeoffs rather than feature breadth.
The project focuses on correctness, performance, and scalability covering collision-safe ID generation, TTL enforcement, caching, rate limiting, and scale-out reasoning for read-heavy workloads.

## Setup

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

## Phase 0 — Spec & README skeleton (no code)

- API contracts
  - POST api/shorten (long url → return response)
  - GET /{code}
    - if found + not expired : 302
    - if not found : 404
    - if expired : 410
- schema
  links table:
  | Column | Type | Notes |
  | ---------- | ----------- | -------------------- |
  | id | BIGSERIAL | internal id |
  | code | VARCHAR(16) | UNIQUE, indexed |
  | long_url | TEXT | required |
  | created_at | TIMESTAMPTZ | default now |
  | expires_at | TIMESTAMPTZ | nullable |
  | clicks | BIGINT | default 0 (optional) |
- invariants
  - 1 code → 1 URL
  - no collisions → can never ever return a code that already exist
  - expired link must never redirect
  - DB is the source of truth. if cache fails, use DB

Terms:
Base62: 62 possible characters from A-Z , a-z, 0-9
TTL: Time to live (the time that a piece of data will be valid)

## Phase 1 — MVP without cache

- POST /shorten
- GET /{code}
- DB persistence
- collision-safe generation
  - we ensure that the DB allows a unique code so if you insert something present it will flag out
  - rely on DB uniqueness to ensure that 1 code → 1 URL
- test - unit testing for the functions

Self Check

- **Why rely on DB uniqueness instead of checking first?**
  - DB already enforce uniqueness (1 code → 1 URL)
  - let the DB enforce uniqueness **atomically**, then handle conflict (retry).
- **What happens if two requests generate the same code?**
  - One insert wins.
  - The other insert hits **unique constraint violation** and retries generating a new code (up to 8 attempts).
- **Why is TTL enforced on read, not via deletion?**
  - If its expired, we show 410
  - we do not delete when expired
  - deletion is a job that could fail, so if our correctness depends on deletion, a expired link could redirect
  - **Read-time check = correctness guarantee**
  - **Deletion job = optional optimization to save storage**
- **Why 302 now instead of 301?**
  - 301 status code is a permanent redirect which will be aggressively cached by the browser
  - 302 status code is a temporary redirect which is less aggressively cached.
- **What’s the bottleneck if traffic increases 100×?**
  - Database read is the hottest api route
  - every read is trigger a db query leading to latency
  - Solution: Introduce caching to absorb hot redirects. Can introduce load balancer and read replicas

## Phase 2 — Add caching

Overall flow: GET /{code} → cache lookup → (maybe) DB lookup → redirect

- in-memory cache
- cache-miss fallback
- bounded size
- eviction policy
  - Memory is limited. If you keep adding to a `Map` forever, your server’s RAM grows until it crashes.
  - Hence, we use FIFO for this project
  - Other eviction policy
    - LRU - least recently used
    - LFU - least frequently used
- tests for cache behavior
  - cache-hit.test.ts
    - Mock the DB. Usually, getLinkByCode is the function that is used to query the DB. We mock it to return any value that we specify
    - We test caching (1) Insert code with long expiry date and check if the 2nd time retrieving it triggers a call (2) Insert code with already expired date and check if 2nd time retrieving triggers a db call

Cold vs Warm Cache:

- **Cold cache** = empty memory
  First time you hit `GET /{code}`, the server **doesn’t have it stored**, so it must go to the **DB**.
  That request is usually slower.
- **Warm cache** = already has the answer
  After the first request, `code → longUrl` is stored in the cache.
  The next `GET /{code}` can return the redirect **without DB**, so it’s usually faster.

Why if we check cache and it shows expired, we cant just return expired 410? Why do we need to do a DB look up?

- Because the cache is allowed to be wrong. The DB is not.
  - Cache entry stored with `expiresAt = Jan 1`
  - DB entry later updated (e.g. TTL extended, bug fixed, manual override)
  - Cache still has old `expiresAt`

How do we test that warm cache is much faster than cold cache?

- Run command to shorten url in git bash

```
curl -X POST http://localhost:3000/api/shorten   -H "Content-Type: application/json"   -d '{"longUrl":"https://example.com"}'

Take the code returned and manually insert into scripts/bench.js & run the script (node scripts/bench.js)

bench.js:
for 30 times:
  clear cache
  hit GET /{code}
  record latency

clear cache
hit GET /{code} once   ← warm-up
for 1000 times:
  hit GET /{code}
  record latency
```

- results:

![Cache benchmark results](/benchmarks/cache-results.png)

- conclusion:
  - Cold is slower as compared to warm. Shows that in memory cache is working.
  - Caching removes database/network variance from the hot path, cutting typical latency ~2× and tail latency >2×, while dramatically reducing average latency by eliminating outliers.
  - DB calls can be unreliable (network jitter, connection pooling delay), caching help to remove the unpredictability

## Phase 3 — Add rate limiting + TTL

abuse prevention + lifecycle management

- fixed window limiter
  - Implementation:
    - used an in-memory `Map`.
    - On each request, we compute the current window start time by rounding `now` down to the window boundary (e.g., the current minute).
    - Form a key as `(routePrefix:ip:windowStart)` and upsert a counter in the map (create if missing, increment if present).
    - If the counter exceeds the limit, we return `429` and include `Retry-After`. We also attach `X-RateLimit-*` headers on responses to expose limit/remaining/reset.
    - Cap the map at 50k buckets and apply FIFO eviction by deleting the oldest keys until the size is under the threshold.
- expiration enforcement
- optional cleanup job
  - Run periodically: delete expired rows older than X days
  - We implemented FIFO for expired jobs once it hits 50,000

Testing rate limit:

```
for i in {1..11}; do
  curl -s -X POST http://localhost:3000/api/shorten \
    -H "Content-Type: application/json" \
    -d '{"longUrl":"https://example.com"}' | jq .
done

```

![Cache benchmark results](/benchmarks/rate-limit-results.png)

## Phase 4 — “Scale reasoning”

- write how you’d scale reads 100×
- where LB, Redis, replicas fit
- what changes in code/data model

Stage 1:

Client → App → DB

Stage 2: Horziontal scaling + L1 cache:

Client → Load Balancer → App instances (L1 cache) → DB

Stage 3:

1. Add L2 cache like Redis (shared cache among all app instances)
2. Read replicas. Main DB is still used for write, but Read replicas for cache misses
3. Rate limiting: centralized rate limiting by Redis

![Diagram of final design](/benchmarks/final-design.png)
