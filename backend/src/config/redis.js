/**
 * Lazy ioredis singleton used by every BullMQ producer/worker in this
 * project. Imported only by `queues/*` and the worker bootstrap.
 *
 * Design notes:
 *
 *   1. **Optional in dev/CI.** When `REDIS_URL` is not set the helper
 *      returns `null` instead of throwing. Callers (queues + workers)
 *      degrade to no-ops so the API boots cleanly without Redis. This
 *      mirrors how `config/firebase.js` handles missing creds.
 *
 *   2. **BullMQ-compatible options.** We force
 *      `maxRetriesPerRequest = null` and `enableReadyCheck = false` so
 *      blocking BRPOP / XREAD calls don't get killed on transient
 *      hiccups. BullMQ requires both.
 *
 *   3. **Single connection per process.** The first successful
 *      `getRedisConnection()` caches the client; subsequent calls
 *      return the same instance so we don't multiply socket FDs across
 *      every Queue.
 */

let cachedConnection = null;
let dynamicIoredis = null;

export async function getRedisConnection() {
  if (cachedConnection) return cachedConnection;

  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;

  try {
    if (!dynamicIoredis) {
      const mod = await import('ioredis');
      dynamicIoredis = mod.default || mod;
    }

    const client = new dynamicIoredis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
    });

    client.on('error', (err) => {
      // BullMQ also surfaces connection errors via its own listeners;
      // we just want this in the server log for visibility.
      console.warn('[redis] connection error:', err?.message || err);
    });

    cachedConnection = client;
    return cachedConnection;
  } catch (err) {
    console.warn('[redis] failed to initialise client:', err?.message || err);
    return null;
  }
}

export async function closeRedisConnection() {
  if (!cachedConnection) return;
  try {
    await cachedConnection.quit();
  } catch {
    // ignore — the process is shutting down anyway
  } finally {
    cachedConnection = null;
  }
}
