import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Firebase Admin SDK initialization.
 *
 * Loads service account credentials lazily so the server can boot
 * without Firebase configured (useful in early dev / CI). When
 * credentials are missing, all helpers return `null` and emit a
 * one-time warning so callers must check before using.
 *
 * Three credential sources, in priority order:
 *  1. FIREBASE_SERVICE_ACCOUNT_JSON              — raw JSON string
 *  2. FIREBASE_SERVICE_ACCOUNT_JSON_BASE64       — base64-encoded JSON
 *  3. FIREBASE_SERVICE_ACCOUNT_PATH              — path to JSON file
 *
 * Realtime Database URL is read from FIREBASE_DATABASE_URL and must
 * look like `https://<project-id>-default-rtdb.<region>.firebasedatabase.app`.
 */

let initializedApp = null;
let initWarned = false;
let dynamicAdminModule = null;

function getEnvJson() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) return raw;

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
  if (b64) return Buffer.from(b64, 'base64').toString('utf8');

  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (path) {
    try {
      return readFileSync(resolve(process.cwd(), path), 'utf8');
    } catch (err) {
      console.warn(`[firebase] Failed to read service account at ${path}:`, err.message);
      return null;
    }
  }
  return null;
}

function warnOnce(message) {
  if (initWarned) return;
  initWarned = true;
  console.warn(`[firebase] ${message}`);
}

/**
 * Initialize Firebase Admin SDK. Safe to call multiple times — only the first
 * invocation actually initializes; subsequent calls are no-ops. Returns the
 * App instance, or null if credentials are not configured.
 */
export async function initializeFirebase() {
  if (initializedApp) return initializedApp;

  const jsonStr = getEnvJson();
  const databaseURL = process.env.FIREBASE_DATABASE_URL;

  if (!jsonStr || !databaseURL) {
    warnOnce(
      'Firebase credentials not fully configured. Live location features will be disabled. ' +
        'Set FIREBASE_SERVICE_ACCOUNT_JSON (or _BASE64 / _PATH) and FIREBASE_DATABASE_URL to enable.',
    );
    return null;
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(jsonStr);
  } catch (err) {
    warnOnce(`Could not parse FIREBASE_SERVICE_ACCOUNT_JSON: ${err.message}`);
    return null;
  }

  try {
    if (!dynamicAdminModule) {
      dynamicAdminModule = (await import('firebase-admin')).default;
    }
    initializedApp = dynamicAdminModule.initializeApp({
      credential: dynamicAdminModule.credential.cert(serviceAccount),
      databaseURL,
    });
    console.log(`✅ Firebase Admin initialized (project: ${serviceAccount.project_id})`);
    return initializedApp;
  } catch (err) {
    console.warn('[firebase] Initialization failed:', err.message);
    return null;
  }
}

/**
 * Returns the firebase-admin module, or null if not initialized.
 * Callers MUST handle the null case so the rest of the app keeps working
 * when Firebase isn't configured yet.
 */
export function getFirebaseAdmin() {
  if (!initializedApp) return null;
  return dynamicAdminModule;
}

/**
 * Convenience: returns the Realtime Database reference root, or null.
 */
export function getRtdb() {
  const admin = getFirebaseAdmin();
  if (!admin) return null;
  return admin.database();
}

/**
 * Returns true when Firebase is fully wired up and safe to write to.
 * Use this at the top of feature-flagged code paths.
 */
export function isFirebaseReady() {
  return Boolean(initializedApp);
}
